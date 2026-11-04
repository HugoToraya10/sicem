import { useState } from 'react'
import Icon from '../ui/Icon'
import './MapControls.css'

// Barra de control del mapa del Dashboard: zoom, encuadre, ir a lo más crítico,
// capas y pantalla completa. Recibe la instancia de Leaflet (`map`) y los
// callbacks de encuadre, que dependen de los datos y viven en Dashboard.
const LAYER_LABELS = [
    ['emergencies', 'Emergencias'],
    ['units', 'Unidades'],
    ['hospitals', 'Hospitales'],
    ['routes', 'Rutas'],
]

const UNIT_STATUS_OPTIONS = [
    ['all', 'Todas'],
    ['1', 'Disponibles'],
    ['2', 'En ruta'],
    ['3', 'En escena'],
    ['4', 'Trasladando'],
]

const MapControls = ({ map, onFitAll, onGoCritical, layers, onToggleLayer, unitFilter, onUnitFilter, isFullscreen, onToggleFullscreen }) => {
    const [layersOpen, setLayersOpen] = useState(false)

    return (
        <div className="mc" role="toolbar" aria-label="Controles del mapa">
            <div className="mc-group">
                <button type="button" className="mc-btn" onClick={() => map?.zoomIn()} aria-label="Acercar" title="Acercar"><Icon name="plus" size={18} /></button>
                <button type="button" className="mc-btn" onClick={() => map?.zoomOut()} aria-label="Alejar" title="Alejar"><Icon name="minus" size={18} /></button>
            </div>

            <div className="mc-group">
                <button type="button" className="mc-btn" onClick={onFitAll} aria-label="Ver todas las emergencias" title="Ver todas las emergencias"><Icon name="fit" size={18} /></button>
                <button type="button" className="mc-btn mc-btn-alert" onClick={onGoCritical} aria-label="Ir a la emergencia más crítica" title="Ir a la más crítica"><Icon name="crosshair" size={18} /></button>
            </div>

            <div className="mc-group mc-layers-wrap">
                <button
                    type="button"
                    className={`mc-btn ${layersOpen ? 'mc-btn-on' : ''}`}
                    onClick={() => setLayersOpen((v) => !v)}
                    aria-expanded={layersOpen}
                    aria-label="Capas del mapa"
                    title="Capas del mapa"
                >
                    <Icon name="layers" size={18} />
                </button>
                {layersOpen && (
                    <div className="mc-popover" role="group" aria-label="Capas del mapa">
                        <p className="mc-popover-title">Mostrar en el mapa</p>
                        {LAYER_LABELS.map(([key, label]) => (
                            <label key={key} className="mc-check">
                                <input type="checkbox" checked={layers[key]} onChange={() => onToggleLayer(key)} />
                                <span>{label}</span>
                            </label>
                        ))}
                        <p className="mc-popover-title">Unidades</p>
                        <div className="mc-chips">
                            {UNIT_STATUS_OPTIONS.map(([value, label]) => (
                                <button
                                    type="button"
                                    key={value}
                                    aria-pressed={unitFilter === value}
                                    onClick={() => onUnitFilter(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mc-group">
                <button
                    type="button"
                    className={`mc-btn ${isFullscreen ? 'mc-btn-on' : ''}`}
                    onClick={onToggleFullscreen}
                    aria-pressed={isFullscreen}
                    aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                    <Icon name="expand" size={18} />
                </button>
            </div>
        </div>
    )
}

export default MapControls
