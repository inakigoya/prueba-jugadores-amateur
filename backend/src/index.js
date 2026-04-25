const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const multer = require('multer')

const app = express()
const PORT = process.env.PORT || 3001

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(DATA_DIR, { recursive: true })

// ── Base de datos JSON (sin dependencias nativas) ─────────────────────────────
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch {}
  }
  return { solicitudes: [], equipos: [] }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

let db = loadDb()

if (db.equipos.length === 0) {
  db.equipos = [
    { id: 'eq1', nombre: 'Sub-8 Federación A',  federacion: 'Federación A', activo: true },
    { id: 'eq2', nombre: 'Sub-10 Federación A', federacion: 'Federación A', activo: true },
    { id: 'eq3', nombre: 'Sub-12 Federación A', federacion: 'Federación A', activo: true },
    { id: 'eq4', nombre: 'Sub-14 Federación A', federacion: 'Federación A', activo: true },
    { id: 'eq5', nombre: 'Sub-8 Federación B',  federacion: 'Federación B', activo: true },
    { id: 'eq6', nombre: 'Sub-10 Federación B', federacion: 'Federación B', activo: true },
    { id: 'eq7', nombre: 'Sub-12 Federación B', federacion: 'Federación B', activo: true },
  ]
  saveDb(db)
}

// ── Multer ────────────────────────────────────────────────────────────────────
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

// ── Equipos ───────────────────────────────────────────────────────────────────
app.get('/api/equipos', (req, res) => {
  res.json(
    db.equipos
      .filter(e => e.activo)
      .sort((a, b) => a.federacion.localeCompare(b.federacion) || a.nombre.localeCompare(b.nombre))
  )
})

app.post('/api/equipos', (req, res) => {
  const { nombre, federacion } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' })
  const equipo = { id: uuidv4(), nombre, federacion: federacion || '', activo: true }
  db.equipos.push(equipo)
  saveDb(db)
  res.json(equipo)
})

app.delete('/api/equipos/:id', (req, res) => {
  const eq = db.equipos.find(e => e.id === req.params.id)
  if (eq) { eq.activo = false; saveDb(db) }
  res.json({ ok: true })
})

// ── Solicitudes ───────────────────────────────────────────────────────────────
app.get('/api/solicitudes', (req, res) => {
  const { estado } = req.query
  let result = [...db.solicitudes]
  if (estado) result = result.filter(s => s.estado === estado)
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(result)
})

app.post('/api/solicitudes', (req, res) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    const archivo = (k) => req.files?.[k]?.[0]?.filename || null
    const sol = {
      id: uuidv4(),
      estado: 'pendiente',
      motivo_rechazo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      fecha_nac: req.body.fecha_nac,
      sexo: req.body.sexo,
      numero_doc: req.body.numero_doc,
      vencimiento_doc: req.body.vencimiento_doc,
      equipo: req.body.equipo,
      tutor_nombre: req.body.tutor_nombre,
      tutor_apellido: req.body.tutor_apellido,
      tutor_vinculo: req.body.tutor_vinculo,
      tutor_doc: req.body.tutor_doc,
      tutor_venc_doc: req.body.tutor_venc_doc,
      archivo_foto: archivo('foto'),
      archivo_dni_frente: archivo('dni_frente'),
      archivo_dni_dorso: archivo('dni_dorso'),
      archivo_tutor_frente: archivo('tutor_frente'),
      archivo_tutor_dorso: archivo('tutor_dorso'),
    }
    db.solicitudes.push(sol)
    saveDb(db)
    res.json({ id: sol.id, ok: true })
  })
})

app.patch('/api/solicitudes/:id', (req, res) => {
  const { estado, motivo_rechazo } = req.body
  if (!['aprobado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }
  const sol = db.solicitudes.find(s => s.id === req.params.id)
  if (!sol) return res.status(404).json({ error: 'No encontrado' })
  sol.estado = estado
  sol.motivo_rechazo = motivo_rechazo || null
  sol.updated_at = new Date().toISOString()
  saveDb(db)
  res.json({ ok: true })
})

app.get('/api/stats', (req, res) => {
  const count = (e) => db.solicitudes.filter(s => s.estado === e).length
  res.json({ pendiente: count('pendiente'), aprobado: count('aprobado'), rechazado: count('rechazado') })
})

app.get('*', (req, res) => {
  const index = path.join(FRONTEND_BUILD, 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Frontend no encontrado')
})

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`))
