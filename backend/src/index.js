const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const multer = require('multer')
const Database = require('better-sqlite3')

const app = express()
const PORT = process.env.PORT || 3001

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS solicitudes (
    id TEXT PRIMARY KEY,
    estado TEXT DEFAULT 'pendiente',
    motivo_rechazo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    nombre TEXT, apellido TEXT, fecha_nac TEXT, sexo TEXT,
    numero_doc TEXT, vencimiento_doc TEXT, equipo TEXT,
    tutor_nombre TEXT, tutor_apellido TEXT, tutor_vinculo TEXT,
    tutor_doc TEXT, tutor_venc_doc TEXT,
    archivo_foto TEXT, archivo_dni_frente TEXT, archivo_dni_dorso TEXT,
    archivo_tutor_frente TEXT, archivo_tutor_dorso TEXT
  );
  CREATE TABLE IF NOT EXISTS equipos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    federacion TEXT,
    activo INTEGER DEFAULT 1
  );
`)

const countEquipos = db.prepare('SELECT COUNT(*) as n FROM equipos').get()
if (countEquipos.n === 0) {
  const ins = db.prepare('INSERT INTO equipos (id, nombre, federacion) VALUES (?, ?, ?)')
  ;[
    ['eq1', 'Sub-8 Federación A', 'Federación A'],
    ['eq2', 'Sub-10 Federación A', 'Federación A'],
    ['eq3', 'Sub-12 Federación A', 'Federación A'],
    ['eq4', 'Sub-14 Federación A', 'Federación A'],
    ['eq5', 'Sub-8 Federación B', 'Federación B'],
    ['eq6', 'Sub-10 Federación B', 'Federación B'],
    ['eq7', 'Sub-12 Federación B', 'Federación B'],
  ].forEach(([id, nombre, fed]) => ins.run(id, nombre, fed))
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}.jpg`),
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') cb(null, true)
    else cb(new Error('Solo se aceptan archivos JPEG'))
  },
})
const uploadFields = upload.fields([
  { name: 'foto', maxCount: 1 },
  { name: 'dni_frente', maxCount: 1 },
  { name: 'dni_dorso', maxCount: 1 },
  { name: 'tutor_frente', maxCount: 1 },
  { name: 'tutor_dorso', maxCount: 1 },
])

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

const FRONTEND_BUILD = path.join(__dirname, '..', '..', 'frontend', 'dist')
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD))
}

app.get('/api/equipos', (req, res) => {
  res.json(db.prepare('SELECT * FROM equipos WHERE activo = 1 ORDER BY federacion, nombre').all())
})

app.post('/api/equipos', (req, res) => {
  const { nombre, federacion } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' })
  const id = uuidv4()
  db.prepare('INSERT INTO equipos (id, nombre, federacion) VALUES (?, ?, ?)').run(id, nombre, federacion || '')
  res.json({ id, nombre, federacion })
})

app.delete('/api/equipos/:id', (req, res) => {
  db.prepare('UPDATE equipos SET activo = 0 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/solicitudes', (req, res) => {
  const { estado } = req.query
  let query = 'SELECT * FROM solicitudes'
  const params = []
  if (estado) { query += ' WHERE estado = ?'; params.push(estado) }
  query += ' ORDER BY created_at DESC'
  res.json(db.prepare(query).all(...params))
})

app.post('/api/solicitudes', (req, res) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    const id = uuidv4()
    const { nombre, apellido, fecha_nac, sexo, numero_doc, vencimiento_doc, equipo,
            tutor_nombre, tutor_apellido, tutor_vinculo, tutor_doc, tutor_venc_doc } = req.body
    const archivo = (k) => req.files?.[k]?.[0]?.filename || null
    try {
      db.prepare(`
        INSERT INTO solicitudes (
          id, nombre, apellido, fecha_nac, sexo, numero_doc, vencimiento_doc, equipo,
          tutor_nombre, tutor_apellido, tutor_vinculo, tutor_doc, tutor_venc_doc,
          archivo_foto, archivo_dni_frente, archivo_dni_dorso, archivo_tutor_frente, archivo_tutor_dorso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, nombre, apellido, fecha_nac, sexo, numero_doc, vencimiento_doc, equipo,
             tutor_nombre, tutor_apellido, tutor_vinculo, tutor_doc, tutor_venc_doc,
             archivo('foto'), archivo('dni_frente'), archivo('dni_dorso'),
             archivo('tutor_frente'), archivo('tutor_dorso'))
      res.json({ id, ok: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
})

app.patch('/api/solicitudes/:id', (req, res) => {
  const { estado, motivo_rechazo } = req.body
  if (!['aprobado', 'rechazado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' })
  db.prepare("UPDATE solicitudes SET estado = ?, motivo_rechazo = ?, updated_at = datetime('now') WHERE id = ?")
    .run(estado, motivo_rechazo || null, req.params.id)
  res.json({ ok: true })
})

app.get('/api/stats', (req, res) => {
  const q = (e) => db.prepare(`SELECT COUNT(*) as n FROM solicitudes WHERE estado = ?`).get(e).n
  res.json({ pendiente: q('pendiente'), aprobado: q('aprobado'), rechazado: q('rechazado') })
})

app.get('*', (req, res) => {
  const index = path.join(FRONTEND_BUILD, 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Frontend no encontrado')
})

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`))
