import { useState } from 'react'
import { supabase, db, crearClienteTemporal } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { useAuth } from '../lib/auth.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, ExportBtn, useToast } from '../components/ui.jsx'
import { ROLES, rolNombre } from '../lib/format.js'

const color = (rol) => (ROLES.find((r) => r.id === rol) || ROLES[3]).color
const iniciales = (n) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const PERMISOS = [
  ['Tomar pedidos', ['admin', 'cajero', 'mozo']],
  ['Enviar pedidos a cocina', ['admin', 'cajero', 'mozo']],
  ['Cobrar y anular pedidos', ['admin', 'cajero']],
  ['Ver y unir mesas', ['admin', 'cajero', 'mozo']],
  ['Abrir y cerrar caja', ['admin', 'cajero']],
  ['Pantalla de cocina', ['admin', 'cajero', 'cocina']],
  ['Inventario, recetas y mermas', ['admin', 'cocina']],
  ['Cambiar la carta y precios', ['admin']],
  ['Ver reportes', ['admin']],
  ['Administrar usuarios', ['admin']],
]

export default function Usuarios() {
  const { perfiles, recargar } = useData()
  const { perfil } = useAuth()
  const toast = useToast()
  const [nuevo, setNuevo] = useState(null)
  const [ed, setEd] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const activos = perfiles.filter((p) => p.activo).length

  async function crear() {
    const f = nuevo
    if (!f.nombre.trim() || !f.correo.trim() || f.clave.length < 6) return
    setGuardando(true)
    try {
      // Se crea con un cliente temporal para no cerrar tu sesión.
      const temporal = crearClienteTemporal()
      const { data, error } = await temporal.auth.signUp({
        email: f.correo.trim(), password: f.clave, options: { data: { nombre: f.nombre.trim() } },
      })
      if (error) throw error
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
        throw new Error('Ya existe un usuario con ese correo.')
      }
      await db(supabase.rpc('admin_guardar_usuario', { p_id: data.user.id, p_nombre: f.nombre.trim(), p_rol: f.rol, p_activo: true }))
      await recargar()
      setNuevo(null)
      toast('Usuario creado: ' + f.nombre.trim() + ' (' + rolNombre(f.rol).toLowerCase() + ')')
    } catch (e) {
      const msg = String(e.message || '')
      if (/rate limit/i.test(msg)) toast.error('Se crearon demasiados usuarios seguidos. Espera unos minutos e intenta de nuevo.')
      else if (/already registered|ya existe/i.test(msg)) toast.error('Ya existe un usuario con ese correo.')
      else if (/foreign key|violates|no encontr|not found/i.test(msg)) toast.error('El usuario se creó pero falta activarlo. Búscalo en la lista y toca Editar.')
      else toast.error(msg)
    } finally { setGuardando(false) }
  }

  async function guardar() {
    setGuardando(true)
    try {
      await db(supabase.rpc('admin_guardar_usuario', { p_id: ed.id, p_nombre: ed.nombre.trim() || 'Sin nombre', p_rol: ed.rol, p_activo: ed.activo }))
      await recargar(); setEd(null); toast('Cambios guardados')
    } catch (e) { toast.error(e) } finally { setGuardando(false) }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2 className="sec-title grow" style={{ margin: 0 }}><span>Equipo · {activos} activos</span></h2>
        <ExportBtn nombre="usuarios" columnas={['Nombre', 'Rol', 'Estado', 'Creado']}
          filas={perfiles.map((p) => [p.nombre, rolNombre(p.rol), p.activo ? 'Activo' : 'Inactivo', new Date(p.creado).toLocaleDateString('es-BO')])} />
        <button className="btn btn-primary" onClick={() => setNuevo({ nombre: '', correo: '', clave: '', rol: 'mozo' })}><Icon n="userplus" />Nuevo usuario</button>
      </div>

      <div className="users">
        {perfiles.map((p) => (
          <button key={p.id} className="ucard" style={{ opacity: p.activo ? 1 : 0.6, textAlign: 'left' }} onClick={() => setEd({ id: p.id, nombre: p.nombre, rol: p.rol, activo: p.activo })}>
            <div className="avatar" style={{ background: color(p.rol) }}>{iniciales(p.nombre)}</div>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{p.nombre}{p.id === perfil.id ? ' (tú)' : ''}</div>
              <div className="small muted">{rolNombre(p.rol)}</div>
            </div>
            <span className={'pill ' + (p.activo ? 'ok' : '')}>{p.activo ? 'Activo' : 'Inactivo'}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <h2>Qué puede hacer cada rol</h2>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>Estos permisos están protegidos en la base de datos: nadie puede saltárselos.</p>
        <div className="scroll-x">
          <div className="matrix" role="table" aria-label="Permisos por rol">
            <div className="mh" role="columnheader" style={{ alignItems: 'flex-start' }}>Permiso</div>
            {ROLES.map((r) => <div className="mh" role="columnheader" key={r.id}><span>{r.nombre}</span></div>)}
            {PERMISOS.map(([nombre, roles]) => (
              <span key={nombre} style={{ display: 'contents' }}>
                <div role="cell">{nombre}</div>
                {ROLES.map((r) => (
                  <div role="cell" key={r.id}>{roles.includes(r.id) ? <Icon n="check" size={22} /> : <span className="muted">—</span>}</div>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {nuevo && (
        <Modal title="Nuevo usuario" onClose={() => setNuevo(null)}>
          <div className="field"><label htmlFor="u-nom">Nombre completo</label>
            <input id="u-nom" className="input" placeholder="Ej. Jorge Salvatierra" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></div>
          <div className="field"><label htmlFor="u-cor">Correo (con el que entrará)</label>
            <input id="u-cor" className="input" type="email" autoComplete="off" value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} /></div>
          <div className="field"><label htmlFor="u-cla">Contraseña (mínimo 6 caracteres)</label>
            <input id="u-cla" className="input" type="text" autoComplete="off" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} /></div>
          <div className="field"><label>Rol</label>
            <div className="rolepick">
              {ROLES.map((r) => (
                <button key={r.id} aria-pressed={nuevo.rol === r.id} onClick={() => setNuevo({ ...nuevo, rol: r.id })}>{r.nombre}<small>{r.desc}</small></button>
              ))}
            </div></div>
          <button className="btn btn-primary btn-big" disabled={guardando || !nuevo.nombre.trim() || !nuevo.correo.trim() || nuevo.clave.length < 6} onClick={crear}>
            <Icon n="check" size={26} />{guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </Modal>
      )}

      {ed && (
        <Modal title="Editar usuario" onClose={() => setEd(null)}>
          <div className="field"><label htmlFor="e-nom">Nombre</label>
            <input id="e-nom" className="input" value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></div>
          <div className="field"><label>Rol</label>
            <div className="rolepick">
              {ROLES.map((r) => (
                <button key={r.id} aria-pressed={ed.rol === r.id} onClick={() => setEd({ ...ed, rol: r.id })}>{r.nombre}<small>{r.desc}</small></button>
              ))}
            </div></div>
          <div className="splitrow">
            <span style={{ fontWeight: 700 }}>{ed.activo ? 'Puede entrar al sistema' : 'Sin acceso al sistema'}</span>
            <button className="sw-t" role="switch" aria-checked={ed.activo} aria-label="Usuario activo" disabled={ed.id === perfil.id}
              onClick={() => setEd({ ...ed, activo: !ed.activo })} style={{ marginLeft: 'auto' }} />
          </div>
          {ed.id === perfil.id && <p className="muted small">No puedes quitarte el acceso ni cambiar tu propio rol de dueño.</p>}
          <button className="btn btn-primary btn-big" disabled={guardando} onClick={guardar}><Icon n="check" size={26} />Guardar cambios</button>
        </Modal>
      )}
    </div>
  )
}
