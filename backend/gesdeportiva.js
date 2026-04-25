const { chromium } = require('playwright')
const path = require('path')

const BASE_URL = 'https://gesdeportiva.cabb.com.ar/clubes'
const LOGIN_URL = `${BASE_URL}/index.aspx`
const COMPONENTES_URL = `${BASE_URL}/es/inscripciones/componentes/index.aspx`
const NUEVO_URL = `${BASE_URL}/es/inscripciones/componentes/nuevo.aspx`

const USUARIO = process.env.GESDEPORTIVA_USER || '39720293'
const CLAVE = process.env.GESDEPORTIVA_PASS || 'Boca1905'
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')

/**
 * Carga un jugador en Gesdeportiva dado el objeto solicitud de la base de datos.
 * @param {object} solicitud - registro de la BD
 * @returns {{ ok: boolean, error?: string }}
 */
async function cargarJugadorEnGesdeportiva(solicitud) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // ── 1. LOGIN ────────────────────────────────────────────────────────────────
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' })

    await page.fill('input[name*="usuario"], input[name*="Usuario"], input[type="text"]', USUARIO)
    await page.fill('input[name*="clave"], input[name*="Clave"], input[type="password"]', CLAVE)

    // Seleccionar tipo "Operador Gesdeportiva"
    await page.selectOption(
      'select[name*="tipo"], select[name*="Tipo"]',
      { label: 'Operador Gesdeportiva' }
    )

    await page.click('input[type="submit"], button[type="submit"]')
    await page.waitForURL(`**\/es\/**`, { timeout: 15000 })

    // ── 2. NAVEGAR AL FORMULARIO NUEVO COMPONENTE ───────────────────────────────
    await page.goto(NUEVO_URL, { waitUntil: 'networkidle' })

    // ── 3. TIPO DE COMPONENTE ───────────────────────────────────────────────────
    // Seleccionar JUGADOR/A
    await page.selectOption(
      'select[id*="TipoComponente"], select[id*="tipocomponente"]',
      { label: 'JUGADOR/A' }
    ).catch(() => {}) // Si ya viene seleccionado, ignorar

    // Asegurar que Activo esté marcado
    const activoCheck = page.locator('input[id*="Activo"], input[id*="activo"]').first()
    if (!(await activoCheck.isChecked().catch(() => false))) {
      await activoCheck.check().catch(() => {})
    }

    // ── 4. DATOS PERSONALES ─────────────────────────────────────────────────────
    await page.fill('input[id*="Nombre"][id*="comp"], input[name*="Nombre"]', solicitud.nombre || '')
    await page.fill('input[id*="Apellido"], input[name*="Apellido"]', solicitud.apellido || '')

    // Sexo
    const sexoVal = solicitud.sexo === 'Mujer' ? 'Mujer' : 'Hombre'
    await page.selectOption(
      'select[id*="Sexo"], select[name*="Sexo"]',
      { label: sexoVal }
    ).catch(() => {})

    // Fecha de nacimiento (formato DD/MM/YYYY)
    if (solicitud.fecha_nac) {
      const [yyyy, mm, dd] = solicitud.fecha_nac.split('-')
      const fechaFormateada = `${dd}/${mm}/${yyyy}`
      await page.fill(
        'input[id*="FechaNac"], input[name*="FechaNac"], input[id*="fechanac"]',
        fechaFormateada
      )
    }

    // Foto del niño/a
    if (solicitud.archivo_foto) {
      const fotoPath = path.join(UPLOADS_DIR, solicitud.archivo_foto)
      await page.locator('input[type="file"][id*="foto"], input[type="file"][id*="Foto"]')
        .first()
        .setInputFiles(fotoPath)
        .catch(() => {})
    }

    // ── 5. DOCUMENTO DEL NIÑO/A ─────────────────────────────────────────────────
    // Tipo de documento: DNI (ya viene por defecto)
    await page.fill(
      'input[id*="NumDoc"], input[id*="numdoc"], input[id*="Documento"]:not([id*="tutor"]):not([id*="Tutor"])',
      solicitud.numero_doc || ''
    )

    // Fecha caducidad
    if (solicitud.vencimiento_doc) {
      const [yyyy, mm, dd] = solicitud.vencimiento_doc.split('-')
      const fechaFormateada = `${dd}/${mm}/${yyyy}`
      await page.fill(
        'input[id*="FechaCad"], input[id*="fechacad"], input[id*="Caducidad"]:not([id*="tutor"]):not([id*="Tutor"])',
        fechaFormateada
      ).catch(() => {})
    }

    // DNI delante del niño/a
    if (solicitud.archivo_dni_frente) {
      const frentePath = path.join(UPLOADS_DIR, solicitud.archivo_dni_frente)
      const fileInputs = page.locator('input[type="file"]')
      const count = await fileInputs.count()
      // El segundo input de archivo suele ser DNI delante
      if (count > 1) {
        await fileInputs.nth(1).setInputFiles(frentePath).catch(() => {})
      }
    }

    // DNI detrás del niño/a
    if (solicitud.archivo_dni_dorso) {
      const dorsoPath = path.join(UPLOADS_DIR, solicitud.archivo_dni_dorso)
      const fileInputs = page.locator('input[type="file"]')
      const count = await fileInputs.count()
      if (count > 2) {
        await fileInputs.nth(2).setInputFiles(dorsoPath).catch(() => {})
      }
    }

    // ── 6. DATOS DEL TUTOR (sección "Sólo para menores de edad") ───────────────
    await page.fill(
      'input[id*="NombreTutor"], input[id*="nombretutor"], input[name*="NombreTutor"]',
      solicitud.tutor_nombre || ''
    ).catch(() => {})

    await page.fill(
      'input[id*="ApellidoTutor"], input[id*="apellidotutor"], input[name*="ApellidoTutor"]',
      solicitud.tutor_apellido || ''
    ).catch(() => {})

    await page.fill(
      'input[id*="DocTutor"], input[id*="doctutor"], input[id*="DocumentoTutor"]',
      solicitud.tutor_doc || ''
    ).catch(() => {})

    // Fecha caducidad tutor
    if (solicitud.tutor_venc_doc) {
      const [yyyy, mm, dd] = solicitud.tutor_venc_doc.split('-')
      const fechaFormateada = `${dd}/${mm}/${yyyy}`
      await page.fill(
        'input[id*="FechaCadTutor"], input[id*="fechacadtutor"], input[id*="CaducidadTutor"]',
        fechaFormateada
      ).catch(() => {})
    }

    // DNI tutor delante
    if (solicitud.archivo_tutor_frente) {
      const frenteTutorPath = path.join(UPLOADS_DIR, solicitud.archivo_tutor_frente)
      const fileInputs = page.locator('input[type="file"]')
      const count = await fileInputs.count()
      if (count > 3) {
        await fileInputs.nth(3).setInputFiles(frenteTutorPath).catch(() => {})
      }
    }

    // DNI tutor detrás
    if (solicitud.archivo_tutor_dorso) {
      const dorsoTutorPath = path.join(UPLOADS_DIR, solicitud.archivo_tutor_dorso)
      const fileInputs = page.locator('input[type="file"]')
      const count = await fileInputs.count()
      if (count > 4) {
        await fileInputs.nth(4).setInputFiles(dorsoTutorPath).catch(() => {})
      }
    }

    // ── 7. INSERTAR COMPONENTE ──────────────────────────────────────────────────
    await page.click('input[value*="Insertar"], button:has-text("Insertar componente"), input[value*="insertar"]')
    await page.waitForTimeout(3000)

    // Verificar que no hay error visible en la página
    const bodyText = await page.textContent('body')
    if (bodyText.toLowerCase().includes('error') || bodyText.toLowerCase().includes('incorrecto')) {
      throw new Error('El sistema devolvió un error al insertar el componente')
    }

    console.log(`✓ Jugador ${solicitud.nombre} ${solicitud.apellido} cargado exitosamente`)
    return { ok: true }

  } catch (err) {
    console.error('Error al cargar jugador en Gesdeportiva:', err.message)
    return { ok: false, error: err.message }
  } finally {
    await browser.close()
  }
}

module.exports = { cargarJugadorEnGesdeportiva }
