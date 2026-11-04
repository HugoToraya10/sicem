import { useState, useEffect } from 'react'
import { useRegion } from '../../context/useRegion'

// Reloj en vivo con su propio estado: así el segundero no vuelve a renderizar
// (ni a repintar los marcadores del mapa) el componente que lo contiene.
// La zona horaria sale de la región de la institución (no de la IP ni de un estado fijo).
const LiveClock = () => {
    const { region } = useRegion()
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return now.toLocaleTimeString('es-MX', { hour12: false, timeZone: region.timeZone })
}

export default LiveClock
