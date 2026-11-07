import { useEffect, useState } from 'react'
import { configured, supabase } from './lib/supabase.js'
import { AuthContext } from './lib/auth.jsx'
import { Icon } from './lib/icons.jsx'
import Login from './screens/Login.jsx'
import MenuPublico from './screens/MenuPublico.jsx'
import { Aviso, FaltaConfigurar } from './screens/Aviso.jsx'
import Shell from './Shell.jsx'

export default function App() {
  if (!configured) return <FaltaConfigurar />
  return <ConSesion />
}

function ConSesion() {
  const [sesion, setSesion] = useState(undefined) // undefined = todavía comprobando
  const [perfil, setPerfil] = useState(undefined)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [verLogin, setVerLogin] = useState(false) // false = carta pública, true = formulario de ingreso
  const usuarioId = sesion?.user?.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sesion === undefined) return
    if (!usuarioId) { setPerfil(null); return }
    setPerfil(undefined)
    supabase.from('perfiles').select('*').eq('id', usuarioId).maybeSingle().then(({ data, error }) => {
      if (error) setErrorPerfil(error.message)
      setPerfil(data || null)
    })
  }, [sesion === undefined, usuarioId])

  const salir = () => supabase.auth.signOut()

  if (sesion === undefined || (usuarioId && perfil === undefined)) {
    return <Aviso icono="flame" titulo="Cargando…"><span /></Aviso>
  }
  if (!sesion) {
    return verLogin
      ? <Login onVolver={() => setVerLogin(false)} />
      : <MenuPublico onLogin={() => setVerLogin(true)} />
  }

  if (!perfil || !perfil.activo) {
    return (
      <Aviso titulo="Tu cuenta aún no está activa"
        accion={<button className="btn" onClick={salir}><Icon n="logout" />Cerrar sesión</button>}>
        <p>Entraste como <b>{sesion.user.email}</b>, pero el dueño todavía no te dio acceso.</p>
        <p>Pídele que active tu usuario y vuelve a entrar.</p>
        {errorPerfil && <p className="small">{errorPerfil}</p>}
      </Aviso>
    )
  }

  return (
    <AuthContext.Provider value={{ perfil, sesion, salir }}>
      <Shell />
    </AuthContext.Provider>
  )
}
