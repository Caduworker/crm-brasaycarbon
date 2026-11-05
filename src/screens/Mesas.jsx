import { useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { useAuth, puede } from '../lib/auth.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, ExportBtn, useToast } from '../components/ui.jsx'
import { bs, minutosDesde } from '../lib/format.js'
import { ESTADOS_MESA } from './Pos.jsx'

export default function Mesas({ setPos, ir }) {
  const { mesas, pedidos, recargar } = useData()
  const { perfil } = useAuth()
  const toast = useToast()
  const [sel, setSel] = useState(null)
  const [unir, setUnir] = useState(false)
  const [elegidas, setElegidas] = useState([])
  const [separando, setSeparando] = useState(false)

  const pedidoDe = (m) => pedidos.find((p) => p.tipo === 'mesa' && p.mesa_id === m.id)
  const totalDe = (m) => (pedidoDe(m)?.pedido_items || []).reduce((s, i) => s + Number(i.precio) * i.cantidad, 0)
  const unidasA = (m) => mesas.filter((x) => x.unida_a === m.id).map((x) => x.id)
  const conteo = { libre: 0, ocupada: 0, cobrar: 0, unida: 0 }
  mesas.forEach((m) => { conteo[m.estado]++ })

  const mesaSel = mesas.find((m) => m.id === sel)
  const principalDeSel = mesaSel && mesaSel.unida_a ? mesas.find((m) => m.id === mesaSel.unida_a) : null
  const puedeUnir = puede(perfil, ['admin', 'cajero', 'mozo'])

  const elegibles = (m) => m.estado === 'ocupada' || m.estado === 'cobrar'
  const alternar = (id) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))
  const ordenadas = mesas.filter((m) => elegidas.includes(m.id)).sort((a, b) => a.id - b.id)
  const totalElegido = ordenadas.reduce((s, m) => s + totalDe(m), 0)

  async function ejecutar(fn, ok) {
    try { await fn(); await recargar(); if (ok) toast(ok) } catch (e) { toast.error(e) }
  }

  const hacerUnion = () => ejecutar(async () => {
    const [principal, ...otras] = ordenadas.map((m) => m.id)
    await db(supabase.rpc('unir_mesas', { p_principal: principal, p_otras: otras }))
    setUnir(false); setElegidas([])
  }, 'Mesas unidas en una sola cuenta')

  const hacerSeparar = () => ejecutar(async () => {
    await db(supabase.rpc('separar_mesas', { p_principal: mesaSel.id }))
    setSeparando(false); setSel(null)
  }, 'Mesas separadas. Los platos siguen en la mesa ' + (mesaSel && mesaSel.id))

  const pedirCuenta = () => ejecutar(async () => {
    await db(supabase.from('mesas').update({ estado: 'cobrar' }).eq('id', mesaSel.id))
    setSel(null)
  }, 'La mesa pidió la cuenta')

  const abrir = (m) => { setPos({ tipo: 'mesa', mesa: m.id }); setSel(null); ir('venta') }

  const filasExcel = mesas.map((m) => [m.id, m.zona, m.sillas, ESTADOS_MESA[m.estado].l, m.mozo || '', m.abierta_desde ? minutosDesde(m.abierta_desde) : '', totalDe(m)])

  return (
    <div className="page">
      <div className="toolbar">
        <div className="legend">
          {Object.entries(ESTADOS_MESA).filter(([k]) => k !== 'unida' || conteo.unida > 0).map(([k, v]) => (
            <span key={k} className={'pill big ' + v.c}><Icon n={v.ic} size={18} />{v.l} · {conteo[k]}</span>
          ))}
        </div>
        <div className="grow" />
        <ExportBtn nombre="mesas" columnas={['Mesa', 'Zona', 'Sillas', 'Estado', 'Mozo', 'Minutos', 'Total (Bs)']} filas={filasExcel} />
        {puedeUnir && (
          <button className={'btn btn-sm' + (unir ? ' btn-primary' : '')} onClick={() => { setUnir(!unir); setElegidas([]) }}>
            <Icon n="merge" size={20} />{unir ? 'Salir de unir' : 'Unir cuentas'}
          </button>
        )}
      </div>

      {unir && <div className="hint" role="note"><Icon n="bulb" size={20} />Toca las mesas que quieres juntar en una sola cuenta. Solo se pueden unir mesas con pedido.</div>}

      {['Salón', 'Terraza'].map((zona) => (
        <section className="zone" key={zona}>
          <h2 className="sec-title"><span>{zona}</span><small>{mesas.filter((m) => m.zona === zona).length} mesas</small></h2>
          <div className="tables">
            {mesas.filter((m) => m.zona === zona).map((m) => {
              const e = ESTADOS_MESA[m.estado]
              const on = elegidas.includes(m.id)
              return (
                <button key={m.id} className={'tcard' + (on ? ' picked' : '')} data-s={m.estado}
                  disabled={unir && !elegibles(m)} aria-pressed={unir ? on : undefined}
                  onClick={() => (unir ? alternar(m.id) : setSel(m.id))} aria-label={'Mesa ' + m.id + ', ' + e.l}>
                  <span className="seats"><Icon n="seat" size={18} />{m.sillas}</span>
                  <span className="st"><Icon n={on ? 'check' : e.ic} size={15} />{on ? 'Elegida' : e.l}</span>
                  <span className="tn num">{m.id}</span>
                  {m.estado === 'libre' && <span className="meta">Disponible</span>}
                  {m.estado === 'unida' && <span className="meta">Cuenta en mesa {m.unida_a}</span>}
                  {(m.estado === 'ocupada' || m.estado === 'cobrar') && (
                    <span className="meta">{m.mozo || 'Sin mozo'} · {minutosDesde(m.abierta_desde)} min{unidasA(m).length > 0 ? ' · +' + unidasA(m).join(', +') : ''}</span>
                  )}
                  {(m.estado === 'ocupada' || m.estado === 'cobrar') && <span className="tot num">{bs(totalDe(m))}</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {unir && (
        <div className="actionbar">
          <div className="grow">
            <b>{elegidas.length} {elegidas.length === 1 ? 'mesa elegida' : 'mesas elegidas'}</b>
            <div className="small muted">{elegidas.length > 1 ? 'Total junto: ' + bs(totalElegido) : 'Elige al menos 2 mesas'}</div>
          </div>
          <button className="btn btn-sm" onClick={() => { setUnir(false); setElegidas([]) }}>Cancelar</button>
          <button className="btn btn-primary" disabled={elegidas.length < 2} onClick={hacerUnion}>
            <Icon n="merge" />Unir{elegidas.length > 1 ? ' en mesa ' + ordenadas[0].id : ''}
          </button>
        </div>
      )}

      {mesaSel && !separando && (
        <Modal title={'Mesa ' + mesaSel.id} onClose={() => setSel(null)}>
          <div className="row wrap">
            <span className={'pill ' + ESTADOS_MESA[mesaSel.estado].c}><Icon n={ESTADOS_MESA[mesaSel.estado].ic} size={16} />{ESTADOS_MESA[mesaSel.estado].l}</span>
            <span className="pill"><Icon n="seat" size={16} />{mesaSel.sillas} sillas</span>
            <span className="pill">{mesaSel.zona}</span>
            {mesaSel.mozo && <span className="pill">Mozo: {mesaSel.mozo}</span>}
          </div>
          {unidasA(mesaSel).length > 0 && (
            <div className="hint"><Icon n="merge" size={20} />Cuenta unida con la mesa {unidasA(mesaSel).join(' y ')}.</div>
          )}
          {principalDeSel
            ? <p className="muted">Esta mesa está unida a la mesa {principalDeSel.id}. Los pedidos se cobran juntos allí.</p>
            : (pedidoDe(mesaSel)?.pedido_items || []).length > 0
              ? (
                <div>
                  {pedidoDe(mesaSel).pedido_items.map((l) => (
                    <div className="kv" key={l.id}><span>{l.cantidad} × {l.nombre}</span><b>{bs(l.precio * l.cantidad)}</b></div>
                  ))}
                  <div className="kv big"><span>Total</span><b>{bs(totalDe(mesaSel))}</b></div>
                </div>
              )
              : <p className="muted">La mesa está libre. Ábrela para tomar el pedido.</p>}
          <div className="row wrap">
            {mesaSel.estado === 'ocupada' && puedeUnir && (
              <button className="btn" style={{ flex: 1 }} onClick={pedirCuenta}><Icon n="receipt" />Pedir cuenta</button>
            )}
            {unidasA(mesaSel).length > 0 && (
              <button className="btn" style={{ flex: 1 }} onClick={() => setSeparando(true)}><Icon n="split" />Separar mesas</button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => abrir(principalDeSel || mesaSel)}>
              <Icon n={mesaSel.estado === 'libre' ? 'plus' : 'cash'} />
              {mesaSel.estado === 'libre' ? 'Abrir mesa' : principalDeSel ? 'Ir a la cuenta' : mesaSel.estado === 'cobrar' ? 'Cobrar' : 'Agregar platos'}
            </button>
          </div>
        </Modal>
      )}

      {mesaSel && separando && (
        <Modal title="¿Separar las mesas?" onClose={() => setSeparando(false)}>
          <p>Las mesas {unidasA(mesaSel).join(' y ')} quedarán libres y todos los platos seguirán en la cuenta de la mesa {mesaSel.id}.</p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setSeparando(false)}>Volver</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={hacerSeparar}>Sí, separar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
