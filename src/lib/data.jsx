import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'

const DataCtx = createContext(null)
export const useData = () => useContext(DataCtx)

const VACIO = {
  cargando: true, error: null,
  categorias: [], productos: [], mesas: [], pedidos: [], comandas: [],
  insumos: [], recetaItems: [], caja: null, gastos: [], perfiles: [],
}

// Carga todo lo que las pantallas necesitan y lo mantiene al día
// (se refresca solo cuando alguien cambia algo y cada 30 segundos).
export function DataProvider({ children }) {
  const { perfil } = useAuth()
  const [datos, setDatos] = useState(VACIO)
  const espera = useRef(null)
  const vivo = useRef(true)

  const recargar = useCallback(async () => {
    try {
      const esAdmin = perfil.rol === 'admin'
      const puedeCaja = esAdmin || perfil.rol === 'cajero'
      const [cat, prod, mes, ped, com, ins, rec, caja, per] = await Promise.all([
        supabase.from('categorias').select('*').order('orden'),
        supabase.from('productos').select('*').order('orden').order('nombre'),
        supabase.from('mesas').select('*').order('id'),
        supabase.from('pedidos').select('*, pedido_items(*)').eq('estado', 'abierto').order('id'),
        supabase.from('comandas').select('*, pedido_items(nombre, cantidad), pedidos(tipo, mesa_id, cliente, direccion)')
          .neq('estado', 'entregado').order('id'),
        supabase.from('insumos').select('*').order('nombre'),
        supabase.from('receta_items').select('*'),
        puedeCaja ? supabase.from('cajas').select('*').eq('estado', 'abierta').order('id', { ascending: false }).limit(1)
                  : Promise.resolve({ data: [] }),
        esAdmin ? supabase.from('perfiles').select('*').order('creado') : Promise.resolve({ data: [] }),
      ])
      const falla = [cat, prod, mes, ped, com, ins, rec, caja, per].find((r) => r.error)
      if (falla) throw falla.error
      const cajaAbierta = (caja.data || [])[0] || null
      let gastos = []
      if (cajaAbierta) {
        const g = await supabase.from('gastos').select('*').eq('caja_id', cajaAbierta.id).order('id')
        if (g.error) throw g.error
        gastos = g.data
      }
      const icono = Object.fromEntries(cat.data.map((c) => [c.id, c.icono]))
      const productos = prod.data.map((p) => ({ ...p, icono: icono[p.categoria_id] || 'plate' }))
      if (!vivo.current) return
      setDatos({
        cargando: false, error: null,
        categorias: cat.data, productos, mesas: mes.data, pedidos: ped.data, comandas: com.data,
        insumos: ins.data, recetaItems: rec.data, caja: cajaAbierta, gastos, perfiles: per.data || [],
      })
    } catch (e) {
      if (vivo.current) setDatos((d) => ({ ...d, cargando: false, error: e.message || 'No se pudo cargar la información' }))
    }
  }, [perfil.rol])

  useEffect(() => {
    vivo.current = true
    recargar()
    const canal = supabase
      .channel('cambios-' + perfil.id)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        clearTimeout(espera.current)
        espera.current = setTimeout(recargar, 350)
      })
      .subscribe()
    const reloj = setInterval(recargar, 30000)
    return () => {
      vivo.current = false
      clearTimeout(espera.current)
      clearInterval(reloj)
      supabase.removeChannel(canal)
    }
  }, [recargar, perfil.id])

  return <DataCtx.Provider value={{ ...datos, recargar }}>{children}</DataCtx.Provider>
}
