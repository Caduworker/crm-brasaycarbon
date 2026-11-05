import { useEffect, useRef, useState } from 'react'
import { supabase, db } from '../lib/supabase.js'
import { useData } from '../lib/data.jsx'
import { Icon } from '../lib/icons.jsx'
import { useToast } from '../components/ui.jsx'
import { minutosDesde } from '../lib/format.js'

const COLUMNAS = [
  { id: 'recibido', l: 'Recibido', c: 'var(--ink-2)' },
  { id: 'prep', l: 'En preparación', c: 'var(--warn)' },
  { id: 'listo', l: 'Listo', c: 'var(--ok)' },
  { id: 'camino', l: 'En camino', c: 'var(--accent)' },
]
const ICONO_TIPO = { mesa: 'utensils', mostrador: 'store', llevar: 'bag', delivery: 'bike' }

function etiqueta(c) {
  const p = c.pedidos || {}
  if (p.tipo === 'mesa') return 'Mesa ' + p.mesa_id
  return { mostrador: 'Mostrador', llevar: 'Para llevar', delivery: 'Delivery' }[p.tipo] || 'Pedido'
}

function pitido() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext
    const ctx = new Audio()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.value = 880; g.gain.value = 0.08
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25)
    setTimeout(() => ctx.close(), 400)
  } catch (e) { /* sin sonido */ }
}

export default function Cocina() {
  const { comandas, recargar } = useData()
  const toast = useToast()
  const [, setReloj] = useState(0)
  const nuevos = comandas.filter((c) => c.estado === 'recibido').length
  const antes = useRef(null)

  useEffect(() => { const t = setInterval(() => setReloj((x) => x + 1), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (antes.current !== null && nuevos > antes.current) pitido()
    antes.current = nuevos
  }, [nuevos])

  async function mover(c, estado, aviso) {
    try {
      await db(supabase.from('comandas').update({ estado, actualizado: new Date().toISOString() }).eq('id', c.id))
      await recargar()
      toast(aviso)
    } catch (e) { toast.error(e) }
  }

  function accion(c) {
    const delivery = c.pedidos && c.pedidos.tipo === 'delivery'
    if (c.estado === 'recibido') return { texto: 'Empezar', nuevo: 'prep', aviso: 'Ticket #' + c.numero + ' en preparación', icono: 'arrow' }
    if (c.estado === 'prep') return { texto: 'Marcar listo', nuevo: 'listo', aviso: 'Ticket #' + c.numero + ' listo', icono: 'arrow', fuerte: true }
    if (c.estado === 'listo' && delivery) return { texto: 'Salió a reparto', nuevo: 'camino', aviso: 'Ticket #' + c.numero + ' salió a reparto', icono: 'bike' }
    return { texto: 'Entregado', nuevo: 'entregado', aviso: 'Ticket #' + c.numero + ' entregado', icono: 'check' }
  }

  return (
    <div className="page">
      <div className="row wrap">
        <span className="pill acc">{comandas.length} pedidos activos</span>
        <span className="pill">Se actualiza solo cuando entra un pedido</span>
      </div>
      <div className="board">
        {COLUMNAS.map((col) => {
          const lista = comandas.filter((c) => c.estado === col.id)
          return (
            <section className="col" key={col.id} aria-label={col.l}>
              <h2 className="disp"><span className="dot" style={{ background: col.c }} />{col.l}<span className="pill" style={{ marginLeft: 'auto' }}>{lista.length}</span></h2>
              {lista.length === 0 && <div className="empty small">Sin pedidos</div>}
              {lista.map((c) => {
                const min = minutosDesde(c.creado)
                const cls = min >= 20 ? 'late' : min >= 12 ? 'mid' : ''
                const a = accion(c)
                const p = c.pedidos || {}
                return (
                  <article className={'ord' + (min >= 20 && c.estado !== 'camino' ? ' late' : '')} key={c.id}>
                    <div className="oh">
                      <span className="on num">#{c.numero}</span>
                      <span className="pill"><Icon n={ICONO_TIPO[p.tipo] || 'receipt'} size={15} />{etiqueta(c)}</span>
                      <span className={'timer ' + cls}><Icon n="clock" size={16} />{min} min</span>
                    </div>
                    <ul>
                      {(c.pedido_items || []).map((i, k) => <li key={k}><b className="num">{i.cantidad}×</b><span>{i.nombre}</span></li>)}
                    </ul>
                    {p.tipo === 'delivery' && (p.cliente || p.direccion) && <div className="note">{[p.cliente, p.direccion].filter(Boolean).join(' · ')}</div>}
                    {p.tipo === 'llevar' && p.cliente && <div className="note">{p.cliente}</div>}
                    <button className={'btn btn-sm' + (a.fuerte ? ' btn-primary' : '')} style={{ minHeight: 52 }} onClick={() => mover(c, a.nuevo, a.aviso)}>
                      {a.texto}<Icon n={a.icono} size={18} />
                    </button>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
