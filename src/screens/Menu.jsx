import { useRef, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, ExportBtn, Foto, useToast } from '../components/ui.jsx'
import { aNumero, bs } from '../lib/format.js'

// Reduce la foto antes de subirla para que cargue rápido en el celular.
function reducirImagen(archivo, lado = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(archivo)
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar la foto'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ese archivo no es una imagen')) }
    img.src = url
  })
}

export default function Menu() {
  const { productos, categorias, recargar } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('todas')
  const [ed, setEd] = useState(null)
  const [quitando, setQuitando] = useState(false)
  const [verCats, setVerCats] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const archivo = useRef(null)

  const nombreCat = (id) => (categorias.find((c) => c.id === id) || {}).nombre || ''
  const activos = productos.filter((p) => p.activo)
  const quitados = productos.filter((p) => !p.activo)
  const mostrados = activos.filter((p) => (cat === 'todas' || p.categoria_id === cat) && (!q || p.nombre.toLowerCase().includes(q.toLowerCase())))

  async function guardar() {
    const precio = aNumero(ed.precio)
    if (!ed.nombre.trim() || !(precio >= 0) || !ed.categoria_id) return
    const fila = { nombre: ed.nombre.trim(), detalle: ed.detalle.trim() || 'Porción', categoria_id: ed.categoria_id, precio, imagen_url: ed.imagen_url || null }
    try {
      if (ed.id) await db(supabase.from('productos').update(fila).eq('id', ed.id))
      else await db(supabase.from('productos').insert({ ...fila, orden: productos.length + 1 }))
      toast(ed.id ? 'Cambios guardados en ' + fila.nombre : fila.nombre + ' ya está en la carta')
      setEd(null); setQuitando(false)
      await recargar()
    } catch (e) { toast.error(e) }
  }

  async function poner(p, activo) {
    try {
      await db(supabase.from('productos').update({ activo }).eq('id', p.id))
      await recargar()
      toast(activo ? p.nombre + ' volvió a la carta' : p.nombre + ' se quitó de la carta',
        activo ? null : { label: 'Deshacer', fn: () => poner(p, true) })
    } catch (e) { toast.error(e) }
  }

  async function subirFoto(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setSubiendo(true)
    try {
      const blob = await reducirImagen(f)
      const ruta = 'plato-' + Date.now() + '.jpg'
      const { error } = await supabase.storage.from('productos').upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (error) throw error
      const { data } = supabase.storage.from('productos').getPublicUrl(ruta)
      setEd((x) => ({ ...x, imagen_url: data.publicUrl }))
      toast('Foto subida')
    } catch (err) {
      toast.error('No se pudo subir la foto. ' + (err.message || ''))
    } finally { setSubiendo(false) }
  }

  const filasExcel = productos.map((p) => [p.nombre, nombreCat(p.categoria_id), p.detalle, Number(p.precio), p.activo ? 'En carta' : 'Quitado'])
  const nuevo = () => setEd({ id: null, nombre: '', detalle: '', categoria_id: categorias[0]?.id, precio: '', imagen_url: null })
  const precioOk = ed && aNumero(ed.precio) >= 0

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search" style={{ minWidth: 220, flex: '1 1 240px' }}>
          <Icon n="search" size={20} />
          <input className="input" placeholder="Buscar un plato…" aria-label="Buscar plato" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-sm" onClick={() => setVerCats(true)}><Icon n="tag" size={20} />Categorías</button>
        <ExportBtn nombre="carta" columnas={['Plato', 'Categoría', 'Detalle', 'Precio (Bs)', 'Estado']} filas={filasExcel} />
        <button className="btn btn-primary" onClick={nuevo}><Icon n="plus" />Nuevo plato</button>
      </div>

      <div className="chips" role="group" aria-label="Categorías">
        <button className="chip" aria-pressed={cat === 'todas'} onClick={() => setCat('todas')}>Todas<span className="cnt num">{activos.length}</span></button>
        {categorias.map((c) => (
          <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.nombre}<span className="cnt num">{activos.filter((p) => p.categoria_id === c.id).length}</span>
          </button>
        ))}
      </div>

      {categorias.filter((c) => mostrados.some((p) => p.categoria_id === c.id)).map((c) => (
        <section key={c.id}>
          <h2 className="sec-title"><span>{c.nombre}</span><small>{mostrados.filter((p) => p.categoria_id === c.id).length} platos</small></h2>
          <div className="card tablecard">
            {mostrados.filter((p) => p.categoria_id === c.id).map((p) => (
              <div className="prow" key={p.id}>
                <Foto p={p} clase="thumb" />
                <div className="grow"><div style={{ fontWeight: 700 }}>{p.nombre}</div><div className="small muted">{p.detalle}</div></div>
                <b className="pprice num">{bs(p.precio)}</b>
                <button className="btn btn-sm" onClick={() => setEd({ ...p, precio: String(p.precio) })} aria-label={'Editar ' + p.nombre}>
                  <Icon n="edit" size={20} /><span className="hide-s">Editar</span>
                </button>
                <button className="minibtn" onClick={() => poner(p, false)} aria-label={'Quitar ' + p.nombre + ' de la carta'}><Icon n="trash" /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {mostrados.length === 0 && <div className="empty card">No hay platos que coincidan. Prueba con otra palabra o agrega uno nuevo.</div>}

      {quitados.length > 0 && (
        <section>
          <h2 className="sec-title"><span>Quitados de la carta</span><small>{quitados.length}</small></h2>
          <div className="card tablecard">
            {quitados.map((p) => (
              <div className="prow off" key={p.id}>
                <Foto p={p} clase="thumb" />
                <div className="grow"><div style={{ fontWeight: 700 }}>{p.nombre}</div><div className="small muted">{bs(p.precio)}</div></div>
                <button className="btn btn-sm" onClick={() => poner(p, true)}><Icon n="undo" size={20} />Volver a la carta</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {ed && !quitando && (
        <Modal title={ed.id ? 'Editar plato' : 'Nuevo plato'} onClose={() => setEd(null)}>
          <div className="foto-edit">
            <Foto p={{ ...ed, icono: (categorias.find((c) => c.id === ed.categoria_id) || {}).icono }} clase="thumb big" />
            <div className="grow" style={{ display: 'grid', gap: 8 }}>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={subirFoto} />
              <button className="btn btn-sm" disabled={subiendo} onClick={() => archivo.current.click()}>
                <Icon n="camera" size={20} />{subiendo ? 'Subiendo…' : ed.imagen_url ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {ed.imagen_url && <button className="btn btn-sm" onClick={() => setEd({ ...ed, imagen_url: null })}>Quitar foto</button>}
            </div>
          </div>
          <div className="field"><label htmlFor="p-nom">Nombre</label>
            <input id="p-nom" className="input" placeholder="Ej. Anticucho de corazón" value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></div>
          <div className="field"><label htmlFor="p-det">Detalle (opcional)</label>
            <input id="p-det" className="input" placeholder="Ej. 250 gr" value={ed.detalle} onChange={(e) => setEd({ ...ed, detalle: e.target.value })} /></div>
          <div className="field"><label>Categoría</label>
            <div className="chips wrapchips">
              {categorias.map((c) => (
                <button key={c.id} className="chip" aria-pressed={ed.categoria_id === c.id} onClick={() => setEd({ ...ed, categoria_id: c.id })}>{c.nombre}</button>
              ))}
            </div></div>
          <div className="field"><label htmlFor="p-pre">Precio (Bs)</label>
            <div className="row">
              <input id="p-pre" className="input num" inputMode="decimal" placeholder="0" value={ed.precio} onChange={(e) => setEd({ ...ed, precio: e.target.value })} />
              <div className="stepper">
                <button onClick={() => setEd({ ...ed, precio: String(Math.max(0, (aNumero(ed.precio) || 0) - 1)) })} aria-label="Bajar 1 boliviano"><Icon n="minus" /></button>
                <button onClick={() => setEd({ ...ed, precio: String((aNumero(ed.precio) || 0) + 1) })} aria-label="Subir 1 boliviano"><Icon n="plus" /></button>
              </div>
            </div></div>
          <div className="row wrap">
            {ed.id && <button className="btn danger" style={{ flex: '1 1 160px' }} onClick={() => setQuitando(true)}><Icon n="trash" />Quitar de la carta</button>}
            <button className="btn btn-primary" style={{ flex: '2 1 200px' }} disabled={!ed.nombre.trim() || !precioOk || subiendo} onClick={guardar}>
              <Icon n="check" />Guardar
            </button>
          </div>
        </Modal>
      )}

      {ed && quitando && (
        <Modal title="¿Quitar de la carta?" onClose={() => setQuitando(false)}>
          <p><b>{ed.nombre}</b> dejará de aparecer en el punto de venta. Podrás volver a ponerlo desde “Quitados de la carta”.</p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setQuitando(false)}>Volver</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => { const p = ed; setEd(null); setQuitando(false); await poner(p, false) }}>Sí, quitar</button>
          </div>
        </Modal>
      )}

      {verCats && <Categorias onClose={() => setVerCats(false)} />}
    </div>
  )
}

function Categorias({ onClose }) {
  const { categorias, productos, recargar } = useData()
  const toast = useToast()
  const [nueva, setNueva] = useState('')
  const [nombres, setNombres] = useState(() => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])))

  async function crear() {
    const n = nueva.trim()
    if (!n) return
    try {
      await db(supabase.from('categorias').insert({ clave: n.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36), nombre: n, icono: 'plate', orden: categorias.length + 1 }))
      setNueva(''); await recargar(); toast('Categoría creada')
    } catch (e) { toast.error(e) }
  }
  async function renombrar(c) {
    const n = (nombres[c.id] || '').trim()
    if (!n || n === c.nombre) return
    try { await db(supabase.from('categorias').update({ nombre: n }).eq('id', c.id)); await recargar(); toast('Nombre guardado') } catch (e) { toast.error(e) }
  }
  async function borrar(c) {
    try { await db(supabase.from('categorias').delete().eq('id', c.id)); await recargar(); toast('Categoría eliminada') }
    catch (e) { toast.error('No se pudo eliminar. Primero cambia o quita los platos de esa categoría.') }
  }

  return (
    <Modal title="Categorías" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        {categorias.map((c) => {
          const n = productos.filter((p) => p.categoria_id === c.id).length
          return (
            <div className="row" key={c.id}>
              <input className="input" aria-label={'Nombre de ' + c.nombre} value={nombres[c.id] ?? c.nombre}
                onChange={(e) => setNombres({ ...nombres, [c.id]: e.target.value })} onBlur={() => renombrar(c)} />
              <span className="pill">{n}</span>
              <button className="minibtn" disabled={n > 0} onClick={() => borrar(c)} aria-label={'Eliminar ' + c.nombre}><Icon n="trash" /></button>
            </div>
          )
        })}
      </div>
      <div className="row">
        <input className="input" placeholder="Nueva categoría (Ej. Postres)" aria-label="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <button className="btn btn-primary" disabled={!nueva.trim()} onClick={crear}><Icon n="plus" />Agregar</button>
      </div>
      <p className="muted small">Solo se pueden eliminar categorías sin platos.</p>
    </Modal>
  )
}
