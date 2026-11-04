import { useState } from 'react'
import AmbulanceDetailPanel from './AmbulanceDetailPanel'
import './AmbulanceStatusCard.css'

const STATUS_COLOR_CLASS = {
    1: 'status-available',   // Disponible
    2: 'status-enroute',     // En camino
    3: 'status-onscene',     // En escena
    4: 'status-transporting',// Trasladando
    5: 'status-outofservice',// Fuera de servicio
    6: 'status-maintenance', // En mantenimiento
    7: 'status-reserved',    // Reservada
}

const AmbulanceStatusCard = ({ ambulance, statuses, onUpdateStatus, crew = [], onlineParamedicIds = new Set(), institutionName, detailOpen, onToggleDetail }) => {
    const [selectedStatusId, setSelectedStatusId] = useState(ambulance.ambulance_status_id)
    const [saving, setSaving] = useState(false)

    const currentStatusName = statuses.find(s => s.ambulance_status_id === ambulance.ambulance_status_id)?.name || 'Desconocido'
    const colorClass = STATUS_COLOR_CLASS[parseInt(ambulance.ambulance_status_id)] || 'status-unknown'

    const crewForAmbulance = crew.filter((p) =>
        p.assigned_ambulance_id && String(p.assigned_ambulance_id) === String(ambulance.ambulance_id)
    )

    const crewOnline = crewForAmbulance.filter((p) => onlineParamedicIds.has(String(p.user_profile_id))).length

    const handleUpdate = () => {
        if (parseInt(selectedStatusId) === parseInt(ambulance.ambulance_status_id)) return
        setSaving(true)
        onUpdateStatus(ambulance.ambulance_id, parseInt(selectedStatusId)).finally(() => setSaving(false))
    }

    return (
        <div className={`ambulance-card ${colorClass}`}>
            <div className="ambulance-head">
                <div className="ambulance-titles">
                    <h2>Unidad {ambulance.unit_number}</h2>
                    <p className="ambulance-sub">{ambulance.type_name}</p>
                </div>
                <span className={`ambulance-status-badge ${colorClass}`}>{currentStatusName}</span>
            </div>

            <dl className="ambulance-facts">
                <div><dt>Placa</dt><dd>{ambulance.license_plate}</dd></div>
                <div>
                    <dt>Tripulación</dt>
                    <dd>
                        {crewForAmbulance.length === 0 ? 'Sin asignar' : `${crewForAmbulance.length} ${crewForAmbulance.length === 1 ? 'paramédico' : 'paramédicos'}`}
                        {crewOnline > 0 && <span className="ambulance-online"> · {crewOnline} en línea</span>}
                    </dd>
                </div>
            </dl>

            <div className="ambulance-status-row">
                <select className="select" aria-label={`Nuevo estado de la unidad ${ambulance.unit_number}`} value={selectedStatusId} onChange={(e) => setSelectedStatusId(e.target.value)} disabled={saving}>
                    {statuses.map((s) => (
                        <option key={s.ambulance_status_id} value={s.ambulance_status_id}>{s.name}</option>
                    ))}
                </select>
                <button type="button" className="btn btn-primary" onClick={handleUpdate} disabled={saving || parseInt(selectedStatusId) === parseInt(ambulance.ambulance_status_id)}>
                    {saving ? 'Guardando…' : 'Cambiar estado'}
                </button>
            </div>

            <button type="button" className="btn btn-ghost detail-btn" onClick={onToggleDetail}>Ver detalle y tripulación</button>

            <AmbulanceDetailPanel
                open={Boolean(detailOpen)}
                onClose={onToggleDetail}
                ambulance={ambulance}
                statusName={currentStatusName}
                institutionName={institutionName}
                crew={crewForAmbulance}
                onlineParamedicIds={onlineParamedicIds}
            />
        </div>
    )
}

export default AmbulanceStatusCard
