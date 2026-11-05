import { useEffect, useMemo, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, ExportBtn, useToast } from '../components/ui.jsx'
import { aNumero, bs, fq, hora } from '../lib/format.js'

const UNIDADES = ['kg', 'lt', 'unid', 'g', 'ml']
const MOTIVOS = ['Vencido', 'Quemado', 'Se cayó', 'Devolución del cliente', 'Sobrante de cocina']
const nivel = (i) => (Number(i.stock) >= Number(i.minimo) ? 'ok' : Number(i.stock) >= Number(i.minimo) * 0.5 ? 'warn' : 'bad')
const ETIQ = { ok: 'En stock', warn: 'Bajo mínimo', bad: 'Crítico' }

export default function Inventario() {
  const [tab, setTab] = useState('stock')
  const tabs = [['stock', 'Existencias', 'box'], ['recetas', 'Recetas', 'receipt'], ['mermas', 'Mermas', 'waste']]
  return (
    <div className="page">
      <div className="seg" role="tablist" style={{ maxWidth: 480 }}>
        {tabs.map(([id, l, ic]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon n={ic} />{l}</button>
        ))}
      </div>
      {tab === 'stock' && <Existencias />}
      {tab === 'recetas' && <Recetas />}
      {tab === 'mermas' && <Mermas />}
    </div>
  )
}

