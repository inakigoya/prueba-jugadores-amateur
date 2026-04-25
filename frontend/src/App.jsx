import { useState, useEffect } from 'react'

const API = '/api'

const FILE_KEYS = ['foto', 'dni_frente', 'dni_dorso', 'tutor_frente', 'tutor_dorso']
const FILE_LABELS = {
  foto: 'Foto del niño/a',
  dni_frente: 'Frente del documento (niño/a)',
  dni_dorso: 'Dorso del documento (niño/a)',
  tutor_frente: 'Frente del documento (tutor/a)',
  tutor_dorso: 'Dorso del documento (tutor/a)',
}

function StepBar({ current }) {
  const steps = ['Datos del niño/a', 'Datos del tutor/a', 'Documentación']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0,
                background: done ? 'var(--green-bg)' : active ? 'var(--blue-bg)' : 'var(--bg3)',
                color: done ? 'var(--green-text)' : active ? 'var(--blue-text)' : 'var(--text3)',
                border: `0.5px solid ${done ? 'var(--green-border)' : active ? 'var(--blue-border)' : 'var(--border2)'}`,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: 12, color: active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 500 : 400, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border2)', margin: '0 8px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, required, invalid, children }) {
  return (
    <div className={`field${invalid ? ' invalid' : ''}`}>
      <label>{label} {required && <span className="req">*</span>}</label>
      {children}
      <span className="error-text">Requerido</span>
    </div>
  )
}

