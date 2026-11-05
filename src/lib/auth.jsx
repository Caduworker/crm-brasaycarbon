import { createContext, useContext } from 'react'

// Guarda quién entró (perfil) y cómo cerrar sesión, para usarlo en cualquier pantalla.
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export const puede = (perfil, roles) => Boolean(perfil && roles.includes(perfil.rol))