/* ---------- Existencias ---------- */
function Existencias() {
  const { insumos, recargar } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [ed, setEd] = useState(null)

  const bajos = insumos.filter((i) => nivel(i) !== 'ok').length
  const valor = insumos.reduce((s, i) => s + Number(i.stock) * Number(i.costo), 0)
  const filas = insumos.filter((i) => (filtro === 'todos' || nivel(i) !== 'ok') && (!q || i.nombre.toLowerCase().includes(q.toLowerCase())))

  async function ajustar(i, d) {
    try {
      await db(supabase.from('insumos').update({ stock: Math.max(0, Math.round((Number(i.stock) + d) * 1000) / 1000) }).eq('id', i.id))
      await recargar()
    } catch (e) { toast.error(e) }
  }

  async function guardar() {
    const fila = {
      nombre: ed.nombre.trim(), categoria: ed.categoria.trim() || 'General', unidad: ed.unidad,
      stock: aNumero(ed.stock) || 0, minimo: aNumero(ed.minimo) || 0, costo: aNumero(ed.costo) || 0,
    }
    if (!fila.nombre) return
    try {
      if (ed.id) await db(supabase.from('insumos').update(fila).eq('id', ed.id))
      else await db(supabase.from('insumos').insert(fila))
      setEd(null); await recargar(); toast('Producto guardado')
    } catch (e) { toast.error(e) }
  }

  async function borrar() {
    try {
      await db(supabase.from('insumos').delete().eq('id', ed.id))
      setEd(null); await recargar(); toast('Producto eliminado del inventario')
    } catch (e) { toast.error(e) }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search" style={{ minWidth: 220, flex: '1 1 240px' }}>
          <Icon n="search" size={20} />
          <input className="input" placeholder="Buscar producto…" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ExportBtn nombre="inventario" columnas={['Producto', 'Categoría', 'Existencias', 'Unidad', 'Mínimo', 'Costo unitario (Bs)', 'Estado']}
          filas={insumos.map((i) => [i.nombre, i.categoria, Number(i.stock), i.unidad, Number(i.minimo), Number(i.costo), ETIQ[nivel(i)]])} />
        <button className="btn btn-primary" onClick={() => setEd({ id: null, nombre: '', categoria: '', unidad: 'kg', stock: '', minimo: '', costo: '' })}>
          <Icon n="plus" />Nuevo producto
        </button>
      </div>
      <div className="kpis">
        <div className="kpi"><span className="lab">Productos</span><span className="val num">{insumos.length}</span><span className="small muted">insumos registrados</span></div>
        <div className="kpi"><span className="lab">Bajo el mínimo</span><span className="val num" style={{ color: bajos ? 'var(--bad)' : 'var(--ok)' }}>{bajos}</span><span className="small muted">{bajos ? 'Conviene reponer hoy' : 'Todo en orden'}</span></div>
        <div className="kpi"><span className="lab">Valor del inventario</span><span className="val num">{bs(Math.round(valor))}</span><span className="small muted">A costo de compra</span></div>
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</button>
        <button className="chip" aria-pressed={filtro === 'bajo'} onClick={() => setFiltro('bajo')}><Icon n="alert" size={18} />Por reponer</button>
      </div>

      {insumos.length === 0
        ? <div className="empty card"><Icon n="box" size={40} /><p style={{ marginTop: 10, fontWeight: 700 }}>Aún no hay productos en el inventario</p><p className="small">Toca “Nuevo producto” para agregar carnes, carbón, aceite y lo que uses a diario.</p></div>
        : (
          <div className="card tablecard">
            <div className="irow head"><span>Producto</span><span>Existencias</span><span>Costo</span><span>Ajustar</span></div>
            {filas.length === 0 && <div className="empty">Nada por reponer con ese filtro.</div>}
            {filas.map((i) => {
              const lv = nivel(i)
              return (
                <div className="irow" key={i.id}>
                  <div>
                    <button className="nm linklike" onClick={() => setEd({ ...i, stock: String(i.stock), minimo: String(i.minimo), costo: String(i.costo) })}>{i.nombre}</button>
                    <div className="row wrap" style={{ gap: 8, marginTop: 4 }}><span className={'pill ' + lv}>{ETIQ[lv]}</span><span className="small muted">{i.categoria}</span></div>
                  </div>
                  <div className="stk">
                    <div className="row" style={{ justifyContent: 'space-between' }}><b className="num">{fq(i.stock)} {i.unidad}</b><span className="small muted num">mín. {fq(i.minimo)} {i.unidad}</span></div>
                    <div className="bar"><i className={lv === 'ok' ? '' : lv} style={{ width: Math.min(100, (Number(i.stock) / ((Number(i.minimo) || 1) * 2)) * 100) + '%' }} /></div>
                  </div>
                  <div className="num hide-m" style={{ fontWeight: 700 }}>{bs(i.costo)}<span className="muted small"> /{i.unidad}</span></div>
                  <div className="stepper stp">
                    <button onClick={() => ajustar(i, -1)} aria-label={'Restar 1 a ' + i.nombre}><Icon n="minus" /></button>
                    <button onClick={() => ajustar(i, 1)} aria-label={'Sumar 1 a ' + i.nombre}><Icon n="plus" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {ed && (
        <Modal title={ed.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setEd(null)}>
          <div className="field"><label htmlFor="i-nom">Nombre</label>
            <input id="i-nom" className="input" placeholder="Ej. Picaña" value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></div>
          <div className="field"><label htmlFor="i-cat">Categoría</label>
            <input id="i-cat" className="input" placeholder="Ej. Carnes, Despensa, Bebidas" value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })} /></div>
          <div className="field"><label>Unidad</label>
            <div className="chips wrapchips">{UNIDADES.map((u) => <button key={u} className="chip" aria-pressed={ed.unidad === u} onClick={() => setEd({ ...ed, unidad: u })}>{u}</button>)}</div></div>
          <div className="grid3">
            <div className="field"><label htmlFor="i-sto">Existencias</label><input id="i-sto" className="input num" inputMode="decimal" value={ed.stock} onChange={(e) => setEd({ ...ed, stock: e.target.value })} /></div>
            <div className="field"><label htmlFor="i-min">Mínimo</label><input id="i-min" className="input num" inputMode="decimal" value={ed.minimo} onChange={(e) => setEd({ ...ed, minimo: e.target.value })} /></div>
            <div className="field"><label htmlFor="i-cos">Costo por {ed.unidad} (Bs)</label><input id="i-cos" className="input num" inputMode="decimal" value={ed.costo} onChange={(e) => setEd({ ...ed, costo: e.target.value })} /></div>
          </div>
          <div className="row wrap">
            {ed.id && <button className="btn danger" style={{ flex: '1 1 140px' }} onClick={borrar}><Icon n="trash" />Eliminar</button>}
            <button className="btn btn-primary" style={{ flex: '2 1 200px' }} disabled={!ed.nombre.trim()} onClick={guardar}><Icon n="check" />Guardar</button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ---------- Recetas ---------- */
function Recetas() {
  const { productos, insumos, recetaItems, recargar } = useData()
  const toast = useToast()
  const [pid, setPid] = useState(null)
  const [borrador, setBorrador] = useState(null) // lista [{insumo_id, cantidad(texto)}] mientras se edita
  const [nueva, setNueva] = useState(false)
  const [agregar, setAgregar] = useState('')

  const porInsumo = useMemo(() => Object.fromEntries(insumos.map((i) => [i.id, i])), [insumos])
  const conReceta = productos.filter((p) => recetaItems.some((r) => r.producto_id === p.id))
  const sinReceta = productos.filter((p) => p.activo && !recetaItems.some((r) => r.producto_id === p.id))
  const prod = productos.find((p) => p.id === (pid ?? conReceta[0]?.id))
  const guardadas = prod ? recetaItems.filter((r) => r.producto_id === prod.id) : []
  const editando = borrador !== null
  const filas = editando ? borrador : guardadas.map((r) => ({ insumo_id: r.insumo_id, cantidad: String(r.cantidad) }))

  const costoDe = (lista) => lista.reduce((s, r) => s + (porInsumo[r.insumo_id] ? Number(porInsumo[r.insumo_id].costo) * (aNumero(r.cantidad) || 0) : 0), 0)
  const costo = costoDe(filas)
  const margen = prod && Number(prod.precio) > 0 ? (Number(prod.precio) - costo) / Number(prod.precio) : 0
  const usables = filas.filter((r) => porInsumo[r.insumo_id] && aNumero(r.cantidad) > 0)
  const porciones = usables.length ? Math.floor(Math.min(...usables.map((r) => Number(porInsumo[r.insumo_id].stock) / aNumero(r.cantidad)))) : null

  const elegir = (id) => { setPid(id); setBorrador(null) }
  const cambiar = (id, v) => setBorrador(borrador.map((r) => (r.insumo_id === id ? { ...r, cantidad: v } : r)))

  async function guardar() {
    try {
      await db(supabase.from('receta_items').delete().eq('producto_id', prod.id))
      const nuevas = borrador.map((r) => ({ producto_id: prod.id, insumo_id: r.insumo_id, cantidad: aNumero(r.cantidad) || 0 }))
      if (nuevas.length) await db(supabase.from('receta_items').insert(nuevas))
      setBorrador(null); await recargar(); toast('Receta guardada')
    } catch (e) { toast.error(e) }
  }

  async function eliminar() {
    try {
      await db(supabase.from('receta_items').delete().eq('producto_id', prod.id))
      setBorrador(null); setPid(null); await recargar(); toast('Receta eliminada')
    } catch (e) { toast.error(e) }
  }

  return (
    <>
      <div className="toolbar">
        <div className="grow muted small">Lo que lleva cada plato. Al cobrar, el sistema descuenta estos ingredientes del inventario.</div>
        <ExportBtn nombre="recetas" columnas={['Plato', 'Ingrediente', 'Cantidad', 'Unidad', 'Costo (Bs)']}
          filas={recetaItems.filter((r) => porInsumo[r.insumo_id]).map((r) => {
            const i = porInsumo[r.insumo_id]; const p = productos.find((x) => x.id === r.producto_id)
            return [p ? p.nombre : '', i.nombre, Number(r.cantidad), i.unidad, Math.round(Number(i.costo) * Number(r.cantidad) * 100) / 100]
          })} />
      </div>
      <div className="recipes">
        <div className="rlist" role="group" aria-label="Recetas">
          <button className="btn btn-primary" onClick={() => setNueva(true)} disabled={sinReceta.length === 0}><Icon n="plus" />Nueva receta</button>
          {conReceta.map((p) => {
            const c = costoDe(recetaItems.filter((r) => r.producto_id === p.id).map((r) => ({ insumo_id: r.insumo_id, cantidad: String(r.cantidad) })))
            const m = Number(p.precio) > 0 ? (Number(p.precio) - c) / Number(p.precio) : 0
            return (
              <button key={p.id} className="rcard" aria-pressed={prod && prod.id === p.id} onClick={() => elegir(p.id)}>
                <div className="grow"><div style={{ fontWeight: 700 }}>{p.nombre}</div><div className="small muted">Costo {bs(Math.round(c * 100) / 100)} · Precio {bs(p.precio)}</div></div>
                <span className={'pill ' + (m >= 0.6 ? 'ok' : 'warn')}>{Math.round(m * 100)}%</span>
              </button>
            )
          })}
          {conReceta.length === 0 && <div className="empty small">Todavía no hay recetas. Toca “Nueva receta”.</div>}
        </div>

        {prod && (
          <div className="card">
            <div className="row wrap">
              <h2 className="grow">{prod.nombre}</h2>
              <span className="pill acc">1 porción · {prod.detalle}</span>
              <button className={'btn btn-sm' + (editando ? ' btn-primary' : '')}
                onClick={() => (editando ? guardar() : setBorrador(guardadas.map((r) => ({ insumo_id: r.insumo_id, cantidad: String(r.cantidad) }))))}>
                <Icon n={editando ? 'check' : 'edit'} size={20} />{editando ? 'Guardar receta' : 'Editar receta'}
              </button>
            </div>
            <div className="scroll-x">
              <table className="rtab" style={{ marginTop: 10 }}>
                <thead><tr><th>Ingrediente</th><th className="r">Cantidad por porción</th><th className="r">Costo</th><th className="r">{editando ? '' : 'Stock'}</th></tr></thead>
                <tbody>
                  {filas.map((r) => {
                    const i = porInsumo[r.insumo_id]
                    if (!i) return null
                    return (
                      <tr key={r.insumo_id}>
                        <td>{i.nombre}</td>
                        <td className="r">
                          {editando
                            ? <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                                <input className="input qty" inputMode="decimal" aria-label={'Cantidad de ' + i.nombre} value={r.cantidad} onChange={(e) => cambiar(r.insumo_id, e.target.value)} />
                                <span className="muted">{i.unidad}</span></span>
                            : fq(r.cantidad) + ' ' + i.unidad}
                        </td>
                        <td className="r">{bs(Math.round(Number(i.costo) * (aNumero(r.cantidad) || 0) * 100) / 100)}</td>
                        <td className="r">
                          {editando
                            ? <button className="minibtn" onClick={() => setBorrador(borrador.filter((x) => x.insumo_id !== r.insumo_id))} aria-label={'Quitar ' + i.nombre}><Icon n="trash" /></button>
                            : <span className={'pill ' + nivel(i)}>{fq(i.stock)} {i.unidad}</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {filas.length === 0 && <tr><td colSpan="4" className="muted">Esta receta aún no tiene ingredientes.</td></tr>}
                </tbody>
              </table>
            </div>
            {editando && (
              <div className="row wrap" style={{ marginTop: 12 }}>
                <select className="input" style={{ flex: '1 1 220px' }} aria-label="Ingrediente a agregar" value={agregar} onChange={(e) => setAgregar(e.target.value)}>
                  <option value="">Elige un ingrediente…</option>
                  {insumos.filter((i) => !borrador.some((r) => r.insumo_id === i.id)).map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </select>
                <button className="btn btn-sm" disabled={!agregar} onClick={() => { setBorrador([...borrador, { insumo_id: Number(agregar), cantidad: '0.1' }]); setAgregar('') }}>
                  <Icon n="plus" size={20} />Agregar ingrediente
                </button>
                <button className="btn btn-sm danger" onClick={eliminar}><Icon n="trash" size={20} />Eliminar receta</button>
                <button className="btn btn-sm" onClick={() => setBorrador(null)}>Cancelar</button>
              </div>
            )}
            <div className="kpis" style={{ marginTop: 16 }}>
              <div className="kpi flat"><span className="lab">Costo por porción</span><span className="val num">{bs(Math.round(costo * 100) / 100)}</span></div>
              <div className="kpi flat"><span className="lab">Precio de venta</span><span className="val num">{bs(prod.precio)}</span></div>
              <div className="kpi flat"><span className="lab">Margen</span><span className="val num" style={{ color: margen >= 0.6 ? 'var(--ok)' : 'var(--warn)' }}>{Math.round(margen * 100)}%</span></div>
            </div>
            <p className="muted" style={{ marginTop: 14 }}>
              {porciones == null ? 'Agrega ingredientes para calcular cuántas porciones alcanzan.' : <>Con el stock actual alcanzan para <b className="num" style={{ color: 'var(--ink)' }}>{porciones}</b> porciones.</>}
            </p>
          </div>
        )}
      </div>

      {nueva && (
        <Modal title="Nueva receta" onClose={() => setNueva(false)}>
          <p className="muted">Elige el plato de la carta que aún no tiene receta.</p>
          <div className="rlist">
            {sinReceta.map((p) => (
              <button key={p.id} className="rcard" onClick={() => { setPid(p.id); setBorrador([]); setNueva(false) }}>
                <div className="grow"><b>{p.nombre}</b><div className="small muted">{p.detalle} · {bs(p.precio)}</div></div><Icon n="plus" />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

/* ---------- Mermas ---------- */
function Mermas() {
  const { insumos, recargar } = useData()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [f, setF] = useState({ insumo: '', cantidad: '', motivo: 'Quemado', nota: '' })

  async function cargar() {
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - 30)
      setLista(await db(supabase.from('mermas').select('*').gte('creado', desde.toISOString()).order('id', { ascending: false })))
    } catch (e) { toast.error(e) }
  }
  useEffect(() => { cargar() }, [])

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const deHoy = lista.filter((m) => new Date(m.creado) >= hoy)
  const totalHoy = deHoy.reduce((s, m) => s + Number(m.costo), 0)
  const totalMes = lista.reduce((s, m) => s + Number(m.costo), 0)
  const porMotivo = {}
  lista.forEach((m) => { porMotivo[m.motivo] = (porMotivo[m.motivo] || 0) + Number(m.costo) })
  const top = Object.entries(porMotivo).sort((a, b) => b[1] - a[1])[0]
  const insumo = insumos.find((i) => String(i.id) === String(f.insumo))
  const cantidad = aNumero(f.cantidad)

  async function registrar() {
    try {
      await db(supabase.rpc('registrar_merma', { p_insumo: insumo.id, p_cantidad: cantidad, p_motivo: f.motivo, p_nota: f.nota || null }))
      toast('Merma registrada: ' + fq(cantidad) + ' ' + insumo.unidad + ' de ' + insumo.nombre)
      setF({ ...f, cantidad: '', nota: '' })
      await Promise.all([cargar(), recargar()])
    } catch (e) { toast.error(e) }
  }

  return (
    <>
      <div className="toolbar">
        <div className="grow muted small">Muestra los últimos 30 días.</div>
        <ExportBtn nombre="mermas" columnas={['Fecha', 'Hora', 'Producto', 'Cantidad', 'Unidad', 'Motivo', 'Costo (Bs)', 'Nota']}
          filas={lista.map((m) => [new Date(m.creado).toLocaleDateString('es-BO'), hora(m.creado), m.nombre, Number(m.cantidad), m.unidad, m.motivo, Number(m.costo), m.nota || ''])} />
      </div>
      <div className="kpis">
        <div className="kpi"><span className="lab">Merma de hoy</span><span className="val num">{bs(Math.round(totalHoy * 100) / 100)}</span><span className="small muted">{deHoy.length} registros</span></div>
        <div className="kpi"><span className="lab">Últimos 30 días</span><span className="val num">{bs(Math.round(totalMes * 100) / 100)}</span><span className="small muted">{lista.length} registros</span></div>
        <div className="kpi"><span className="lab">Motivo principal</span><span className="val" style={{ fontSize: 28 }}>{top ? top[0] : '—'}</span><span className="small muted">{top ? bs(Math.round(top[1] * 100) / 100) + ' perdidos' : 'Sin registros'}</span></div>
      </div>
      <div className="two wide-l">
        <div className="card">
          <h2>Registrar merma</h2>
          <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
            <div className="field"><label htmlFor="m-ins">Producto</label>
              <select id="m-ins" className="input" value={f.insumo} onChange={(e) => setF({ ...f, insumo: e.target.value })}>
                <option value="">Elige un producto…</option>
                {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
              </select></div>
            <div className="field"><label htmlFor="m-can">Cantidad perdida{insumo ? ' (' + insumo.unidad + ')' : ''}</label>
              <input id="m-can" className="input num" inputMode="decimal" placeholder="Ej. 0,5" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></div>
            <div className="field"><label>Motivo</label>
              <div className="chips wrapchips">{MOTIVOS.map((m) => <button key={m} className="chip" aria-pressed={f.motivo === m} onClick={() => setF({ ...f, motivo: m })}>{m}</button>)}</div></div>
            <div className="field"><label htmlFor="m-not">Nota (opcional)</label>
              <input id="m-not" className="input" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></div>
            <button className="btn btn-primary btn-big" disabled={!insumo || !(cantidad > 0)} onClick={registrar}><Icon n="waste" size={26} />Registrar merma</button>
          </div>
        </div>
        <div className="card">
          <h2>Últimas mermas</h2>
          <div style={{ marginTop: 6 }}>
            {lista.length === 0 && <p className="muted small" style={{ padding: '10px 0' }}>Todavía no hay mermas registradas.</p>}
            {lista.slice(0, 20).map((m) => (
              <div className="kv" key={m.id} style={{ alignItems: 'flex-start' }}>
                <span><b>{m.nombre}</b> · <span className="num">{fq(m.cantidad)} {m.unidad}</span><br />
                  <span className="small muted"><span className="mono">{new Date(m.creado).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' })} {hora(m.creado)}</span> · {m.motivo}{m.nota ? ' · ' + m.nota : ''}</span></span>
                <b className="num" style={{ color: 'var(--bad)' }}>{bs(m.costo)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
