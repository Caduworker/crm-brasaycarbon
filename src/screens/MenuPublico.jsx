import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Icon } from '../lib/icons.jsx'
import { Foto } from '../components/ui.jsx'
import { bs } from '../lib/format.js'
import wordmark from '../assets/wordmark.png'

// Pantalla pública: la carta digital que ve cualquier persona al entrar, sin iniciar sesión.
export default function MenuPublico({ onLogin }) {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cat, setCat] = useState('todas')
  const [q, setQ] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('productos').select('*').eq('activo', true).order('orden').order('nombre'),
    ]).then(([c, p]) => {
      if (!vivo) return
      if (c.error || p.error) setError('No se pudo cargar la carta. Intenta de nuevo en un momento.')
      else {
        const icono = Object.fromEntries(c.data.map((x) => [x.id, x.icono]))
        setCategorias(c.data)
        setProductos(p.data.map((x) => ({ ...x, icono: icono[x.categoria_id] || 'plate' })))
      }
      setCargando(false)
    })
    return () => { vivo = false }
  }, [])

  const mostrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return productos.filter((p) => (cat === 'todas' || p.categoria_id === cat) &&
      (!t || p.nombre.toLowerCase().includes(t) || (p.detalle || '').toLowerCase().includes(t)))
  }, [productos, cat, q])

  const grupos = categorias
    .map((c) => ({ c, items: mostrados.filter((p) => p.categoria_id === c.id) }))
    .filter((g) => g.items.length)

  return (
    <div className="pub">
      <header className="pub-top">
        <img src={wordmark} alt="Brasa y Carbón" className="pub-logo" />
        <button className="btn pub-login" onClick={onLogin}>
          <Icon n="lock" size={20} />Iniciar sesión
        </button>
      </header>

      <main className="pub-main">
        <section className="pub-hero">
          <h1>Nuestra carta</h1>
          <p>Carnes a la brasa, achicoria y cena típica. Pide a tu mozo lo que se te antoje.</p>
        </section>

        <div className="pub-tools">
          <input className="input" type="search" placeholder="Buscar un plato…" aria-label="Buscar un plato"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pub-cats" role="tablist" aria-label="Categorías">
            <button role="tab" aria-selected={cat === 'todas'} className={'pub-chip' + (cat === 'todas' ? ' on' : '')}
              onClick={() => setCat('todas')}>Todo</button>
            {categorias.map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id}
                className={'pub-chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.nombre}</button>
            ))}
          </div>
        </div>

        {cargando && <p className="muted pub-msg">Cargando la carta…</p>}
        {error && <p className="hint err pub-msg" role="alert">{error}</p>}
        {!cargando && !error && !grupos.length && <p className="muted pub-msg">No encontramos platos con esa búsqueda.</p>}

        {grupos.map(({ c, items }) => (
          <section key={c.id} className="pub-sec">
            <h2 className="pub-h2">{c.nombre}</h2>
            <div className="pub-grid">
              {items.map((p) => (
                <article key={p.id} className="pub-card">
                  <Foto p={p} clase="pub-ph" />
                  <div className="pub-info">
                    <h3>{p.nombre}</h3>
                    {p.detalle && <p className="muted small">{p.detalle}</p>}
                    <div className="pub-precio num">{bs(p.precio)}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="pub-foot muted small">Brasa y Carbón · Restaurant y Churrasquería</footer>
    </div>
  )
}
