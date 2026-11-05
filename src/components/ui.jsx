import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { descargarExcel } from '../lib/format.js'

/* ---------- Avisos ---------- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)

  const mostrar = useCallback((texto, accion, tipo = 'ok') => {
    setMsg({ texto, accion, tipo })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), accion ? 6500 : tipo === 'error' ? 5000 : 2800)
  }, [])
  const api = useCallback((texto, accion) => mostrar(texto, accion), [mostrar])
  api.error = (e) => {
    const texto = typeof e === 'string' ? e : (e && e.message) || 'Algo salió mal. Intenta de nuevo.'
    mostrar(texto, null, 'error')
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {msg && (
        <div className={'toast' + (msg.tipo === 'error' ? ' toast-error' : '')} role="status">
          <Icon n={msg.tipo === 'error' ? 'alert' : 'check'} size={20} />
          <span>{msg.texto}</span>
          {msg.accion && (
            <button className="toast-act" onClick={() => { msg.accion.fn(); setMsg(null) }}>
              {msg.accion.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

/* ---------- Ventana ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Botón Exportar a Excel ---------- */
export function ExportBtn({ nombre, columnas, filas, label }) {
  const toast = useToast()
  return (
    <button
      className="btn btn-sm"
      onClick={() => { descargarExcel(nombre, columnas, filas); toast('Archivo descargado. Ábrelo con Excel') }}
      disabled={!filas.length}
    >
      <Icon n="sheet" size={20} />
      {label || 'Exportar a Excel'}
    </button>
  )
}

/* ---------- Botones de cantidad ---------- */
export function Stepper({ value, onChange, min = 0, max = 99, nombre = '' }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={'Menos ' + nombre}><Icon n="minus" /></button>
      <span className="num">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={'Más ' + nombre}><Icon n="plus" /></button>
    </div>
  )
}

export function Pantalla({ children }) {
  return <div className="page">{children}</div>
}

export function Vacio({ icono = 'receipt', titulo, texto }) {
  return (
    <div className="empty">
      <Icon n={icono} size={40} />
      {titulo && <p style={{ marginTop: 10, fontWeight: 700 }}>{titulo}</p>}
      {texto && <p className="small">{texto}</p>}
    </div>
  )
}

/* ---------- Foto de plato ---------- */
export function Foto({ p, clase = 'ph' }) {
  const conFoto = Boolean(p.imagen_url)
  return (
    <div className={clase + (conFoto ? '' : ' fb')} role="img" aria-label={p.nombre}>
      {conFoto
        ? <img src={p.imagen_url} alt="" loading="lazy" className="foto-img" />
        : <Icon n={p.icono || 'plate'} size={clase === 'ph' ? 44 : 26} />}
    </div>
  )
}
