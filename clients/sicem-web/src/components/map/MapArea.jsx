import './MapArea.css'

// Placeholder de mapa — Hugo conecta @vis.gl/react-google-maps aquí
const MapArea = ({ ambulances }) => {
    return (
        <div className="map-area">
            {/* TODO (Hugo): reemplazar este div por <Map> de @vis.gl/react-google-maps,
                centrado en Villahermosa, Tabasco (17.9869, -92.9303).
                Recorrer `ambulances` y renderizar un <AdvancedMarker> por cada una,
                coloreado según su ambulance_status_id. */}
            <div className="map-placeholder-box">
                <span className="map-placeholder-icon">🗺</span>
                <span className="map-placeholder-text">Mapa en tiempo real</span>
                <span className="map-placeholder-sub">Google Maps — Villahermosa, Tabasco</span>
            </div>

            <div className="map-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: '#2E7D32' }} />Disponible</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#C0272D' }} />En ruta</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#E65100' }} />En escena</div>
            </div>
        </div>
    )
}

export default MapArea