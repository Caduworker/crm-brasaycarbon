import { useEffect, useMemo, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { Icon } from '../lib/icons.jsx'
import { ExportBtn, useToast } from '../components/ui.jsx'
import { bs, inicioDelDia } from '../lib/format.js'

const PERIODOS = { hoy: 'Hoy', semana: '7 días', mes: 'Este mes' }
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CANALES = [['mesa', 'Mesa', 'var(--accent)'], ['mostrador', 'Mostrador', 'var(--ink)'], ['llevar', 'Para llevar', 'var(--warn)'], ['delivery', 'Delivery', 'var(--ok)']]
const METODOS = [['efectivo', 'Efectivo', 'cash', 'var(--accent)'], ['qr', 'QR', 'qr', 'var(--ink)'], ['tarjeta', 'Tarjeta', 'card', 'var(--warn)']]

function inicio(periodo) {
  const hoy = inicioDelDia()
  if (periodo === 'semana') { hoy.setDate(hoy.getDate() - 6); return hoy }
  if (periodo === 'mes') { hoy.setDate(1); return hoy }
  return hoy
}

function maximoLindo(v) {
  if (v <= 0) return 100
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return ([1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10].find((x) => n <= x)) * p
}
const compacto = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : String(Math.round(n)))

export default function Reportes() {
  const { insumos, recetaItems } = useData()
  const toast = useToast()
  const [periodo, setPeriodo] = useState('hoy')
  const [pagos, setPagos] = useState(null)

  useEffect(() => {
    let vivo = true
    setPagos(null)
    db(supabase.from('pagos')
      .select('monto, metodo, creado, pedidos(tipo, pedido_items(producto_id, nombre, cantidad, precio))')
      .gte('creado', inicio(periodo).toISOString()).order('creado'))
      .then((d) => { if (vivo) setPagos(d) })
      .catch((e) => { if (vivo) { setPagos([]); toast.error(e) } })
    return () => { vivo = false }
  }, [periodo])

  const r = useMemo(() => {
    const lista = pagos || []
    const total = lista.reduce((s, p) => s + Number(p.monto), 0)
    // barras
    let etiquetas = [], valores = [], titulo = ''
    if (periodo === 'hoy') {
      titulo = 'Ventas por hora'
      const horas = lista.map((p) => new Date(p.creado).getHours())
      const desde = Math.min(10, ...horas), hasta = Math.max(22, ...horas)
      for (let h = desde; h <= hasta; h++) { etiquetas.push(String(h)); valores.push(0) }
      lista.forEach((p) => { valores[new Date(p.creado).getHours() - desde] += Number(p.monto) })
    } else if (periodo === 'semana') {
      titulo = 'Ventas por día'
      const d0 = inicio('semana')
      for (let i = 0; i < 7; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); etiquetas.push(DIAS[d.getDay()]); valores.push(0) }
      lista.forEach((p) => { const i = Math.floor((inicioDelDia(new Date(p.creado)) - d0) / 86400000); if (i >= 0 && i < 7) valores[i] += Number(p.monto) })
    } else {
      titulo = 'Ventas por semana'
      for (let i = 1; i <= 5; i++) { etiquetas.push('Sem ' + i); valores.push(0) }
      lista.forEach((p) => { valores[Math.min(4, Math.floor((new Date(p.creado).getDate() - 1) / 7))] += Number(p.monto) })
      while (etiquetas.length > 4 && valores[valores.length - 1] === 0) { etiquetas.pop(); valores.pop() }
    }
    // platos, canales y pagos
    const platos = {}, canal = {}, metodo = {}
    let costoCubierto = 0, ventaCubierta = 0
    const costoReceta = {}
    recetaItems.forEach((ri) => {
      const ins = insumos.find((i) => i.id === ri.insumo_id)
      if (ins) costoReceta[ri.producto_id] = (costoReceta[ri.producto_id] || 0) + Number(ins.costo) * Number(ri.cantidad)
    })
    lista.forEach((p) => {
      metodo[p.metodo] = (metodo[p.metodo] || 0) + Number(p.monto)
      const ped = p.pedidos || {}
      canal[ped.tipo] = (canal[ped.tipo] || 0) + Number(p.monto)
      ;(ped.pedido_items || []).forEach((i) => {
        const v = Number(i.precio) * i.cantidad
        const x = platos[i.nombre] || (platos[i.nombre] = { u: 0, t: 0 })
        x.u += i.cantidad; x.t += v
        if (i.producto_id && costoReceta[i.producto_id] != null) { costoCubierto += costoReceta[i.producto_id] * i.cantidad; ventaCubierta += v }
      })
    })
    const top = Object.entries(platos).map(([n, x]) => [n, x.u, x.t]).sort((a, b) => b[2] - a[2]).slice(0, 6)
    return {
      total, pedidos: lista.length, ticket: lista.length ? total / lista.length : 0,
      etiquetas, valores, titulo, top, canal, metodo,
      margen: ventaCubierta > 0 ? Math.round(((ventaCubierta - costoCubierto) / ventaCubierta) * 100) : null,
    }
  }, [pagos, periodo, insumos, recetaItems])

  const max = maximoLindo(Math.max(0, ...r.valores))
  const pico = r.valores.indexOf(Math.max(...r.valores))
  const hayVentas = r.total > 0
  const topMax = Math.max(1, ...r.top.map((t) => t[2]))
  const filasExcel = [
    ...r.etiquetas.map((l, i) => [r.titulo + ': ' + l, r.valores[i]]),
    ...r.top.map(([n, u, t]) => ['Plato: ' + n + ' (' + u + ' u.)', t]),
    ...CANALES.map(([id, n]) => ['Canal: ' + n, r.canal[id] || 0]),
    ...METODOS.map(([id, n]) => ['Pago: ' + n, r.metodo[id] || 0]),
  ]

  return (
    <div className="page">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Período" style={{ flex: '1 1 300px', maxWidth: 420 }}>
          {Object.entries(PERIODOS).map(([k, v]) => <button key={k} aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{v}</button>)}
        </div>
        <div className="grow" />
        <ExportBtn nombre={'reporte-' + periodo} columnas={['Concepto', 'Ventas (Bs)']} filas={filasExcel} />
      </div>

      {pagos === null
        ? <div className="empty"><Icon n="chart" size={40} /><p style={{ marginTop: 10, fontWeight: 700 }}>Calculando…</p></div>
        : (
          <>
            <div className="kpis">
              <div className="kpi"><span className="lab">Ventas</span><span className="val num">{bs(r.total)}</span></div>
              <div className="kpi"><span className="lab">Pedidos cobrados</span><span className="val num">{r.pedidos}</span></div>
              <div className="kpi"><span className="lab">Ticket promedio</span><span className="val num">{bs(Math.round(r.ticket * 100) / 100)}</span><span className="small muted">Por pedido</span></div>
              <div className="kpi"><span className="lab">Margen estimado</span><span className="val num">{r.margen == null ? '—' : r.margen + '%'}</span><span className="small muted">{r.margen == null ? 'Falta cargar recetas' : 'Según recetas'}</span></div>
            </div>

            {!hayVentas && <div className="hint"><Icon n="bulb" size={20} />Todavía no hay ventas cobradas en este período. Cuando cobres, aquí verás los gráficos.</div>}

            <div className="charts">
              <div className="card">
                <div className="row wrap"><h2 className="grow">{r.titulo}</h2>{periodo === 'hoy' && hayVentas && <span className="pill acc">Hora pico: {r.etiquetas[pico]}:00</span>}</div>
                <div className="plot" role="img" aria-label={r.titulo + ' en bolivianos'}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div className="grid" key={i} style={{ bottom: (i / 4) * 100 + '%', borderTopStyle: i === 0 ? 'solid' : 'dashed' }}><span className="num">{compacto((max * i) / 4)}</span></div>
                  ))}
                  <div className="cols">
                    {r.valores.map((v, i) => (
                      <div className={'colbar' + (hayVentas && i === pico ? ' peak' : '')} key={i} title={r.etiquetas[i] + ': ' + bs(v)}>
                        {v > 0 && (i === pico || r.valores.length <= 7) && <span className="v num">{compacto(v)}</span>}
                        <i style={{ height: (v / max) * 100 + '%' }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="xl">{r.etiquetas.map((l, i) => <span key={i}>{l}</span>)}</div>
                {periodo === 'hoy' && <p className="muted small" style={{ marginTop: 10 }}>Hora de la venta. Montos en Bolivianos.</p>}
              </div>

              <div className="card">
                <h2>Más vendidos</h2>
                <div className="hbar" style={{ marginTop: 14, gap: 16 }}>
                  {r.top.length === 0 && <p className="muted small">Sin ventas todavía.</p>}
                  {r.top.map(([n, u, t]) => (
                    <div key={n}>
                      <div className="t"><span>{n} <span className="muted small">· {u} u.</span></span><b>{bs(t)}</b></div>
                      <div className="tr"><i style={{ width: (t / topMax) * 100 + '%' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="two">
              <div className="card">
                <h2>Ventas por canal</h2>
                <div className="stack" style={{ marginTop: 14 }} role="img" aria-label="Reparto de ventas por canal">
                  {CANALES.map(([id, n, c]) => <i key={id} style={{ width: (hayVentas ? ((r.canal[id] || 0) / r.total) * 100 : 0) + '%', background: c }} />)}
                </div>
                <div className="legend-l">
                  {CANALES.map(([id, n, c]) => (
                    <div key={id}><span className="sw" style={{ background: c }} /><span>{n}</span>
                      <span className="muted small">{hayVentas ? Math.round(((r.canal[id] || 0) / r.total) * 100) : 0}%</span><b>{bs(r.canal[id] || 0)}</b></div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2>Formas de pago</h2>
                <div className="hbar" style={{ marginTop: 14, gap: 16 }}>
                  {METODOS.map(([id, n, ic, c]) => (
                    <div key={id}>
                      <div className="t"><span className="row" style={{ gap: 8 }}><Icon n={ic} size={20} />{n}</span><b>{bs(r.metodo[id] || 0)}</b></div>
                      <div className="tr"><i style={{ width: (hayVentas ? ((r.metodo[id] || 0) / r.total) * 100 : 0) + '%', background: c }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}
