import { useState, useEffect, useCallback } from 'react'

const API = '/api'

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Initials({ name }) {
  const parts = (name || '').split(' ')
  const ini = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (
    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--blue-bg)', color: 'var(--blue-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
      {ini.toUpperCase()}
    </div>
  )
}

function DocThumb({ label, filename }) {
  const src = filename ? `/uploads/${filename}` : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <a href={src || '#'} target="_blank" rel="noreferrer" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        aspectRatio: '4/3', borderRadius: 'var(--radius)', textDecoration: 'none',
        border: `0.5px solid ${src ? 'var(--blue-border)' : 'var(--border)'}`,
        background: src ? 'var(--blue-bg)' : 'var(--bg2)', cursor: src ? 'pointer' : 'default',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={src ? 'var(--blue-text)' : 'var(--text3)'} strokeWidth="1.4">
          <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
        <span style={{ fontSize: 10, color: src ? 'var(--blue-text)' : 'var(--text3)', textAlign: 'center', padding: '0 4px' }}>
          {src ? 'Ver' : 'Sin archivo'}
        </span>
      </a>
      <span style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function DataRow({ label, value }) {
  return (
    <div style={{ padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value || '—'}</div>
    </div>
  )
}

function GesdeportivaStatus({ sol, onRetry }) {
  if (sol.estado !== 'aprobado') return null
  const { gesdeportiva_ok, gesdeportiva_error } = sol

  if (gesdeportiva_ok === null || gesdeportiva_ok === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--amber-bg)', border: '0.5px solid var(--amber-border)', marginTop: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber-text)', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--amber-text)', fontWeight: 500 }}>Cargando en Gesdeportiva…</div>
          <div style={{ fontSize: 12, color: 'var(--amber-text)', opacity: .8 }}>El proceso está corriendo en segundo plano</div>
        </div>
        <button onClick={onRetry} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--amber-text)', borderColor: 'var(--amber-border)', background: 'transparent' }}>↻ Actualizar</button>
      </div>
    )
  }

  if (gesdeportiva_ok === true) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--green-bg)', border: '0.5px solid var(--green-border)', marginTop: 12 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green-text)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 13, color: 'var(--green-text)', fontWeight: 500 }}>Cargado exitosamente en Gesdeportiva ✓</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--red-bg)', border: '0.5px solid var(--red-border)', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red-text)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <span style={{ fontSize: 13, color: 'var(--red-text)', fontWeight: 500 }}>Error al cargar en Gesdeportiva</span>
      </div>
      {gesdeportiva_error && (
        <div style={{ fontSize: 12, color: 'var(--red-text)', opacity: .85, marginBottom: 8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '6px 8px', borderRadius: 4 }}>
          {gesdeportiva_error}
        </div>
      )}
      <button className="btn-danger" onClick={onRetry} style={{ fontSize: 12, padding: '5px 14px' }}>↻ Reintentar carga</button>
    </div>
  )
}

