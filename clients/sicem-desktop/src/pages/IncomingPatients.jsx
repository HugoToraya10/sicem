import { useState, useEffect, useCallback } from 'react'
import IncomingPatientCard from '../components/patients/IncomingPatientCard'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import PatientDetailModal from '../components/patients/PatientDetailModal'
import RejectReasonModal from '../components/patients/RejectReasonModal'
import { ensureNotificationPermission, alertNewPatient } from '../utils/notify'
import './IncomingPatients.css'

const UNASSIGNED_SPECIALITY_LABEL = 'Sin especialidad asignada'

// Menor max_wait_minutes = triage más urgente (así está diseñado el catálogo
// de niveles de triage) — sin triage asignado se manda al final, no al frente,
// para no competir por atención con algo que sí tiene urgencia confirmada.
const priorityScore = (p) => {
    const wait = p.max_wait_minutes
    return (wait === null || wait === undefined) ? Infinity : Number(wait)
}

const sortByPriority = (list) => [...list].sort((a, b) => {
    const scoreDiff = priorityScore(a) - priorityScore(b)
    if (scoreDiff !== 0) return scoreDiff
    // Mismo nivel de urgencia: quien lleva más tiempo esperando va primero.
    return new Date(a.created_at) - new Date(b.created_at)
})

