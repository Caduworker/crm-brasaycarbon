import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { useAuth, puede } from '../lib/auth.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, Foto, Stepper, Vacio, useToast } from '../components/ui.jsx'
import { bs } from '../lib/format.js'
import logo from '../assets/wordmark.png'

const TIPOS = [
  { id: 'mesa', label: 'Mesa', icono: 'utensils' },
  { id: 'mostrador', label: 'Mostrador', icono: 'store' },
  { id: 'llevar', label: 'Para llevar', icono: 'bag' },
  { id: 'delivery', label: 'Delivery', icono: 'bike' },
]
export const ESTADOS_MESA = {
  libre: { l: 'Libre', c: 'ok', ic: 'check' },
  ocupada: { l: 'Ocupada', c: 'warn', ic: 'utensils' },
  cobrar: { l: 'Por cobrar', c: 'bad', ic: 'receipt' },
  unida: { l: 'Unida', c: '', ic: 'merge' },
}

export function etiquetaMesa(principal, mesas) {
  if (!principal) return 'Mesa'
  const ids = [principal.id, ...mesas.filter((m) => m.unida_a === principal.id).map((m) => m.id)].sort((a, b) => a - b)
  return (ids.length > 1 ? 'Mesas ' + ids.join(' + ') : 'Mesa ' + principal.id) + ' · ' + principal.zona
}

function guiaVista() {
  try { return localStorage.getItem('bc-guia') !== '1' } catch (e) { return true }
}

