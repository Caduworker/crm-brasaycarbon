// Montos en Bolivianos: Bs 1.250 o Bs 12,50
export function bs(n) {
  const v = Number(n) || 0
  const neg = v < 0
  const [ent, dec] = Math.abs(v).toFixed(2).split('.')
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (neg ? '−' : '') + 'Bs ' + miles + (dec === '00' ? '' : ',' + dec)
}

// Cantidades: 12,5
export function fq(n) {
  return String(Math.round((Number(n) || 0) * 1000) / 1000).replace('.', ',')
}

export function minutosDesde(fecha) {
  if (!fecha) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000))
}

export function hora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fechaLarga(fecha = new Date()) {
  return new Date(fecha).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function aNumero(texto) {
  const n = parseFloat(String(texto ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function inicioDelDia(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const ROLES = [
  { id: 'admin', nombre: 'Dueño', desc: 'Acceso total', color: '#B83A0C' },
  { id: 'cajero', nombre: 'Cajero', desc: 'Cobra y cierra caja', color: '#2F6D8C' },
  { id: 'cocina', nombre: 'Cocina', desc: 'Prepara e inventario', color: '#7A5A12' },
  { id: 'mozo', nombre: 'Mozo', desc: 'Toma pedidos en mesa', color: '#4C7A3A' },
]
export const rolNombre = (id) => (ROLES.find((r) => r.id === id) || { nombre: id }).nombre

// Descarga una tabla como archivo que Excel abre directamente (.csv con tildes y comas decimales).
export function descargarExcel(nombreArchivo, columnas, filas) {
  const esc = (v) => {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '')
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = '﻿' + [columnas, ...filas].map((f) => f.map(esc).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo + '-' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