// Esta pantalla es SOLO la bandeja de entrada — pacientes que de verdad piden
// una decisión (Aceptar/Rechazar) ahora mismo. En cuanto se decide, salen de
// aquí: los aceptados viven en Seguimiento, los rechazados en Historial.
const IncomingPatients = () => {
    const { user, token } = useAuth()
    const [patients, setPatients] = useState([])
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [specialityCapacity, setSpecialityCapacity] = useState([])
    const [rejectingPatientId, setRejectingPatientId] = useState(null)

    const fetchIncomingPatients = useCallback(() => {
        fetch(`${API_BASE_URL}/emergencias/pacientes-en-camino/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data.map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error recuperando pacientes en camino. ', error))
    }, [user, token])

    useEffect(() => {
        fetchIncomingPatients()
    }, [fetchIncomingPatients])

    // Camas disponibles por especialidad de la propia institución — mismo
    // patrón de fetch-y-cruzar que Capacity.jsx — para poder avisar si ya
    // vienen más solicitudes de una especialidad que camas libres hay para ella.
    useEffect(() => {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/hospitales/especialidades`, { headers }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                const catalog = catalogRes.data.map(s => toLowerCaseKeys(s))
                const mine = institutionSpecialtiesRes.data
                    .map(row => toLowerCaseKeys(row))
                    .filter(row => parseInt(row.institution_id) === parseInt(user.institutionId) && row.is_active)
                    .map(row => ({
                        ...row,
                        name: catalog.find(s => s.speciality_id === row.speciality_id)?.name || 'Especialidad'
                    }))
                setSpecialityCapacity(mine)
            })
            .catch(error => console.error('Error recuperando capacidad por especialidad. ', error))
    }, [user, token])

    // Fuerza un re-render cada minuto para que el badge de tiempo esperando
    // (y la marca de "vencido" contra el triage) avancen solos.
    const [, forceTick] = useState(0)
    useEffect(() => {
        const interval = setInterval(() => forceTick((t) => t + 1), 60000)
        return () => clearInterval(interval)
    }, [])

    // Se pide el permiso de notificaciones apenas se monta esta pantalla, no
    // hasta que llegue el primer paciente — así ya está listo para entonces.
    useEffect(() => {
        ensureNotificationPermission()
    }, [])

    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        // Sin importar si el evento era para nosotros o para otro hospital (p.ej.
        // nos acaban de QUITAR un paciente por reasignación), siempre
        // refrescamos la lista — el backend ya filtra por institución en el
        // query, es más simple y correcto que adivinar en el cliente si nos
        // afecta. La ALERTA (sonido + notificación nativa) sí se filtra aparte:
        // este evento llega a TODOS los hospitales conectados (sala 'hospital'
        // completa), no solo al nuestro, así que sin este filtro cualquier
        // hospital sonaría por un paciente que ni siquiera es suyo.
        emergencySocket.on('eventPatientRegistered', (data) => {
            fetchIncomingPatients()
            if (data?.destinationInstitutionId && parseInt(data.destinationInstitutionId) === parseInt(user.institutionId)) {
                alertNewPatient('Nuevo paciente en camino', data.notes || 'Se asignó un paciente a tu institución.')
            }
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            setPatients((current) => current.filter((p) => p.emergency_id !== closedId))
        })

        return () => emergencySocket.disconnect()
    }, [token, user, fetchIncomingPatients])

    // "Concluir traslado" desde sicem-mobile — va en el socket de unidades
    // (puerto 3003), no en el de emergencias. El resaltado en rojo se deriva
    // directo de patient.paramedic_concluded_at (ya viene en la respuesta de
    // fetchIncomingPatients, ver getIncomingPatientsByInstitution), así que
    // aquí solo hace falta refrescar la lista para que ese dato llegue —
    // nada de estado local aparte que se pueda perder al navegar entre
    // pantallas.
    useEffect(() => {
        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventTransferConcluded', (data) => {
            const mine = (data?.hospitalInstitutionIds || []).some((id) => parseInt(id) === parseInt(user.institutionId))
            if (mine) fetchIncomingPatients()
        })
        return () => unitsSocket.disconnect()
    }, [token, user, fetchIncomingPatients])

    const handleAccept = (emergencyPatientId) => {
        fetch(`${API_BASE_URL}/emergencias/confirmar-recepcion-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId, accepted: true })
        })
            .then(res => res.json().then(body => {
                // Si el backend bloqueó por falta de camas, ese mensaje específico
                // es justo lo que necesita ver el hospital — no uno genérico.
                if (!res.ok) throw new Error(body.message || 'No se pudo confirmar la recepción')
                return body
            }))
            .then(() => {
                // Al aceptar deja de ser "pendiente" — el filtro de abajo lo saca
                // solo de esta pantalla (ahora vive en Seguimiento).
                setPatients((current) => current.map((p) =>
                    p.emergency_patient_id === emergencyPatientId
                        ? { ...p, reception_status_id: 2, reception_status_name: 'Aceptada' }
                        : p
                ))
            })
            .catch(error => {
                console.error('Error aceptando paciente. ', error)
                alert(error.message || 'No se pudo confirmar la recepción. Intenta de nuevo.')
            })
    }

    // Solo abre el modal que pide el motivo — la petición real la dispara
    // handleConfirmReject una vez que el usuario confirma ahí.
    const handleReject = (emergencyPatientId) => {
        setRejectingPatientId(emergencyPatientId)
    }

    const handleConfirmReject = (rejectionReason) => {
        const emergencyPatientId = rejectingPatientId
        fetch(`${API_BASE_URL}/emergencias/confirmar-recepcion-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId, accepted: false, rejectionReason })
        })
            .then(res => {
                if (!res.ok) throw new Error('No se pudo rechazar')
                return res.json()
            })
            .then(() => {
                // El backend excluye a los rechazados de este mismo endpoint,
                // así que simplemente lo quitamos de la lista local.
                setPatients((current) => current.filter((p) => p.emergency_patient_id !== emergencyPatientId))
                setRejectingPatientId(null)
            })
            .catch(error => {
                console.error('Error rechazando paciente. ', error)
                alert('No se pudo rechazar al paciente. Intenta de nuevo.')
            })
    }

    const handleViewDetail = (patient) => setSelectedPatient(patient)

    const pendingPatients = patients.filter((p) => parseInt(p.reception_status_id) === 1)

    const groupedBySpeciality = pendingPatients.reduce((groups, patient) => {
        const key = patient.speciality_name || UNASSIGNED_SPECIALITY_LABEL
        if (!groups[key]) groups[key] = []
        groups[key].push(patient)
        return groups
    }, {})

    // El grupo con el paciente más urgente sube al frente — "sin especialidad"
    // siempre al final, no compite por prioridad porque todavía no sabemos a
    // dónde va exactamente.
    const specialityNames = Object.keys(groupedBySpeciality).sort((a, b) => {
        if (a === UNASSIGNED_SPECIALITY_LABEL) return 1
        if (b === UNASSIGNED_SPECIALITY_LABEL) return -1
        const aMin = Math.min(...groupedBySpeciality[a].map(priorityScore))
        const bMin = Math.min(...groupedBySpeciality[b].map(priorityScore))
        return aMin - bMin
    })

    return (
        <div className="incoming-layout">
            {pendingPatients.length === 0 && (
                <p className="empty-state">Sin solicitudes pendientes por ahora.</p>
            )}

            {specialityNames.map((specialityName) => {
                const isUnassigned = specialityName === UNASSIGNED_SPECIALITY_LABEL
                const groupPatients = sortByPriority(groupedBySpeciality[specialityName])
                const capacityRow = !isUnassigned ? specialityCapacity.find((s) => s.name === specialityName) : null
                const isOverCapacity = capacityRow && groupPatients.length > capacityRow.available_beds
                return (
                    <div key={specialityName} className="speciality-group">
                        <div className={`section-title ${isUnassigned ? 'unassigned' : ''} ${isOverCapacity ? 'over-capacity' : ''}`}>
                            <span>{specialityName} ({groupPatients.length})</span>
                            {capacityRow && (
                                <span className="capacity-hint" title="Camas disponibles ahora mismo para esta especialidad">
                                    {isOverCapacity && '⚠ '}
                                    {capacityRow.available_beds} cama{capacityRow.available_beds === 1 ? '' : 's'} disponible{capacityRow.available_beds === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                        {isOverCapacity && (
                            <p className="over-capacity-hint">
                                Ojo: llegan más solicitudes de {specialityName} ({groupPatients.length}) que camas disponibles hay ({capacityRow.available_beds}) — prioriza con cuidado cuáles aceptar.
                            </p>
                        )}
                        {isUnassigned && (
                            <p className="unassigned-hint">
                                Estos pacientes no tienen especialidad asignada por el despachador todavía.
                            </p>
                        )}
                        {groupPatients.map((p) => (
                            <IncomingPatientCard
                                key={p.emergency_patient_id}
                                patient={p}
                                hospitalInstitutionId={user.institutionId}
                                onViewDetail={handleViewDetail}
                                onAccept={handleAccept}
                                onReject={handleReject}
                            />
                        ))}
                    </div>
                )
            })}

            {selectedPatient && (
                <PatientDetailModal
                    patient={selectedPatient}
                    token={token}
                    onClose={() => setSelectedPatient(null)}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onPatientUpdated={(emergencyPatientId, changes) => {
                        setPatients((current) => current.map((p) =>
                            p.emergency_patient_id === emergencyPatientId ? { ...p, ...changes } : p
                        ))
                    }}
                />
            )}

            {rejectingPatientId && (
                <RejectReasonModal
                    onConfirm={handleConfirmReject}
                    onCancel={() => setRejectingPatientId(null)}
                />
            )}

        </div>
    )
}

export default IncomingPatients
