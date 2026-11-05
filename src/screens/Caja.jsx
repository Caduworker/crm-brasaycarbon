import { useEffect, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { Icon } from '../lib/icons.jsx'
import { Modal, ExportBtn, Stepper, useToast } from '../components/ui.jsx'
import { aNumero, bs } from '../lib/format.js'

const BILLETES = [
  { v: 200, c: '#8b3a1c' }, { v: 100, c: '#5b4a8a' }, { v: 50, c: '#a0436a' }, { v: 20, c: '#c06a14' }, { v: 10, c: '#2f7a6a' },
  { v: 5, moneda: true }, { v: 2, moneda: true }, { v: 1, moneda: true },
]

export default function Caja() {
  const { caja, gastos, pedidos, recargar } = useData()
  const toast = useToast()
  const [pagos, setPagos] = useState({ efectivo: 0, qr: 0, tarjeta: 0, cantidad: 0 })
  const [cierres, setCierres] = useState([])
  const [conteo, setConteo] = useState({})
  const [fondo, setFondo] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState(null)

  async function cargarPagos() {
    try {
      if (caja) {
        const filas = await db(supabase.from('pagos').select('metodo, monto').eq('caja_id', caja.id))
        const t = { efectivo: 0, qr: 0, tarjeta: 0, cantidad: filas.length }
        filas.forEach((f) => { t[f.metodo] += Number(f.monto) })
        setPagos(t)
      } else setPagos({ efectivo: 0, qr: 0, tarjeta: 0, cantidad: 0 })
      setCierres(await db(supabase.from('cajas').select('*').eq('estado', 'cerrada').order('id', { ascending: false }).limit(10)))
    } catch (e) { toast.error(e) }
  }
  useEffect(() => { cargarPagos() }, [caja?.id, pedidos])

  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const apertura = caja ? Number(caja.fondo) : 0
  const esperado = apertura + pagos.efectivo - totalGastos
  const contado = BILLETES.reduce((s, b) => s + b.v * (conteo[b.v] || 0), 0)
  const dif = contado - esperado
  const tipo = dif === 0 ? 'ok' : Math.abs(dif) <= 20 ? 'warn' : 'bad'

  async function abrir() {
    const monto = aNumero(fondo)
    if (!(monto >= 0)) { toast.error('Escribe con cuánto dinero empiezas la caja'); return }
    try {
      await db(supabase.from('cajas').insert({ fondo: monto }))
      setFondo(''); setConteo({})
      await recargar()
      toast('Caja abierta con ' + bs(monto))
    } catch (e) { toast.error(e) }
  }

  async function cerrar() {
    try {
      await db(supabase.rpc('cerrar_caja', { p_caja: caja.id, p_contado: contado }))
      setConfirmar(false); setConteo({})
      await recargar()
      toast('Caja cerrada. Diferencia: ' + bs(dif))
    } catch (e) { toast.error(e) }
  }

  async function guardarGasto() {
    const monto = aNumero(nuevoGasto.monto)
    if (!nuevoGasto.concepto.trim() || !(monto > 0)) return
    try {
      await db(supabase.from('gastos').insert({ caja_id: caja.id, concepto: nuevoGasto.concepto.trim(), monto }))
      setNuevoGasto(null)
      await recargar()
      toast('Gasto registrado: ' + bs(monto))
    } catch (e) { toast.error(e) }
  }

  const filasCierres = cierres.map((c) => [new Date(c.abierta_en).toLocaleString('es-BO'), c.cerrada_en ? new Date(c.cerrada_en).toLocaleString('es-BO') : '', Number(c.fondo), Number(c.esperado), Number(c.contado), Number(c.diferencia)])

  if (!caja) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 520 }}>
          <h2>Abrir caja</h2>
          <p className="muted" style={{ margin: '6px 0 14px' }}>La caja está cerrada. Escribe con cuánto dinero en efectivo empiezas el turno.</p>
          <div className="field">
            <label htmlFor="fondo">Fondo de apertura (Bs)</label>
            <input id="fondo" className="input num" inputMode="decimal" placeholder="Ej. 500" value={fondo} onChange={(e) => setFondo(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-big" style={{ width: '100%', marginTop: 14 }} onClick={abrir}><Icon n="cash" size={26} />Abrir caja</button>
        </div>
        <Cierres cierres={cierres} filas={filasCierres} />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="grow muted small">Abierta desde las {new Date(caja.abierta_en).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
        <ExportBtn nombre="cierre-de-caja" columnas={['Concepto', 'Monto (Bs)']} filas={[
          ['Fondo de apertura', apertura], ['Ventas en efectivo', pagos.efectivo], ['Ventas por QR', pagos.qr], ['Ventas con tarjeta', pagos.tarjeta],
          ['Gastos de caja', -totalGastos], ['Efectivo esperado', esperado], ['Efectivo contado', contado], ['Diferencia', dif]]} />
      </div>

      <div className="kpis">
        <div className="kpi"><span className="lab">Ventas del turno</span><span className="val num">{bs(pagos.efectivo + pagos.qr + pagos.tarjeta)}</span><span className="small muted">{pagos.cantidad} pedidos cobrados</span></div>
        <div className="kpi"><span className="lab">Esperado en caja</span><span className="val num">{bs(esperado)}</span><span className="small muted">Solo efectivo</span></div>
        <div className="kpi"><span className="lab">Estado</span><span className="val" style={{ color: 'var(--ok)' }}>Abierta</span><span className="small muted">Fondo {bs(apertura)}</span></div>
      </div>

      <div className="two wide-l">
        <div className="card">
          <h2>Resumen del turno</h2>
          <div style={{ marginTop: 8 }}>
            <div className="kv"><span>Fondo de apertura</span><b>{bs(apertura)}</b></div>
            <div className="kv"><span className="row"><Icon n="cash" size={20} />Ventas en efectivo</span><b>{bs(pagos.efectivo)}</b></div>
            <div className="kv"><span className="row"><Icon n="qr" size={20} />Ventas por QR</span><b>{bs(pagos.qr)}</b></div>
            <div className="kv"><span className="row"><Icon n="card" size={20} />Ventas con tarjeta</span><b>{bs(pagos.tarjeta)}</b></div>
            <div className="kv"><span>Gastos pagados de caja</span><b>− {bs(totalGastos)}</b></div>
            <div className="kv big"><span>Efectivo esperado</span><b>{bs(esperado)}</b></div>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <h2 className="grow">Gastos del turno</h2>
            <button className="btn btn-sm" onClick={() => setNuevoGasto({ concepto: '', monto: '' })}><Icon n="plus" size={20} />Anotar gasto</button>
          </div>
          <div style={{ marginTop: 6 }}>
            {gastos.length === 0 && <p className="muted small" style={{ padding: '10px 0' }}>Todavía no hay gastos.</p>}
            {gastos.map((g) => (
              <div className="kv" key={g.id}>
                <span><span className="mono muted">{new Date(g.creado).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}</span> · {g.concepto}</span>
                <b>{bs(g.monto)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Conteo de efectivo</h2>
          <p className="muted small" style={{ margin: '4px 0 14px' }}>Cuenta billetes y monedas. La diferencia se calcula sola.</p>
          <div className="denoms">
            {BILLETES.map((b) => (
              <div className="den" key={b.v}>
                <div className={'face' + (b.moneda ? ' coin' : '')} style={b.moneda ? undefined : { background: b.c }}>{b.v}</div>
                <Stepper value={conteo[b.v] || 0} onChange={(v) => setConteo({ ...conteo, [b.v]: v })} max={999} nombre={'Bs ' + b.v} />
                <span className="sum num">{bs(b.v * (conteo[b.v] || 0))}</span>
              </div>
            ))}
          </div>
          <div className="kv big" style={{ marginTop: 10 }}><span>Total contado</span><b>{bs(contado)}</b></div>
          <div className={'diff ' + tipo} role="status">
            <Icon n={tipo === 'ok' ? 'check' : 'alert'} size={26} />
            <span>{dif === 0 ? 'La caja cuadra' : dif < 0 ? 'Faltan en caja' : 'Sobran en caja'}</span>
            <b className="num">{bs(Math.abs(dif))}</b>
          </div>
          <button className="btn btn-primary btn-big" style={{ width: '100%', marginTop: 14 }} onClick={() => setConfirmar(true)}>
            <Icon n="lock" size={26} />Cerrar caja
          </button>
        </div>
      </div>

      <Cierres cierres={cierres} filas={filasCierres} />

      {confirmar && (
        <Modal title="¿Cerrar la caja?" onClose={() => setConfirmar(false)}>
          <div>
            <div className="kv"><span>Efectivo esperado</span><b>{bs(esperado)}</b></div>
            <div className="kv"><span>Efectivo contado</span><b>{bs(contado)}</b></div>
            <div className="kv big"><span>{dif < 0 ? 'Faltante' : dif > 0 ? 'Sobrante' : 'Diferencia'}</span><b>{bs(Math.abs(dif))}</b></div>
          </div>
          {pedidos.length > 0 && <div className="hint warn"><Icon n="alert" size={20} />Todavía hay {pedidos.length} pedidos abiertos sin cobrar.</div>}
          <p className="muted small">Después del cierre no se pueden registrar más cobros hasta abrir una caja nueva.</p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmar(false)}>Volver</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={cerrar}><Icon n="lock" />Cerrar caja</button>
          </div>
        </Modal>
      )}

      {nuevoGasto && (
        <Modal title="Anotar gasto" onClose={() => setNuevoGasto(null)}>
          <div className="field"><label htmlFor="g-con">¿En qué se gastó?</label>
            <input id="g-con" className="input" placeholder="Ej. Carbón, hielo, gas" value={nuevoGasto.concepto} onChange={(e) => setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })} /></div>
          <div className="field"><label htmlFor="g-mon">Monto (Bs)</label>
            <input id="g-mon" className="input num" inputMode="decimal" value={nuevoGasto.monto} onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })} /></div>
          <button className="btn btn-primary btn-big" disabled={!nuevoGasto.concepto.trim() || !(aNumero(nuevoGasto.monto) > 0)} onClick={guardarGasto}>
            <Icon n="check" size={26} />Guardar gasto
          </button>
        </Modal>
      )}
    </div>
  )
}

function Cierres({ cierres, filas }) {
  if (!cierres.length) return null
  return (
    <div className="card tablecard">
      <div className="row" style={{ padding: '16px 18px 8px' }}>
        <h2 className="grow">Últimos cierres</h2>
        <ExportBtn nombre="cierres-de-caja" columnas={['Abrió', 'Cerró', 'Fondo (Bs)', 'Esperado (Bs)', 'Contado (Bs)', 'Diferencia (Bs)']} filas={filas} />
      </div>
      <div className="scroll-x">
        <table className="rtab">
          <thead><tr><th>Cerró</th><th className="r">Esperado</th><th className="r">Contado</th><th className="r">Diferencia</th></tr></thead>
          <tbody>
            {cierres.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.cerrada_en).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="r">{bs(c.esperado)}</td>
                <td className="r">{bs(c.contado)}</td>
                <td className="r"><span className={'pill ' + (Number(c.diferencia) === 0 ? 'ok' : Math.abs(Number(c.diferencia)) <= 20 ? 'warn' : 'bad')}>{bs(c.diferencia)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
