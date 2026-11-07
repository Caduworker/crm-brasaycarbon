import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Icon } from '../lib/icons.jsx'
import logo from '../assets/wordmark.png'

export default function Login({ onVolver }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    setCargando(false)
    if (error) setError('El correo o la contraseña no son correctos.')
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={entrar}>
        <img src={logo} alt="Brasa y Carbón, Restaurant y Churrasquería" className="login-logo" />
        <h1>Iniciar sesión</h1>
        <div className="field">
          <label htmlFor="correo">Correo</label>
          <input id="correo" className="input" type="email" autoComplete="username" required
            value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" className="input" type="password" autoComplete="current-password" required
            value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        {error && <div className="hint err" role="alert"><Icon n="alert" size={20} />{error}</div>}
        <button className="btn btn-primary btn-big" disabled={cargando}>
          <Icon n="lock" size={24} />{cargando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted small" style={{ textAlign: 'center' }}>
          ¿No tienes acceso? Pídelo al dueño del restaurante.
        </p>
        {onVolver && <button type="button" className="btn" onClick={onVolver}>← Volver a la carta</button>}
      </form>
    </div>
  )
}
