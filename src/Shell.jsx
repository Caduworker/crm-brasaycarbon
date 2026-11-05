import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import { DataProvider, useData } from './lib/data.jsx'
import { Icon } from './lib/icons.jsx'
import { Modal, useToast } from './components/ui.jsx'
import { fechaLarga, rolNombre } from './lib/format.js'
import { supabase } from './lib/supabase.js'
import wordmark from './assets/wordmark.png'
import emblem from './assets/emblem.png'
import Pos from './screens/Pos.jsx'
import Mesas from './screens/Mesas.jsx'
import Caja from './screens/Caja.jsx'
import Menu from './screens/Menu.jsx'
import Inventario from './screens/Inventario.jsx'
import Cocina from './screens/Cocina.jsx'
import Reportes from './screens/Reportes.jsx'
import Usuarios from './screens/Usuarios.jsx'

const NAV = [
  { id: 'venta', label: 'Punto de venta', corto: 'Venta', icono: 'pos', roles: ['admin', 'cajero', 'mozo'], sub: 'Toma pedidos y cobra en segundos' },
  { id: 'mesas', label: 'Mapa de mesas', corto: 'Mesas', icono: 'tables', roles: ['admin', 'cajero', 'mozo'], sub: 'Estado del salón y la terraza en vivo' },
  { id: 'caja', label: 'Cierre de caja', corto: 'Caja', icono: 'cash', roles: ['admin', 'cajero'], sub: 'Arqueo y cierre del turno' },
  { id: 'menu', label: 'Menú y productos', corto: 'Menú', icono: 'book', roles: ['admin'], sub: 'Agrega, edita o quita platos de la carta' },
  { id: 'inventario', label: 'Inventario y recetas', corto: 'Inventario', icono: 'box', roles: ['admin', 'cocina'], sub: 'Existencias, recetas y mermas' },
  { id: 'cocina', label: 'Cocina', corto: 'Cocina', icono: 'flame', roles: ['admin', 'cajero', 'cocina'], sub: 'Tablero de preparación' },
  { id: 'reportes', label: 'Reportes', corto: 'Reportes', icono: 'chart', roles: ['admin'], sub: 'Cómo va el negocio' },
  { id: 'usuarios', label: 'Usuarios y roles', corto: 'Usuarios', icono: 'users', roles: ['admin'], sub: 'Quién entra y qué puede hacer' },
]

const AYUDA = {
  venta: ['Elige si es para una mesa, mostrador, llevar o delivery.', 'Toca los platos para agregarlos. Usa + y − para cambiar la cantidad.', 'Toca Enviar a cocina y luego el botón naranja Cobrar.'],
  mesas: ['Verde es libre, amarillo es ocupada y rojo es por cobrar.', 'Toca una mesa para ver su cuenta o agregar platos.', 'Con Unir cuentas juntas varias mesas en una sola cuenta.'],
  caja: ['Abre la caja con el dinero con que empiezas el turno.', 'Al terminar, cuenta los billetes y monedas con + y −.', 'Toca Cerrar caja. La diferencia se calcula sola.'],
  menu: ['Toca Nuevo plato para agregar algo a la carta.', 'Toca Editar para cambiar nombre, precio, categoría o foto.', 'El basurero quita el plato de la carta; puedes volver a ponerlo.'],
  inventario: ['En Existencias ajusta lo que hay con + y −.', 'En Recetas define lo que lleva cada plato: se descuenta al cobrar.', 'En Mermas anota lo que se pierde: se descuenta del stock.'],
  cocina: ['Cada tarjeta es un pedido. Toca el botón para pasarlo al siguiente paso.', 'El reloj en rojo significa que lleva mucho tiempo.', 'Los deliveries pasan por En camino hasta que se entregan.'],
  reportes: ['Elige Hoy, 7 días o el mes arriba.', 'Las barras muestran cuánto se vendió en cada momento.', 'Usa Exportar a Excel para llevarte los datos.'],
  usuarios: ['Toca Nuevo usuario para dar acceso a alguien del equipo.', 'Elige su rol: dueño, cajero, cocina o mozo.', 'Puedes desactivar a alguien cuando deje de trabajar contigo.'],
}

export default function Shell() {
  return (
    <DataProvider>
      <Interior />
    </DataProvider>
  )
}