function SolicitudCard({ sol, onAction }) {
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [showMotivo, setShowMotivo] = useState(false)
  const [loading, setLoading] = useState(false)

  async function action(estado) {
    if (estado === 'rechazado' && !motivo.trim()) { setShowMotivo(true); return }
    setLoading(true)
    try {
      await fetch(`${API}/solicitudes/${sol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, motivo_rechazo: motivo }),
      })
      onAction()
    } finally { setLoading(false) }
  }

  async function reintentar() {
    setLoading(true)
    try {
      await fetch(`${API}/solicitudes/${sol.id}/reintentar`, { method: 'POST' })
      setTimeout(onAction, 3000)
    } finally { setLoading(false) }
  }

  const badgeClass = sol.estado === 'pendiente' ? 'badge-pending' : sol.estado === 'aprobado' ? 'badge-approved' : 'badge-rejected'
  const badgeLabel = sol.estado === 'pendiente' ? 'Pendiente' : sol.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'

  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden', border: open ? '0.5px solid var(--border2)' : undefined }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <Initials name={`${sol.nombre} ${sol.apellido}`} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{sol.nombre} {sol.apellido}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sol.equipo} · {formatDate(sol.created_at)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sol.estado === 'aprobado' && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 500,
              background: sol.gesdeportiva_ok === true ? 'var(--green-bg)' : sol.gesdeportiva_ok === false ? 'var(--red-bg)' : 'var(--amber-bg)',
              color: sol.gesdeportiva_ok === true ? 'var(--green-text)' : sol.gesdeportiva_ok === false ? 'var(--red-text)' : 'var(--amber-text)',
            }}>
              {sol.gesdeportiva_ok === true ? 'GD ✓' : sol.gesdeportiva_ok === false ? 'GD ✗' : 'GD…'}
            </span>
          )}
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text3)" strokeWidth="1.5"
          style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </div>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--border)', padding: 16 }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', fontWeight: 500, marginBottom: 10 }}>Datos del niño/a</p>
          <div className="grid2" style={{ marginBottom: 14 }}>
            <DataRow label="Nombre" value={sol.nombre} />
            <DataRow label="Apellido" value={sol.apellido} />
            <DataRow label="Fecha de nacimiento" value={sol.fecha_nac} />
            <DataRow label="Sexo" value={sol.sexo} />
            <DataRow label="Documento" value={sol.numero_doc} />
            <DataRow label="Vencimiento doc." value={sol.vencimiento_doc} />
            <DataRow label="Equipo" value={sol.equipo} />
          </div>

          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', fontWeight: 500, marginBottom: 10 }}>Datos del tutor/a</p>
          <div className="grid2" style={{ marginBottom: 14 }}>
            <DataRow label="Nombre" value={sol.tutor_nombre} />
            <DataRow label="Apellido" value={sol.tutor_apellido} />
            <DataRow label="Vínculo" value={sol.tutor_vinculo} />
            <DataRow label="Documento" value={sol.tutor_doc} />
            {sol.tutor_venc_doc && <DataRow label="Vencimiento doc." value={sol.tutor_venc_doc} />}
          </div>

          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', fontWeight: 500, marginBottom: 10 }}>Documentación adjunta</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
            <DocThumb label="Foto" filename={sol.archivo_foto} />
            <DocThumb label="DNI frente" filename={sol.archivo_dni_frente} />
            <DocThumb label="DNI dorso" filename={sol.archivo_dni_dorso} />
            <DocThumb label="Tutor frente" filename={sol.archivo_tutor_frente} />
            <DocThumb label="Tutor dorso" filename={sol.archivo_tutor_dorso} />
          </div>

          <GesdeportivaStatus sol={sol} onRetry={() => { reintentar(); setTimeout(onAction, 3000) }} />

          {sol.estado === 'pendiente' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn-success" onClick={() => action('aprobado')} disabled={loading}>Aprobar y cargar</button>
              <button className="btn-danger" onClick={() => setShowMotivo(true)} disabled={loading}>Rechazar</button>
              {showMotivo && <>
                <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo del rechazo…"
                  style={{ flex: 1, minWidth: 180 }} onKeyDown={e => e.key === 'Enter' && action('rechazado')} />
                <button onClick={() => action('rechazado')} disabled={loading || !motivo.trim()}>Confirmar</button>
              </>}
            </div>
          )}

          {sol.estado === 'rechazado' && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 13, marginTop: 12 }}>
              Rechazado — {sol.motivo_rechazo || 'sin motivo especificado'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EquiposModal({ onClose }) {
  const [equipos, setEquipos] = useState([])
  const [nombre, setNombre] = useState('')
  const [fed, setFed] = useState('')
  const load = () => fetch(`${API}/equipos`).then(r => r.json()).then(setEquipos)
  useEffect(() => { load() }, [])
  async function agregar() {
    if (!nombre.trim()) return
    await fetch(`${API}/equipos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), federacion: fed.trim() }) })
    setNombre(''); setFed(''); load()
  }
  async function eliminar(id) { await fetch(`${API}/equipos/${id}`, { method: 'DELETE' }); load() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', zIndex: 100 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 500, width: '100%', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 500 }}>Gestión de equipos</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text2)', padding: 0 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: '1rem' }}>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del equipo" onKeyDown={e => e.key === 'Enter' && agregar()} />
          <input value={fed} onChange={e => setFed(e.target.value)} placeholder="Federación (opcional)" />
          <button className="btn-primary" onClick={agregar}>Agregar</button>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {equipos.map(eq => (
            <div key={eq.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13 }}>{eq.nombre}</div>
                {eq.federacion && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{eq.federacion}</div>}
              </div>
              <button onClick={() => eliminar(eq.id)} style={{ fontSize: 11, color: 'var(--red-text)', borderColor: 'var(--red-border)', padding: '3px 10px' }}>Quitar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Panel() {
  const [solicitudes, setSolicitudes] = useState([])
  const [stats, setStats] = useState({ pendiente: 0, aprobado: 0, rechazado: 0 })
  const [filtro, setFiltro] = useState('todos')
  const [showEquipos, setShowEquipos] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const load = useCallback(() => {
    const q = filtro !== 'todos' ? `?estado=${filtro}` : ''
    fetch(`${API}/solicitudes${q}`).then(r => r.json()).then(setSolicitudes)
    fetch(`${API}/stats`).then(r => r.json()).then(setStats)
  }, [filtro])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasPending = solicitudes.some(s => s.estado === 'aprobado' && (s.gesdeportiva_ok === null || s.gesdeportiva_ok === undefined))
    setAutoRefresh(hasPending)
  }, [solicitudes])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, load])

  const filtros = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'aprobado', label: 'Aprobados' },
    { key: 'rechazado', label: 'Rechazados' },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1rem' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      {showEquipos && <EquiposModal onClose={() => setShowEquipos(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Panel de revisión</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>
            Revisá y aprobá las solicitudes antes de cargarlas al sistema
            {autoRefresh && <span style={{ marginLeft: 8, color: 'var(--amber-text)', fontSize: 12 }}>● Actualizando…</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEquipos(true)} style={{ fontSize: 13 }}>Gestionar equipos</button>
          <button onClick={load} style={{ fontSize: 13 }}>↻ Actualizar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Pendientes', val: stats.pendiente, color: 'var(--amber-text)' },
          { label: 'Aprobados', val: stats.aprobado, color: 'var(--green-text)' },
          { label: 'Rechazados', val: stats.rechazado, color: 'var(--red-text)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {filtros.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            fontSize: 12, padding: '5px 14px', borderRadius: 20,
            background: filtro === f.key ? 'var(--blue-bg)' : 'transparent',
            color: filtro === f.key ? 'var(--blue-text)' : 'var(--text2)',
            borderColor: filtro === f.key ? 'var(--blue-border)' : 'var(--border2)',
          }}>{f.label}</button>
        ))}
      </div>

      {solicitudes.length === 0
        ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 14 }}>No hay solicitudes en esta categoría</div>
        : solicitudes.map(sol => <SolicitudCard key={sol.id} sol={sol} onAction={load} />)
      }
    </div>
  )
}
