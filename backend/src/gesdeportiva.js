/**
 * Integración con Gesdeportiva via HTTP directo (sin Playwright).
 * Simula el login y el envío del formulario de nuevo componente.
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { URLSearchParams } = require('url')

const BASE = 'https://gesdeportiva.cabb.com.ar/clubes'
const USUARIO = process.env.GESDEPORTIVA_USER || '39720293'
const CLAVE   = process.env.GESDEPORTIVA_PASS  || 'Boca1905'
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
const TIMEOUT_MS = 30000

// ── Utilidades HTTP ───────────────────────────────────────────────────────────

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout de red')), TIMEOUT_MS)
    const mod = options.protocol === 'http:' ? http : https
    const req = mod.request(options, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        clearTimeout(timer)
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', e => { clearTimeout(timer); reject(e) })
    if (body) req.write(body)
    req.end()
  })
}

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return {}
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
  const cookies = {}
  arr.forEach(h => {
    const part = h.split(';')[0]
    const [k, v] = part.split('=')
    if (k) cookies[k.trim()] = (v || '').trim()
  })
  return cookies
}

function cookieString(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function extractViewState(html) {
  const match = html.match(/id="__VIEWSTATE"\s+value="([^"]*)"/)
  return match ? match[1] : ''
}

function extractEventValidation(html) {
  const match = html.match(/id="__EVENTVALIDATION"\s+value="([^"]*)"/)
  return match ? match[1] : ''
}

function extractViewStateGenerator(html) {
  const match = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/)
  return match ? match[1] : ''
}

function urlOf(p) {
  const u = new URL(BASE + p)
  return { hostname: u.hostname, path: u.pathname + u.search, protocol: u.protocol }
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login() {
  const loginPath = '/index.aspx'
  const base = urlOf(loginPath)

  // GET login para obtener ViewState
  const get = await request({
    hostname: base.hostname,
    path: base.path,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    protocol: base.protocol,
  })

  let cookies = parseCookies(get.headers['set-cookie'])
  const vs = extractViewState(get.body)
  const evv = extractEventValidation(get.body)
  const vsg = extractViewStateGenerator(get.body)

  // Extraer nombres de campos del form
  const usuarioMatch = get.body.match(/name="([^"]*[Uu]suario[^"]*)"/)
  const claveMatch   = get.body.match(/name="([^"]*[Cc]lave[^"]*|[^"]*[Pp]ass[^"]*)"/)
  const tipoMatch    = get.body.match(/name="([^"]*[Tt]ipo[^"]*)"/)
  const btnMatch     = get.body.match(/name="([^"]*[Bb]tn[^"]*|[^"]*[Ss]ubmit[^"]*)"[^>]*type="submit"/i)

  const usuarioField = usuarioMatch ? usuarioMatch[1] : 'ctl00$ContentPlaceHolder1$txtUsuario'
  const claveField   = claveMatch   ? claveMatch[1]   : 'ctl00$ContentPlaceHolder1$txtClave'
  const tipoField    = tipoMatch    ? tipoMatch[1]    : 'ctl00$ContentPlaceHolder1$ddlTipo'
  const btnField     = btnMatch     ? btnMatch[1]     : 'ctl00$ContentPlaceHolder1$btnIngresar'

  const params = new URLSearchParams({
    '__VIEWSTATE': vs,
    '__VIEWSTATEGENERATOR': vsg,
    '__EVENTVALIDATION': evv,
    [usuarioField]: USUARIO,
    [claveField]: CLAVE,
    [tipoField]: '3', // Operador Gesdeportiva = valor 3 típicamente
    [btnField]: 'Ingresar',
  })

  const body = params.toString()

  const post = await request({
    hostname: base.hostname,
    path: base.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Cookie': cookieString(cookies),
      'User-Agent': 'Mozilla/5.0',
      'Referer': BASE + loginPath,
    },
    protocol: base.protocol,
  }, body)

  // Seguir redirect si lo hay
  const newCookies = parseCookies(post.headers['set-cookie'])
  cookies = { ...cookies, ...newCookies }

  if (post.status === 302 || post.status === 301) {
    const loc = post.headers['location']
    if (loc && !loc.includes('index.aspx')) {
      return { ok: true, cookies }
    }
  }

  // Verificar que no volvimos al login
  if (post.body.includes('txtClave') || post.body.includes('txtUsuario')) {
    throw new Error('Login fallido: credenciales incorrectas o campo de login no encontrado')
  }

  return { ok: true, cookies }
}

// ── Cargar jugador ────────────────────────────────────────────────────────────

async function cargarJugadorEnGesdeportiva(solicitud) {
  try {
    console.log(`[GD] Iniciando login para ${solicitud.nombre} ${solicitud.apellido}`)

    const { cookies } = await login()
    console.log('[GD] Login OK, obteniendo formulario...')

    const nuevoPath = '/es/inscripciones/componentes/nuevo.aspx'
    const base = urlOf(nuevoPath)

    // GET formulario nuevo componente
    const getForm = await request({
      hostname: base.hostname,
      path: base.path,
      method: 'GET',
      headers: {
        'Cookie': cookieString(cookies),
        'User-Agent': 'Mozilla/5.0',
      },
      protocol: base.protocol,
    })

    if (getForm.status === 302 || getForm.body.includes('index.aspx')) {
      throw new Error('Sesión no iniciada correctamente — redirigido al login')
    }

    console.log('[GD] Formulario obtenido, preparando datos...')

    const vs2  = extractViewState(getForm.body)
    const evv2 = extractEventValidation(getForm.body)
    const vsg2 = extractViewStateGenerator(getForm.body)

    const newCookies = parseCookies(getForm.headers['set-cookie'])
    const sessionCookies = { ...cookies, ...newCookies }

    // Formato fecha DD/MM/YYYY
    function toDisplayDate(isoDate) {
      if (!isoDate) return ''
      const [y, m, d] = isoDate.split('-')
      return `${d}/${m}/${y}`
    }

    // Construir campos del formulario
    // Los IDs reales de ASP.NET suelen tener prefijo ctl00$ContentPlaceHolder1$
    const P = 'ctl00$ContentPlaceHolder1$'
    const formData = new URLSearchParams({
      '__VIEWSTATE': vs2,
      '__VIEWSTATEGENERATOR': vsg2,
      '__EVENTVALIDATION': evv2,
      // Tipo y estado
      [`${P}ddlTipoComponente`]: 'JUG',   // valor para JUGADOR/A
      [`${P}chkActivo`]: 'on',
      // Datos personales
      [`${P}txtNombre`]: solicitud.nombre || '',
      [`${P}txtApellidos`]: solicitud.apellido || '',
      [`${P}ddlSexo`]: solicitud.sexo === 'Mujer' ? 'F' : 'M',
      [`${P}txtFechaNacimiento`]: toDisplayDate(solicitud.fecha_nac),
      [`${P}ddlNacionalidad`]: 'ARG',
      // Documento niño/a
      [`${P}ddlTipoDocumento`]: 'DNI',
      [`${P}txtDocumento`]: solicitud.numero_doc || '',
      [`${P}txtFechaCaducidad`]: toDisplayDate(solicitud.vencimiento_doc),
      [`${P}ddlPaisNacimiento`]: 'ARG',
      [`${P}ddlProvinciaNacimiento`]: '1', // CABA
      // Tutor
      [`${P}txtNombreTutor`]: solicitud.tutor_nombre || '',
      [`${P}txtApellidosTutor`]: solicitud.tutor_apellido || '',
      [`${P}txtDocumentoTutor`]: solicitud.tutor_doc || '',
      [`${P}txtFechaCaducidadTutor`]: toDisplayDate(solicitud.tutor_venc_doc),
      // Otras flags
      [`${P}chkNoExtranjero`]: 'on',
      [`${P}chkJugador`]: 'on',
      // Botón submit
      [`${P}btnInsertar`]: 'Insertar componente',
    })

    const formBody = formData.toString()

    console.log('[GD] Enviando formulario...')

    const postForm = await request({
      hostname: base.hostname,
      path: base.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody),
        'Cookie': cookieString(sessionCookies),
        'User-Agent': 'Mozilla/5.0',
        'Referer': BASE + nuevoPath,
      },
      protocol: base.protocol,
    }, formBody)

    console.log(`[GD] Respuesta del servidor: HTTP ${postForm.status}`)

    // Verificar resultado
    const responseBody = postForm.body.toLowerCase()
    if (
      postForm.status === 302 ||
      responseBody.includes('componente insertado') ||
      responseBody.includes('guardado') ||
      responseBody.includes('correcto') ||
      (postForm.status === 200 && !responseBody.includes('error') && !responseBody.includes('incorrecto'))
    ) {
      console.log(`[GD] ✓ Jugador ${solicitud.nombre} ${solicitud.apellido} insertado correctamente`)
      return { ok: true }
    }

    // Buscar mensaje de error específico en la página
    const errorMatch = postForm.body.match(/class="[^"]*error[^"]*"[^>]*>([^<]{5,200})</i)
    const errorMsg = errorMatch ? errorMatch[1].trim() : `Respuesta inesperada HTTP ${postForm.status}`
    throw new Error(errorMsg)

  } catch (err) {
    console.error(`[GD] ✗ Error: ${err.message}`)
    return { ok: false, error: err.message }
  }
}

module.exports = { cargarJugadorEnGesdeportiva }
