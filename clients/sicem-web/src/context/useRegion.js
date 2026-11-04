import { createContext, useContext } from 'react'
import { buildRegion } from '../utils/region'

export const RegionContext = createContext(null)

// Fuera del proveedor (p. ej. Login) devuelve la vista neutral de todo el país.
export const useRegion = () => useContext(RegionContext) || { region: buildRegion(null, ''), chooseState: () => {} }
