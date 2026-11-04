// Marcadores de posición mientras llegan los datos: mantienen el espacio y dan sensación de carga rápida.
const SkeletonCards = ({ count = 6 }) => (
    <div className="entity-grid" aria-busy="true" aria-label="Cargando">
        {Array.from({ length: count }, (_, i) => (
            <div key={i} className="skeleton-card">
                <div className="skeleton-row">
                    <span className="skeleton skeleton-avatar" />
                    <span className="skeleton-lines"><span className="skeleton" style={{ width: '62%' }} /><span className="skeleton" style={{ width: '38%' }} /></span>
                </div>
                <span className="skeleton" style={{ width: '90%' }} />
                <span className="skeleton" style={{ width: '70%' }} />
            </div>
        ))}
    </div>
)

export default SkeletonCards