function Interior() {
  const { perfil, salir } = useAuth()
  const { mesas, comandas, insumos, cargando, error } = useData()
  const permitidas = useMemo(() => NAV.filter((n) => n.roles.includes(perfil.rol)), [perfil.rol])
  const inicial = permitidas[0].id
  const leer = () => {
    const h = (location.hash || '').slice(1)
    return permitidas.some((n) => n.id === h) ? h : inicial
  }
  const [pantalla, setPantalla] = useState(leer)
  const [pos, setPos] = useState({ tipo: 'mesa', mesa: 1 })
  const [ayuda, setAyuda] = useState(false)
  const [cuenta, setCuenta] = useState(false)
  const [tema, setTema] = useState(null)

  useEffect(() => {
    const f = () => setPantalla(leer())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  })
  const ir = (id) => { setPantalla(id); try { location.hash = id } catch (e) { /* nada */ } }

  const oscuro = tema ? tema === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const cambiarTema = () => {
    const n = oscuro ? 'light' : 'dark'
    setTema(n)
    document.documentElement.setAttribute('data-theme', n)
  }

  const insignias = {
    mesas: mesas.filter((m) => m.estado === 'cobrar').length || null,
    cocina: comandas.filter((c) => c.estado === 'recibido').length || null,
    inventario: insumos.filter((i) => Number(i.stock) < Number(i.minimo)).length || null,
  }
  const actual = NAV.find((n) => n.id === pantalla)

  const boton = (n) => (
    <button key={n.id} aria-current={pantalla === n.id ? 'page' : undefined} onClick={() => ir(n.id)}>
      <Icon n={n.icono} size={24} />
      <span className="lbl-short">{n.corto}</span>
      <span className="lbl-full">{n.label}</span>
      {insignias[n.id] && <span className="badge num">{insignias[n.id]}</span>}
    </button>
  )

  const pantallaActual = () => {
    if (cargando) return <div className="page"><div className="empty"><Icon n="flame" size={40} /><p style={{ marginTop: 10, fontWeight: 700 }}>Cargando…</p></div></div>
    if (error) return <div className="page"><div className="hint err"><Icon n="alert" size={20} />{error}</div></div>
    switch (pantalla) {
      case 'venta': return <Pos pos={pos} setPos={setPos} ir={ir} />
      case 'mesas': return <Mesas setPos={setPos} ir={ir} />
      case 'caja': return <Caja />
      case 'menu': return <Menu />
      case 'inventario': return <Inventario />
      case 'cocina': return <Cocina />
      case 'reportes': return <Reportes />
      case 'usuarios': return <Usuarios />
      default: return null
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img className="wm" src={wordmark} alt="Brasa y Carbón, Restaurant y Churrasquería" />
          <img className="em" src={emblem} alt="Brasa y Carbón" />
        </div>
        <nav aria-label="Pantallas">{permitidas.map(boton)}</nav>
        <button className="who" onClick={() => setCuenta(true)} aria-label="Mi cuenta">
          <div className="av">{(perfil.nombre || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div><b>{perfil.nombre}</b><small>{rolNombre(perfil.rol)} · Mi cuenta</small></div>
        </button>
      </aside>

      <div className="content">
        <header className="top">
          <img className="mobbrand" src={emblem} alt="Brasa y Carbón" />
          <div className="grow">
            <h1>{actual.label}</h1>
            <div className="sub">{fechaLarga()} · {actual.sub}</div>
          </div>
          <button className="iconbtn helpbtn" onClick={() => setAyuda(true)} aria-label="Ayuda de esta pantalla">
            <Icon n="help" /><span>Ayuda</span>
          </button>
          <button className="iconbtn" onClick={cambiarTema} aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
            <Icon n={oscuro ? 'sun' : 'moon'} />
          </button>
          <button className="iconbtn cuentabtn" onClick={() => setCuenta(true)} aria-label="Mi cuenta"><Icon n="users" /></button>
        </header>
        <main className="screen" style={pantalla === 'venta' ? { overflow: 'hidden' } : undefined}>
          {pantallaActual()}
        </main>
      </div>

      <nav className="bnav" aria-label="Pantallas">{permitidas.map(boton)}</nav>

      {ayuda && (
        <Modal title={'Cómo usar: ' + actual.label} onClose={() => setAyuda(false)}>
          <ol className="steps">
            {AYUDA[pantalla].map((t, i) => (<li key={i}><b className="num">{i + 1}</b><span>{t}</span></li>))}
          </ol>
          <button className="btn btn-primary" onClick={() => setAyuda(false)}>Entendido</button>
        </Modal>
      )}
      {cuenta && <MiCuenta onClose={() => setCuenta(false)} salir={salir} />}
    </div>
  )
}

function MiCuenta({ onClose, salir }) {
  const { perfil, sesion } = useAuth()
  const toast = useToast()
  const [clave, setClave] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cambiar() {
    if (clave.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setGuardando(false)
    if (error) { toast.error(error.message); return }
    setClave('')
    toast('Contraseña cambiada')
  }

  return (
    <Modal title="Mi cuenta" onClose={onClose}>
      <div className="row wrap">
        <span className="pill acc">{rolNombre(perfil.rol)}</span>
        <b>{perfil.nombre}</b>
      </div>
      <div className="muted small">{sesion.user.email}</div>
      <div className="field">
        <label htmlFor="nueva-clave">Cambiar mi contraseña</label>
        <input id="nueva-clave" className="input" type="password" autoComplete="new-password" placeholder="Nueva contraseña (mínimo 6 caracteres)"
          value={clave} onChange={(e) => setClave(e.target.value)} />
      </div>
      <button className="btn" disabled={!clave || guardando} onClick={cambiar}><Icon n="key" />Guardar contraseña</button>
      <button className="btn btn-primary" onClick={salir}><Icon n="logout" />Cerrar sesión</button>
    </Modal>
  )
}