function UploadZone({ name, file, error, onChange }) {
  return (
    <div className="field">
      <label>{FILE_LABELS[name]} <span className="req">*</span></label>
      <label style={{
        border: `0.5px dashed ${error ? 'var(--red-border)' : file ? 'var(--green-border)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius)', padding: '14px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: 'pointer',
        background: error ? 'var(--red-bg)' : file ? 'var(--green-bg)' : 'var(--bg2)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={file ? 'var(--green-text)' : 'var(--text3)'} strokeWidth="1.4">
          {file
            ? <><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></>
            : <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>}
        </svg>
        <span style={{ fontSize: 12, color: file ? 'var(--green-text)' : 'var(--text2)', textAlign: 'center' }}>
          {file ? file.name : 'Subir imagen'}
        </span>
        <span style={{ fontSize: 11, color: file ? 'var(--green-text)' : 'var(--text3)' }}>JPG · máx. 5 MB</span>
        <input type="file" accept="image/jpeg" style={{ display: 'none' }} onChange={onChange} />
      </label>
      {error && <span style={{ fontSize: 12, color: 'var(--red-text)' }}>{error}</span>}
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState(1)
  const [equipos, setEquipos] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const [nino, setNino] = useState({ nombre: '', apellido: '', fecha_nac: '', sexo: '', numero_doc: '', vencimiento_doc: '', equipo: '' })
  const [tutor, setTutor] = useState({ tutor_nombre: '', tutor_apellido: '', tutor_vinculo: '', tutor_doc: '', tutor_venc_doc: '' })
  const [files, setFiles] = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetch(`${API}/equipos`).then(r => r.json()).then(setEquipos).catch(() => {})
  }, [])

  function validate(fields, required) {
    const e = {}
    required.forEach(k => { if (!fields[k]?.trim?.() && !fields[k]) e[k] = true })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleFile(name, e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'image/jpeg') { setFileErrors(p => ({ ...p, [name]: 'Solo se aceptan JPEG' })); return }
    if (file.size > 5 * 1024 * 1024) { setFileErrors(p => ({ ...p, [name]: 'Máximo 5 MB' })); return }
    setFiles(p => ({ ...p, [name]: file }))
    setFileErrors(p => { const n = { ...p }; delete n[name]; return n })
  }

  function validateFiles() {
    const fe = {}
    FILE_KEYS.forEach(k => { if (!files[k]) fe[k] = 'Requerido' })
    setFileErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function enviar() {
    if (!validateFiles()) return
    setSending(true)
    try {
      const fd = new FormData()
      Object.entries({ ...nino, ...tutor }).forEach(([k, v]) => fd.append(k, v))
      FILE_KEYS.forEach(k => { if (files[k]) fd.append(k, files[k]) })
      const res = await fetch(`${API}/solicitudes`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      alert('Hubo un error al enviar. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setSubmitted(false); setStep(1)
    setNino({ nombre: '', apellido: '', fecha_nac: '', sexo: '', numero_doc: '', vencimiento_doc: '', equipo: '' })
    setTutor({ tutor_nombre: '', tutor_apellido: '', tutor_vinculo: '', tutor_doc: '', tutor_venc_doc: '' })
    setFiles({}); setFileErrors({}); setErrors({})
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green-text)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Solicitud enviada</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          El jugador fue enviado para revisión. Recibirás respuesta a la brevedad.
        </p>
        <button onClick={reset}>Cargar otro jugador</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Nuevo jugador</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Completá los datos y adjuntá la documentación requerida</p>
      </div>

      <StepBar current={step} />

      {step === 1 && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="label">Datos del niño/a</p>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <Field label="Nombre" required invalid={errors.nombre}>
                <input value={nino.nombre} onChange={e => setNino(p => ({ ...p, nombre: e.target.value }))} placeholder="ej. Valentina" />
              </Field>
              <Field label="Apellido" required invalid={errors.apellido}>
                <input value={nino.apellido} onChange={e => setNino(p => ({ ...p, apellido: e.target.value }))} placeholder="ej. García" />
              </Field>
            </div>
            <div className="grid3" style={{ marginBottom: 12 }}>
              <Field label="Fecha de nacimiento" required invalid={errors.fecha_nac}>
                <input type="date" value={nino.fecha_nac} onChange={e => setNino(p => ({ ...p, fecha_nac: e.target.value }))} />
              </Field>
              <Field label="Sexo" required invalid={errors.sexo}>
                <select value={nino.sexo} onChange={e => setNino(p => ({ ...p, sexo: e.target.value }))}>
                  <option value="">Seleccionar</option>
                  <option>Mujer</option>
                  <option>Hombre</option>
                </select>
              </Field>
              <Field label="Equipo" required invalid={errors.equipo}>
                <select value={nino.equipo} onChange={e => setNino(p => ({ ...p, equipo: e.target.value }))}>
                  <option value="">Seleccionar</option>
                  {equipos.map(eq => <option key={eq.id} value={eq.nombre}>{eq.nombre}</option>)}
                </select>
              </Field>
            </div>
            <hr className="divider" />
            <p className="label">Documento del niño/a</p>
            <div className="grid2">
              <Field label="Número de documento" required invalid={errors.numero_doc}>
                <input value={nino.numero_doc} onChange={e => setNino(p => ({ ...p, numero_doc: e.target.value }))} placeholder="ej. 45123456" />
              </Field>
              <Field label="Vencimiento del documento" required invalid={errors.vencimiento_doc}>
                <input type="date" value={nino.vencimiento_doc} onChange={e => setNino(p => ({ ...p, vencimiento_doc: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}><span className="req">*</span> Campos obligatorios</span>
            <button className="btn-primary" onClick={() => {
              if (validate(nino, ['nombre', 'apellido', 'fecha_nac', 'sexo', 'numero_doc', 'vencimiento_doc', 'equipo'])) setStep(2)
            }}>Siguiente →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="label">Datos del tutor/a</p>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <Field label="Nombre" required invalid={errors.tutor_nombre}>
                <input value={tutor.tutor_nombre} onChange={e => setTutor(p => ({ ...p, tutor_nombre: e.target.value }))} placeholder="ej. Marcela" />
              </Field>
              <Field label="Apellido" required invalid={errors.tutor_apellido}>
                <input value={tutor.tutor_apellido} onChange={e => setTutor(p => ({ ...p, tutor_apellido: e.target.value }))} placeholder="ej. García" />
              </Field>
            </div>
            <div className="grid3">
              <Field label="Vínculo" required invalid={errors.tutor_vinculo}>
                <select value={tutor.tutor_vinculo} onChange={e => setTutor(p => ({ ...p, tutor_vinculo: e.target.value }))}>
                  <option value="">Seleccionar</option>
                  <option>Madre</option>
                  <option>Padre</option>
                  <option>Tutor/a</option>
                </select>
              </Field>
              <Field label="Número de documento" required invalid={errors.tutor_doc}>
                <input value={tutor.tutor_doc} onChange={e => setTutor(p => ({ ...p, tutor_doc: e.target.value }))} placeholder="ej. 28456789" />
              </Field>
              <Field label="Vencimiento del documento">
                <input type="date" value={tutor.tutor_venc_doc} onChange={e => setTutor(p => ({ ...p, tutor_venc_doc: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)}>← Volver</button>
            <button className="btn-primary" onClick={() => {
              if (validate(tutor, ['tutor_nombre', 'tutor_apellido', 'tutor_vinculo', 'tutor_doc'])) setStep(3)
            }}>Siguiente →</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="label">Documentación — solo archivos JPEG</p>
            <div className="grid2">
              {FILE_KEYS.map(name => (
                <UploadZone key={name} name={name} file={files[name]} error={fileErrors[name]}
                  onChange={e => handleFile(name, e)} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)}>← Volver</button>
            <button className="btn-primary" onClick={enviar} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar para revisión'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