export default function Pos({ pos, setPos, ir }) {
  const { categorias, productos, mesas, pedidos, caja, recargar } = useData()
  const { perfil } = useAuth()
  const toast = useToast()
  const puedeCobrar = puede(perfil, ['admin', 'cajero'])

  const [cat, setCat] = useState(null)
  const [q, setQ] = useState('')
  const [vista, setVista] = useState('pedido')
  const [panel, setPanel] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [guia, setGuia] = useState(guiaVista)
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', direccion: '' })
  const ocupado = useRef(false)

  const catActiva = cat ?? categorias[0]?.id
  const mesa = mesas.find((m) => m.id === pos.mesa)
  const principal = mesa && mesa.unida_a ? mesas.find((m) => m.id === mesa.unida_a) : mesa

  const actual = useMemo(() => {
    if (pos.tipo === 'mesa') return pedidos.find((p) => p.tipo === 'mesa' && p.mesa_id === principal?.id)
    return pedidos.filter((p) => p.tipo === pos.tipo).sort((a, b) => b.id - a.id)[0]
  }, [pedidos, pos.tipo, principal?.id])

  const lineas = useMemo(() => (actual?.pedido_items || []).slice().sort((a, b) => a.id - b.id), [actual])
  const total = lineas.reduce((s, l) => s + Number(l.precio) * l.cantidad, 0)
  const cantidad = lineas.reduce((s, l) => s + l.cantidad, 0)
  const hayNuevos = lineas.some((l) => !l.comanda_id)
  const etiqueta = pos.tipo === 'mesa' ? etiquetaMesa(principal, mesas) : TIPOS.find((t) => t.id === pos.tipo).label

  useEffect(() => {
    if (actual && pos.tipo !== 'mesa') {
      setCliente({ nombre: actual.cliente || '', telefono: actual.telefono || '', direccion: actual.direccion || '' })
    }
  }, [actual?.id, pos.tipo])

  const visibles = productos.filter((p) => p.activo && (q ? p.nombre.toLowerCase().includes(q.toLowerCase()) : p.categoria_id === catActiva))
  const cantidadDe = (id) => lineas.filter((l) => l.producto_id === id).reduce((s, l) => s + l.cantidad, 0)

  async function conCandado(fn) {
    if (ocupado.current) return
    ocupado.current = true
    try { await fn(); await recargar() } catch (e) { toast.error(e) } finally { ocupado.current = false }
  }

  const agregar = (p) => conCandado(async () => {
    if (pos.tipo === 'mesa' && !principal) throw new Error('Elige una mesa primero')
    let ped = actual
    if (!ped) {
      const fila = { tipo: pos.tipo, mesa_id: pos.tipo === 'mesa' ? principal.id : null }
      if (pos.tipo !== 'mesa') Object.assign(fila, { cliente: cliente.nombre || null, telefono: cliente.telefono || null, direccion: cliente.direccion || null })
      ped = await db(supabase.from('pedidos').insert(fila).select().single())
      ped.pedido_items = []
      if (pos.tipo === 'mesa' && principal.estado === 'libre') {
        await db(supabase.from('mesas').update({ estado: 'ocupada', mozo: perfil.nombre, abierta_desde: new Date().toISOString() }).eq('id', principal.id))
      }
    }
    const abierta = (ped.pedido_items || []).find((i) => i.producto_id === p.id && !i.comanda_id)
    if (abierta) await db(supabase.from('pedido_items').update({ cantidad: abierta.cantidad + 1 }).eq('id', abierta.id))
    else await db(supabase.from('pedido_items').insert({ pedido_id: ped.id, producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }))
  })

  const cambiar = (l, nueva) => conCandado(async () => {
    if (nueva <= 0) await db(supabase.from('pedido_items').delete().eq('id', l.id))
    else await db(supabase.from('pedido_items').update({ cantidad: nueva }).eq('id', l.id))
  })

  const quitar = (l) => conCandado(async () => {
    await db(supabase.from('pedido_items').delete().eq('id', l.id))
    toast('Quitaste ' + l.nombre, {
      label: 'Deshacer',
      fn: async () => {
        try {
          await db(supabase.from('pedido_items').insert({ pedido_id: l.pedido_id, producto_id: l.producto_id, nombre: l.nombre, precio: l.precio, cantidad: l.cantidad }))
          await recargar()
        } catch (e) { toast.error(e) }
      },
    })
  })

  const guardarCliente = () => {
    if (actual && pos.tipo !== 'mesa') {
      db(supabase.from('pedidos').update({ cliente: cliente.nombre || null, telefono: cliente.telefono || null, direccion: cliente.direccion || null }).eq('id', actual.id)).catch(toast.error)
    }
  }

  const enviar = () => conCandado(async () => {
    const n = await db(supabase.rpc('enviar_a_cocina', { p_pedido: actual.id }))
    toast('Pedido enviado a cocina · ticket #' + n)
  })

  const pedirCuenta = () => conCandado(async () => {
    await db(supabase.from('mesas').update({ estado: 'cobrar' }).eq('id', principal.id))
    toast(etiqueta.split(' · ')[0] + ' pidió la cuenta')
  })

  const cobrar = (metodo, personas) => conCandado(async () => {
    await db(supabase.rpc('cobrar_pedido', { p_pedido: actual.id, p_metodo: metodo, p_personas: personas }))
    setCobrando(false); setPanel(false)
    toast(etiqueta.split(' · ')[0] + ' cobrada: ' + bs(total))
  })

  const anular = () => conCandado(async () => {
    await db(supabase.rpc('anular_pedido', { p_pedido: actual.id }))
    setAnulando(false); setPanel(false)
    toast('Pedido anulado')
  })

  const cerrarGuia = () => { setGuia(false); try { localStorage.setItem('bc-guia', '1') } catch (e) { /* nada */ } }

  return (
    <div className="pos">
      <div className="pos-main">
        {guia && (
          <div className="guide" role="note">
            <span className="gi"><Icon n="bulb" size={22} /></span>
            <ol>
              <li><b>1</b> Elige la mesa o el tipo de pedido</li>
              <li><b>2</b> Toca los platos para agregarlos</li>
              <li><b>3</b> {puedeCobrar ? <>Toca el botón naranja <em>Cobrar</em></> : <>Toca <em>Enviar a cocina</em></>}</li>
            </ol>
            <button className="btn btn-sm" onClick={cerrarGuia}>Entendido</button>
          </div>
        )}
        {puedeCobrar && !caja && (
          <div className="hint warn" role="alert">
            <Icon n="alert" size={20} />
            <span className="grow">La caja está cerrada. Ábrela para poder cobrar.</span>
            <button className="btn btn-sm" onClick={() => ir('caja')}>Ir a Caja</button>
          </div>
        )}

        <div className="seg" role="group" aria-label="Tipo de pedido">
          {TIPOS.map((t) => (
            <button key={t.id} aria-pressed={pos.tipo === t.id} onClick={() => setPos((p) => ({ ...p, tipo: t.id }))}>
              <Icon n={t.icono} />{t.label}
            </button>
          ))}
        </div>

        {pos.tipo === 'mesa' && (
          <div className="tablepick" role="group" aria-label="Elegir mesa">
            {mesas.map((m) => (
              <span key={m.id} style={{ display: 'contents' }}>
                {m.id === mesas.find((x) => x.zona === 'Terraza')?.id && <span className="zone-sep" aria-hidden="true" />}
                <button className="tbtn num" data-s={m.estado} aria-pressed={pos.mesa === m.id}
                  aria-label={'Mesa ' + m.id + ', ' + ESTADOS_MESA[m.estado].l} onClick={() => setPos((p) => ({ ...p, mesa: m.id }))}>
                  {m.id}<i />
                </button>
              </span>
            ))}
          </div>
        )}

        {(pos.tipo === 'delivery' || pos.tipo === 'llevar') && (
          <div className="card flat cust">
            <div className="field"><label htmlFor="c-nombre">Cliente</label>
              <input id="c-nombre" className="input" value={cliente.nombre} onBlur={guardarCliente}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} /></div>
            {pos.tipo === 'delivery' && <>
              <div className="field"><label htmlFor="c-tel">WhatsApp</label>
                <input id="c-tel" className="input" inputMode="tel" value={cliente.telefono} onBlur={guardarCliente}
                  onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} /></div>
              <div className="field"><label htmlFor="c-dir">Dirección</label>
                <input id="c-dir" className="input" value={cliente.direccion} onBlur={guardarCliente}
                  onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} /></div>
            </>}
          </div>
        )}

        <div className="search">
          <Icon n="search" size={20} />
          <input className="input" placeholder="Buscar un plato…" aria-label="Buscar plato" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!q && (
          <div className="chips" role="group" aria-label="Categorías">
            {categorias.map((c) => (
              <button key={c.id} className="chip" aria-pressed={catActiva === c.id} onClick={() => setCat(c.id)}>
                <Icon n={c.icono} size={18} />{c.nombre}
                <span className="cnt num">{productos.filter((p) => p.activo && p.categoria_id === c.id).length}</span>
              </button>
            ))}
          </div>
        )}

        {visibles.length === 0
          ? <div className="empty">{q ? 'No hay platos que coincidan con “' + q + '”.' : 'No hay platos en esta categoría.'}</div>
          : (
            <div className="menu-grid">
              {visibles.map((p) => {
                const n = cantidadDe(p.id)
                return (
                  <button key={p.id} className="dish" onClick={() => agregar(p)} aria-label={'Agregar ' + p.nombre + ', ' + bs(p.precio)}>
                    <Foto p={p} />
                    {n > 0 && <span className="qty num">{n}</span>}
                    <div className="info">
                      <span className="nm">{p.nombre}</span>
                      <span className="dt">{p.detalle}</span>
                      <div className="pr"><b className="num">{bs(p.precio)}</b><span className="add"><Icon n="plus" size={24} /></span></div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
      </div>

      {cantidad > 0 && (
        <button className="cartbar" onClick={() => setPanel(true)}>
          <Icon n="receipt" size={26} />
          <span>{etiqueta} · {cantidad} {cantidad === 1 ? 'plato' : 'platos'}</span>
          <span className="t num">{bs(total)}</span>
        </button>
      )}

      <aside className={'panel' + (panel ? ' open' : '')} aria-label="Pedido actual">
        <div className="panel-head">
          <div className="grow">
            <div className="disp" style={{ fontSize: 24, lineHeight: 1.05 }}>{etiqueta}</div>
            <div className="muted small">{cantidad} {cantidad === 1 ? 'plato' : 'platos'} en el pedido</div>
          </div>
          <div className="seg" role="group" aria-label="Vista" style={{ flex: 'none' }}>
            <button aria-pressed={vista === 'pedido'} onClick={() => setVista('pedido')} style={{ minHeight: 44, padding: '0 12px' }}>Pedido</button>
            <button aria-pressed={vista === 'ticket'} onClick={() => setVista('ticket')} style={{ minHeight: 44, padding: '0 12px' }}>Ticket</button>
          </div>
          <button className="iconbtn closebtn" onClick={() => setPanel(false)} aria-label="Cerrar pedido"><Icon n="x" /></button>
        </div>

        <div className="panel-body">
          {vista === 'ticket'
            ? <Ticket pedido={actual} lineas={lineas} total={total} etiqueta={etiqueta} tipo={pos.tipo} cliente={cliente} perfil={perfil} />
            : lineas.length === 0
              ? <Vacio titulo="Pedido vacío" texto="Toca un plato del menú para agregarlo." />
              : lineas.map((l) => (
                <div className="line" key={l.id}>
                  <div>
                    <div className="nm">{l.nombre}</div>
                    <div className="sub">{bs(l.precio)} c/u {l.comanda_id && <span className="pill ok" style={{ height: 22, marginLeft: 6 }}>En cocina</span>}</div>
                  </div>
                  <div className="amt num">{bs(l.precio * l.cantidad)}</div>
                  <div className="ctl">
                    {l.comanda_id
                      ? <span className="num" style={{ fontWeight: 800 }}>{l.cantidad} ×</span>
                      : <Stepper value={l.cantidad} onChange={(v) => cambiar(l, v)} nombre={l.nombre} />}
                    {!l.comanda_id && (
                      <button className="minibtn" onClick={() => quitar(l)} aria-label={'Eliminar ' + l.nombre}><Icon n="trash" /></button>
                    )}
                  </div>
                </div>
              ))}
        </div>

        <div className="panel-foot">
          <div className="total-row"><span className="muted" style={{ fontWeight: 700 }}>Total a cobrar</span><b className="num">{bs(total)}</b></div>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} disabled={!actual || !hayNuevos} onClick={enviar}>
              <Icon n="flame" />Enviar a cocina
            </button>
            {pos.tipo === 'mesa' && !puedeCobrar && (
              <button className="btn" style={{ flex: 1 }} disabled={!actual || principal?.estado === 'cobrar'} onClick={pedirCuenta}>
                <Icon n="receipt" />Pedir cuenta
              </button>
            )}
            {puedeCobrar && actual && (
              <button className="btn danger" onClick={() => setAnulando(true)} aria-label="Anular pedido"><Icon n="trash" /></button>
            )}
          </div>
          {puedeCobrar && (
            <button className="btn btn-primary btn-big" disabled={!actual || cantidad === 0} onClick={() => setCobrando(true)}>
              <Icon n="cash" size={28} />Cobrar {cantidad > 0 ? bs(total) : ''}
            </button>
          )}
        </div>
      </aside>

      {cobrando && <CobrarModal total={total} etiqueta={etiqueta} sinCaja={!caja} ir={ir} onClose={() => setCobrando(false)} onConfirm={cobrar} />}
      {anulando && (
        <Modal title="¿Anular el pedido?" onClose={() => setAnulando(false)}>
          <p>Se borrará la cuenta de <b>{etiqueta}</b> y la mesa quedará libre. Esto no se puede deshacer.</p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setAnulando(false)}>Volver</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={anular}>Sí, anular</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CobrarModal({ total, etiqueta, sinCaja, ir, onClose, onConfirm }) {
  const [metodo, setMetodo] = useState('efectivo')
  const [recibido, setRecibido] = useState(null)
  const [personas, setPersonas] = useState(1)
  const rapidos = [...new Set([total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 200) * 200])].filter((v) => v >= total).slice(0, 4)
  const entrega = recibido == null ? total : recibido
  const vuelto = Math.max(0, entrega - total)

  return (
    <Modal title="Cobrar" onClose={onClose}>
      <div className="paytotal"><span className="muted">{etiqueta}</span><b className="num">{bs(total)}</b></div>
      {sinCaja && (
        <div className="hint warn"><Icon n="alert" size={20} /><span className="grow">Abre la caja antes de cobrar.</span>
          <button className="btn btn-sm" onClick={() => { onClose(); ir('caja') }}>Ir a Caja</button></div>
      )}
      <div className="splitrow">
        <span className="row" style={{ gap: 8, fontWeight: 700 }}><Icon n="split" size={20} />Dividir cuenta</span>
        <Stepper value={personas} onChange={setPersonas} min={1} max={12} nombre="personas" />
        {personas > 1 && <span className="pill acc num">{bs(Math.ceil((total / personas) * 100) / 100)} por persona</span>}
      </div>
      <div className="seg" role="group" aria-label="Forma de pago">
        {[['efectivo', 'Efectivo', 'cash'], ['qr', 'QR', 'qr'], ['tarjeta', 'Tarjeta', 'card']].map(([id, l, ic]) => (
          <button key={id} aria-pressed={metodo === id} onClick={() => setMetodo(id)}><Icon n={ic} />{l}</button>
        ))}
      </div>
      {metodo === 'efectivo' && (
        <div className="field">
          <label>El cliente entrega</label>
          <div className="chips">
            {rapidos.map((v) => (
              <button key={v} className="chip" aria-pressed={entrega === v} onClick={() => setRecibido(v)}>{v === total ? 'Monto exacto' : bs(v)}</button>
            ))}
          </div>
          <div className="kv big"><span>Vuelto</span><b>{bs(vuelto)}</b></div>
        </div>
      )}
      {metodo === 'qr' && <div className="card flat" style={{ textAlign: 'center' }}><Icon n="qr" size={36} /><p style={{ marginTop: 8, fontWeight: 700 }}>Muestra tu QR de cobro</p><p className="muted small">Confirma cuando el cliente haya pagado.</p></div>}
      {metodo === 'tarjeta' && <div className="card flat" style={{ textAlign: 'center' }}><Icon n="card" size={36} /><p style={{ marginTop: 8, fontWeight: 700 }}>Cobra con el terminal bancario</p><p className="muted small">Confirma cuando el pago sea aprobado.</p></div>}
      <button className="btn btn-primary btn-big" disabled={sinCaja} onClick={() => onConfirm(metodo, personas)}>
        <Icon n="check" size={26} />Confirmar cobro
      </button>
    </Modal>
  )
}

function Ticket({ pedido, lineas, total, etiqueta, tipo, cliente, perfil }) {
  const fecha = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return (
    <>
      <div className="ticket">
        <div className="tc"><img src={logo} alt="Brasa y Carbón" /></div>
        <hr />
        <div className="tl"><span>Ticket N° {pedido ? String(pedido.id).padStart(4, '0') : '----'}</span><span>{fecha}</span></div>
        <div className="tl"><span>{etiqueta}</span><span>Atiende: {perfil.nombre}</span></div>
        {tipo === 'delivery' && cliente.direccion && <div className="tl"><span>Entrega: {cliente.direccion}</span></div>}
        <hr />
        {lineas.length === 0 && <div className="tc muted">Sin productos</div>}
        {lineas.map((l) => (
          <div className="tl" key={l.id}><span>{l.cantidad} × {l.nombre}</span><span className="num">{bs(l.precio * l.cantidad)}</span></div>
        ))}
        <hr />
        <div className="tl tt"><span>TOTAL</span><span className="num">{bs(total)}</span></div>
        <hr />
        <div className="tc small">¡Gracias por su preferencia!<br />Restaurant y Churrasquería</div>
      </div>
      <button className="btn btn-sm no-print" onClick={() => window.print()}><Icon n="printer" size={20} />Imprimir ticket</button>
    </>
  )
}
