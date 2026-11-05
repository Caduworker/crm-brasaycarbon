import { createClient } from '@supabase/supabase-js'

// Estas dos variables se escriben en Netlify (o en el archivo .env si pruebas en tu computadora).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null

// Cliente temporal que NO guarda sesión. Sirve para crear el usuario de un empleado
// sin cerrar la sesión del dueño que está usando el sistema.
export function crearClienteTemporal() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'bc-temporal' },
  })
}

// Ejecuta una consulta y lanza el error si falla (para usar con try/catch).
export async function db(consulta) {
  const { data, error } = await consulta
  if (error) throw error
  return data
}
