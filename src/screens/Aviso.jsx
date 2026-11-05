import { Icon } from '../lib/icons.jsx'
import logo from '../assets/wordmark.png'

// Pantallas de aviso: falta configurar, cargando, cuenta sin activar.
export function Aviso({ icono = 'alert', titulo, children, accion }) {
  return (
    <div className="login">
      <div className="login-card">
        <img src={logo} alt="Brasa y Carbón" className="login-logo" />
        <div style={{ display: 'grid', placeItems: 'center', color: 'var(--accent-text)' }}><Icon n={icono} size={40} /></div>
        <h1>{titulo}</h1>
        <div className="muted" style={{ textAlign: 'center', display: 'grid', gap: 10 }}>{children}</div>
        {accion}
      </div>
    </div>
  )
}

export function FaltaConfigurar() {
  return (
    <Aviso titulo="Falta conectar la base de datos">
      <p>La aplicación no encontró las dos variables de Supabase.</p>
      <p>En Netlify entra a <b>Site configuration → Environment variables</b> y agrega
        <b> VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b>. Luego vuelve a publicar el sitio.</p>
    </Aviso>
  )
}
