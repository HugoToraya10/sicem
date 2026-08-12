import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './EmergencyDetail.css';
import { getNavLinks } from '../utils/Navlinks';
import { parseResponse } from '../utils/apiRequest';
import { connectEmergencySocket } from '../sockets/emergencySocket';
import { connectUnitsSocket } from '../sockets/unitsSocket';
import MapArea from '../components/map/MapArea';
import {API_BASE_URL} from '../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

// Secuencia fija de avance manual. "Cerrada" nunca aparece aquí a propósito —
// el cierre es exclusivo del botón "Cerrar Emergencia".
const STATUS_SEQUENCE = ['Registrada', 'Asignada', 'En atención', 'Trasladando']

const formatDateTime = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Arma la línea de tiempo cronológica combinando los timestamps ya disponibles:
// registro, asignaciones/desasignaciones de ambulancia, notas de urgencia y cierre.
const buildTimeline = (emergencyData, assignments, patients, notesByPatient) => {
    const events = []

    if (emergencyData?.created_at) {
        events.push({
            at: emergencyData.created_at,
            label: 'Emergencia registrada',
            detail: emergencyData.type_name || '',
        })
    }

    assignments.forEach((a) => {
        if (a.assigned_at) {
            events.push({
                at: a.assigned_at,
                label: 'Ambulancia asignada',
                detail: a.unit_number ? `Unidad ${a.unit_number}` : '',
            })
        }
        if (a.unassigned_at) {
            events.push({
                at: a.unassigned_at,
                label: 'Ambulancia desasignada',
                detail: a.unit_number ? `Unidad ${a.unit_number}` : '',
            })
        }
    })

    const patientById = Object.fromEntries(patients.map(p => [p.emergency_patient_id, p]))
    Object.entries(notesByPatient).forEach(([emergencyPatientId, notes]) => {
        const patient = patientById[emergencyPatientId]
        const patientName = patient?.first_name
            ? `${patient.first_name} ${patient.first_surname || ''}`.trim()
            : 'Paciente sin identificar'
        notes.forEach((note) => {
            if (note.recorded_at) {
                events.push({
                    at: note.recorded_at,
                    label: 'Nota de urgencia registrada',
                    detail: `${patientName}${note.initial_diagnosis ? ` — ${note.initial_diagnosis}` : ''}`,
                })
            }
        })
    })

    if (emergencyData?.closed_at) {
        events.push({
            at: emergencyData.closed_at,
            label: 'Emergencia cerrada',
            detail: '',
        })
    }

    return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

const EmergencyDetail = () => {
    const { emergencyId } = useParams();
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencyData, setEmergencyData] = useState(null);
    const [patients, setPatients] = useState([]);
    const [notesByPatient, setNotesByPatient] = useState({});
    const [assignments, setAssignments] = useState([]);
    const [emergencyStatuses, setEmergencyStatuses] = useState([]);
    const [clinicalByPatient, setClinicalByPatient] = useState({});

    // Identificar paciente sin datos
    const [identifyingPatientId, setIdentifyingPatientId] = useState(null);
    const [identifyForm, setIdentifyForm] = useState({ firstName: '', firstSurname: '', secondSurname: '', cveUnicaRegistroPob: '', birthDate: '', phone: '' });

    // Agregar paciente a la emergencia en curso
    const [showAddPatientForm, setShowAddPatientForm] = useState(false);
    const [addPatientForm, setAddPatientForm] = useState({ curp: '', found: null, userProfileId: null, firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '', notes: '' });
    const [addPatientCurpBusy, setAddPatientCurpBusy] = useState(false);

    // Agregar ambulancia adicional a la emergencia en curso
    const [showAddAmbulanceForm, setShowAddAmbulanceForm] = useState(false);
    const [availableUnitsForAdd, setAvailableUnitsForAdd] = useState([]);
    const [selectedUnitsToAdd, setSelectedUnitsToAdd] = useState([]);
    // Unidades de OTRAS instituciones — van por solicitud interinstitucional,
    // no por asignación directa (mismo criterio que NewEmergency.jsx).
    const [externalUnitsForAdd, setExternalUnitsForAdd] = useState([]);
    const [selectedExternalUnitsToAdd, setSelectedExternalUnitsToAdd] = useState([]);
    const [externalUnitsInPlay, setExternalUnitsInPlay] = useState([]);
    // Distancia/tiempo real de cada unidad propia disponible hasta ESTA
    // emergencia — mismo criterio que NewEmergency.jsx, para que el
    // despachador vea cuál conviene más al agregar (o reasignar).
    const [addUnitRoutes, setAddUnitRoutes] = useState({});
    const [addRoutesLoading, setAddRoutesLoading] = useState(false);
    const [addUnitLocations, setAddUnitLocations] = useState({});

    // Reasignar hospital destino de un paciente Pendiente/Rechazado
    const [destinationInstitutions, setDestinationInstitutions] = useState([]);
    const [reassigningPatientId, setReassigningPatientId] = useState(null);
    const [reassignInstitutionId, setReassignInstitutionId] = useState('');
    const [reassignSpecialityId, setReassignSpecialityId] = useState('');
    const [institutionSpecialities, setInstitutionSpecialities] = useState([]);
    const [specialitiesCatalog, setSpecialitiesCatalog] = useState([]);

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchEmergencyData = () => {
        fetch(`${API_BASE_URL}/emergencias/emergencia/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setEmergencyData(toLowerCaseKeys(data)))
            .catch(error => console.error('Ocurrió un error al consultar esta emergencia. ', error))
    }
    useEffect(() => { fetchEmergencyData() }, [emergencyId]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/estados-emergencia`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setEmergencyStatuses((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de emergencia. ', error))
    }, []);

    const fetchPatients = () => {
        fetch(`${API_BASE_URL}/emergencias/pacientes/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data.map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error consultando pacientes. ', error))
    }
    useEffect(() => { fetchPatients() }, [emergencyId]);

    useEffect(() => {
        patients.forEach((patient) => {
            fetch(`${API_BASE_URL}/emergencias/notas/${patient.emergency_patient_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(({ data }) => {
                    setNotesByPatient((prev) => ({
                        ...prev,
                        [patient.emergency_patient_id]: data.map(n => toLowerCaseKeys(n))
                    }))
                })
                .catch(error => console.error('Error consultando notas de paciente. ', error))
        })
    }, [patients]);

    // Alergias/condiciones/medicamentos del expediente clínico de cada paciente identificado
    // (el tipo de sangre ya viene incluido en /emergencias/pacientes/:emergencyId, no hace falta pedirlo aparte)
    useEffect(() => {
        patients.forEach((patient) => {
            if (!patient.user_profile_id) return
            fetch(`${API_BASE_URL}/pacientes/ece/${patient.user_profile_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(({ clinicalRecord }) => {
                    const record = Array.isArray(clinicalRecord) ? clinicalRecord[0] : null
                    if (!record) return
                    const clinicalRecordId = toLowerCaseKeys(record).clinical_record_id
                    Promise.all([
                        fetch(`${API_BASE_URL}/pacientes/alergias/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                        fetch(`${API_BASE_URL}/pacientes/condiciones/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                        fetch(`${API_BASE_URL}/pacientes/medicamentos/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                    ]).then(([allergiesRes, conditionsRes, medicationsRes]) => {
                        setClinicalByPatient((prev) => ({
                            ...prev,
                            [patient.emergency_patient_id]: {
                                allergies: (allergiesRes.allergies || []).map(a => toLowerCaseKeys(a)),
                                conditions: (conditionsRes.conditions || []).map(c => toLowerCaseKeys(c)),
                                medications: (medicationsRes.medications || []).map(m => toLowerCaseKeys(m)),
                            }
                        }))
                    })
                })
                .catch(error => console.error('Error consultando expediente clínico del paciente. ', error))
        })
    }, [patients]);

    const fetchAssignments = () => {
        fetch(`${API_BASE_URL}/emergencias/asignaciones/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAssignments(data.map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando asignaciones. ', error))
    }
    useEffect(() => { fetchAssignments() }, [emergencyId]);

    // Solicitudes interinstitucionales de esta emergencia que TODAVÍA pueden
    // llegar — Pendiente (1) o Aceptada (2). No hace falta esperar a que se
    // acepte para poder asignarla a un paciente: si al final se rechaza, el
    // backend suelta esa unidad sola (clearAmbulanceFromEmergencyPatients) y
    // el socket de abajo refresca esta pantalla.
    const fetchExternalUnitsInPlay = () => {
        // Solo admin/dispatcher tienen acceso a este endpoint — un hospital (rol 4)
        // que vea esta pantalla no necesita esta lista de todos modos.
        if (![1, 2].includes(parseInt(user?.roleId))) return
        fetch(`${API_BASE_URL}/emergencias/solicitudes`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => {
                const inPlay = (data || [])
                    .map(r => toLowerCaseKeys(r))
                    .filter(r => String(r.emergency_id) === String(emergencyId) && [1, 2].includes(parseInt(r.request_status_id)))
                setExternalUnitsInPlay(inPlay)
            })
            .catch(error => console.error('Error consultando solicitudes interinstitucionales. ', error))
    }
    useEffect(() => { fetchExternalUnitsInPlay() }, [emergencyId]);

    // Ubicación en vivo de cada unidad ligada a esta emergencia (propias +
    // externas, aceptadas o todavía pendientes) — mismo patrón que Dashboard.jsx:
    // se pide la lista y luego, por cada unidad, su última ubicación conocida.
    const [ambulanceLocations, setAmbulanceLocations] = useState([]);
    useEffect(() => {
        const units = [
            ...assignments.map(a => ({ ambulance_id: a.ambulance_id, unit_number: a.unit_number, ambulance_status_id: a.ambulance_status_id })),
            ...externalUnitsInPlay.map(r => ({ ambulance_id: r.ambulance_id, unit_number: r.unit_number, ambulance_status_id: r.ambulance_status_id })),
        ].filter((u, index, list) => u.ambulance_id && list.findIndex(x => x.ambulance_id === u.ambulance_id) === index)

        if (units.length === 0) { setAmbulanceLocations([]); return }

        Promise.all(units.map((u) =>
            fetch(`${API_BASE_URL}/unidades/ubicacion/${u.ambulance_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then((res) => res.ok ? res.json() : { data: null })
                .then(({ data }) => ({
                    ...u,
                    latitude: data ? toLowerCaseKeys(data).latitude : null,
                    longitude: data ? toLowerCaseKeys(data).longitude : null,
                }))
                .catch(() => ({ ...u, latitude: null, longitude: null }))
        )).then(setAmbulanceLocations)
    }, [assignments, externalUnitsInPlay, token]);

    // Traza completa (punto A: cada unidad → punto B: la emergencia) — a
    // diferencia de NewEmergency.jsx (que solo traza la más cercana, porque
    // ahí se está eligiendo cuál mandar), aquí ya se sabe cuáles van, así que
    // se dibujan todas las que tengan ubicación conocida.
    const [ambulanceRoutes, setAmbulanceRoutes] = useState([]);
    useEffect(() => {
        if (!emergencyData?.latitude || !emergencyData?.longitude) { setAmbulanceRoutes([]); return }
        const withLocation = ambulanceLocations.filter(a => a.latitude && a.longitude)
        if (withLocation.length === 0) { setAmbulanceRoutes([]); return }

        Promise.all(withLocation.map((a) => {
            const url = `https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${emergencyData.longitude},${emergencyData.latitude}?overview=full&geometries=geojson`
            return fetch(url)
                .then(res => res.json())
                .then((data) => {
                    if (data.code !== 'Ok' || !data.routes?.[0]) return null
                    return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
                })
                .catch(() => null)
        })).then((results) => setAmbulanceRoutes(results.filter(Boolean).map(coordinates => ({ coordinates }))))
    }, [ambulanceLocations, emergencyData?.latitude, emergencyData?.longitude]);

    // Mismo fetch que ya usa NewEmergency.jsx para el selector de hospital destino
    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-destino`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setDestinationInstitutions(data.map(inst => toLowerCaseKeys(inst))))
            .catch(error => console.error('Error recuperando instituciones de destino. ', error))
    }, []);

    // Mismo patrón que NewEmergency.jsx / Capacity.jsx (sicem-desktop): trae ambas
    // listas una sola vez y filtra en el cliente por institución al renderizar.
    useEffect(() => {
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers: { "Content-Type": "application/json" } }).then(res => res.json()),
            fetch(`${API_BASE_URL}/hospitales/especialidades`, { headers: { "Content-Type": "application/json" } }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                setInstitutionSpecialities((institutionSpecialtiesRes.data || []).map(row => toLowerCaseKeys(row)))
                setSpecialitiesCatalog((catalogRes.data || []).map(s => toLowerCaseKeys(s)))
            })
            .catch(error => console.error('Error recuperando especialidades por institución. ', error))
    }, []);

    // Un hospital confirmó o rechazó la recepción de un paciente — si es de esta
    // emergencia, actualiza su status en pantalla sin que el despachador recargue.
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        // Una unidad de esta emergencia se desasignó — desde aquí mismo (ya se
        // refresca directo, ver handleUnassignAmbulance), pero también puede
        // pasar desde la campana de fallas reportadas (otra pestaña, u otra
        // sesión) — sin esto, esta pantalla se quedaba mostrando la unidad ya
        // desasignada hasta recargar.
        emergencySocket.on('eventAmbulanceUnassigned', (data) => {
            if (!data.emergencyId || String(data.emergencyId) !== String(emergencyId)) return
            fetchAssignments()
        })

        // Si esta emergencia se quedó sin ninguna unidad activa, el backend la
        // regresa sola a "Registrada" — refleja el cambio de estado sin que
        // haga falta recargar la página.
        emergencySocket.on('eventEmergencyStatusUpdated', (data) => {
            if (!data.emergencyId || String(data.emergencyId) !== String(emergencyId)) return
            fetchEmergencyData()
        })

        emergencySocket.on('eventPatientReceptionUpdated', (data) => {
            if (String(data.emergencyId) !== String(emergencyId)) return
            setPatients((current) => current.map((p) =>
                p.emergency_patient_id === data.emergencyPatientId
                    ? { ...p, reception_status_name: data.accepted ? 'Aceptada' : 'Rechazada' }
                    : p
            ))
        })

        // Nueva solicitud enviada — aparece en el pool de inmediato, sin esperar
        // a que se acepte.
        emergencySocket.on('eventInterInstitutionalRequest', (data) => {
            if (String(data.emergencyId) !== String(emergencyId)) return
            fetchExternalUnitsInPlay()
        })

        // Si un hospital acepta/rechaza (o el despachador cancela) una solicitud de
        // esta misma emergencia: refresca el pool, y también a los pacientes — si
        // fue un rechazo/cancelación, el backend ya soltó esa unidad del paciente
        // que la tuviera asignada, y esto lo refleja sin recargar la página.
        emergencySocket.on('eventInterInstitutionalRequestResponded', (data) => {
            if (data.emergencyId && String(data.emergencyId) !== String(emergencyId)) return
            fetchExternalUnitsInPlay()
            fetchPatients()
        })

        return () => emergencySocket.disconnect()
    }, [token, emergencyId]);

    // Socket.io — servicio de unidades: estado de las ambulancias ligadas a
    // esta emergencia en vivo (ej. si un paramédico termina turno a media
    // emergencia, la unidad deja de verse "Disponible" al instante).
    useEffect(() => {
        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventAmbulanceStatusChanged', ({ ambulanceId, ambulanceStatusId }) => {
            setAmbulanceLocations((current) => current.map((u) =>
                parseInt(u.ambulance_id) === parseInt(ambulanceId)
                    ? { ...u, ambulance_status_id: ambulanceStatusId }
                    : u
            ))
        })
        return () => unitsSocket.disconnect()
    }, [token]);

    //---------------------------------registrar, posts--------------------------------------------------

    const handleCloseEmergency = () => {
        if (!window.confirm('¿Seguro que quieres cerrar esta emergencia? Esta acción no se puede deshacer.')) return
        fetch(`${API_BASE_URL}/emergencias/cerrar-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId })
        })
            .then(parseResponse)
            .then(() => navigate('/dashboard'))
            .catch(error => { console.error('Error cerrando la emergencia. ', error); alert(error.message) })
    }

    // Válvula de escape exclusiva de rol 1 — para cuando la emergencia nunca va
    // a resolverse sola (ambulancia cancelada, paciente rechazado y nadie lo
    // reasignó, etc.) y el cierre normal la sigue bloqueando.
    const handleForceCloseEmergency = () => {
        const reason = window.prompt('Cierre forzado: ¿cuál es el motivo? (ambulancia cancelada, paciente rechazó traslado, etc.)')
        if (!reason || !reason.trim()) return
        fetch(`${API_BASE_URL}/emergencias/forzar-cierre-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, reason })
        })
            .then(parseResponse)
            .then(() => navigate('/dashboard'))
            .catch(error => { console.error('Error en el cierre forzado. ', error); alert(error.message) })
    }

    const handleAdvanceStatus = (emergencyStatusId) => {
        fetch(`${API_BASE_URL}/emergencias/actualizar-estado-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, emergencyStatusId })
        })
            .then(parseResponse)
            .then(() => fetchEmergencyData())
            .catch(error => { console.error('Error actualizando el estado de la emergencia. ', error); alert(error.message) })
    }

    const handleUnassignAmbulance = (a) => {
        if (!window.confirm(`¿Seguro que quieres desasignar la unidad ${a.unit_number} de esta emergencia?`)) return
        fetch(`${API_BASE_URL}/emergencias/desasignar-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ assignmentId: a.assignment_id, ambulanceIds: [a.ambulance_id] })
        })
            .then(parseResponse)
            .then(() => fetchAssignments())
            .catch(error => { console.error('Error desasignando ambulancia. ', error); alert(error.message) })
    }

    // También funciona sobre una ya Aceptada (p. ej. dos unidades externas
    // aceptadas para un solo paciente) — el backend suelta la ambulancia de
    // vuelta a Disponible y avisa al hospital dueño con sonido/notificación,
    // ya que él sí había comprometido la unidad.
    const handleCancelExternalRequest = (r) => {
        const wasAccepted = parseInt(r.request_status_id) === 2
        const msg = wasAccepted
            ? `Esta unidad ya había sido aceptada por ${r.receiving_institution || 'la otra institución'}. ¿Seguro que ya no la necesitas? Se le avisará que se cancela.`
            : `¿Seguro que quieres cancelar la solicitud de la unidad ${r.unit_number}?`
        if (!window.confirm(msg)) return
        fetch(`${API_BASE_URL}/emergencias/cancelar-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ interInstitutionalRequestId: r.inter_institutional_request_id })
        })
            .then(parseResponse)
            .then(() => fetchExternalUnitsInPlay())
            .catch(error => { console.error('Error cancelando solicitud. ', error); alert(error.message) })
    }

    //---------------------------------agregar ambulancia adicional a la emergencia en curso--------------------------------------------------

    const openAddAmbulanceForm = () => {
        setShowAddAmbulanceForm(true)
        setSelectedUnitsToAdd([])
        setSelectedExternalUnitsToAdd([])
        fetch(`${API_BASE_URL}/unidades/ambulancias-disponibles/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => setAvailableUnitsForAdd((data || []).map(u => toLowerCaseKeys(u))))
            .catch(error => { console.error('Error consultando unidades disponibles. ', error); alert(error.message) })

        fetch(`${API_BASE_URL}/unidades/ambulancias-externas/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => setExternalUnitsForAdd((data || []).map(u => toLowerCaseKeys(u))))
            .catch(error => { console.error('Error consultando unidades externas. ', error); alert(error.message) })
    }

    // Por cada unidad propia disponible: su ubicación actual, y de ahí la ruta
    // real (OSRM) hasta esta emergencia — para que el despachador vea de un
    // vistazo cuál le conviene más, sin tener que adivinar por el mapa. La
    // ubicación también se guarda aparte (addUnitLocations) para poder
    // pintarlas todas en el mapa mientras el formulario está abierto.
    useEffect(() => {
        if (availableUnitsForAdd.length === 0 || !emergencyData?.latitude || !emergencyData?.longitude) { setAddUnitRoutes({}); setAddUnitLocations({}); return }
        setAddRoutesLoading(true)
        Promise.all(availableUnitsForAdd.map((u) =>
            fetch(`${API_BASE_URL}/unidades/ubicacion/${u.ambulance_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then((res) => res.ok ? res.json() : { data: null })
                .then(({ data }) => {
                    const loc = data ? toLowerCaseKeys(data) : null
                    if (!loc?.latitude || !loc?.longitude) return [u.ambulance_id, null, null]
                    const url = `https://router.project-osrm.org/route/v1/driving/${loc.longitude},${loc.latitude};${emergencyData.longitude},${emergencyData.latitude}?overview=false`
                    return fetch(url)
                        .then(res => res.json())
                        .then((routeData) => {
                            if (routeData.code !== 'Ok' || !routeData.routes?.[0]) return [u.ambulance_id, loc, null]
                            return [u.ambulance_id, loc, { distanceKm: routeData.routes[0].distance / 1000, durationMin: routeData.routes[0].duration / 60 }]
                        })
                })
                .catch(() => [u.ambulance_id, null, null])
        ))
            .then((entries) => {
                setAddUnitLocations(Object.fromEntries(entries.map(([id, loc]) => [id, loc])))
                setAddUnitRoutes(Object.fromEntries(entries.map(([id, , route]) => [id, route])))
            })
            .finally(() => setAddRoutesLoading(false))
    }, [availableUnitsForAdd, emergencyData?.latitude, emergencyData?.longitude, token])

    // Igual que en NewEmergency.jsx: ordena por tiempo real de traslado, las
    // sin ruta todavía se quedan al final.
    const sortAddUnitsByDistance = (units) => {
        const withRoute = units.map((u) => ({ ...u, route: addUnitRoutes[u.ambulance_id] || null }))
        return withRoute.sort((a, b) => {
            if (!a.route && !b.route) return 0
            if (!a.route) return 1
            if (!b.route) return -1
            return a.route.durationMin - b.route.durationMin
        })
    }
    const sortedAvailableUnitsForAdd = sortAddUnitsByDistance(availableUnitsForAdd)
    const nearestAddUnitId = sortedAvailableUnitsForAdd.find(u => u.route)?.ambulance_id || null

    const toggleUnitToAdd = (ambulanceId) => {
        setSelectedUnitsToAdd((prev) => prev.includes(ambulanceId) ? prev.filter(id => id !== ambulanceId) : [...prev, ambulanceId])
    }

    const toggleExternalUnitToAdd = (ambulanceId) => {
        setSelectedExternalUnitsToAdd((prev) => prev.includes(ambulanceId) ? prev.filter(id => id !== ambulanceId) : [...prev, ambulanceId])
    }

    const handleAddAmbulance = (e) => {
        e.preventDefault();
        if (selectedUnitsToAdd.length === 0 && selectedExternalUnitsToAdd.length === 0) { alert('Selecciona al menos una unidad.'); return }

        const ownPromise = selectedUnitsToAdd.length > 0
            ? fetch(`${API_BASE_URL}/emergencias/registrar-asignacion`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ emergencyId, ambulanceIds: selectedUnitsToAdd, userProfileId: user.profileId, notes: '' })
            }).then(parseResponse)
            : Promise.resolve(null)

        const externalPromises = selectedExternalUnitsToAdd.map((ambulanceId) => {
            const externalUnit = externalUnitsForAdd.find(u => u.ambulance_id === ambulanceId)
            return fetch(`${API_BASE_URL}/emergencias/registrar-solicitud`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    emergencyId,
                    ambulanceId,
                    userProfileId: user.profileId,
                    requestStatusId: 1,
                    requestingInstitutionId: user.institutionId,
                    receivingInstitutionId: externalUnit?.institution_id,
                })
            }).then(parseResponse)
        })

        Promise.all([ownPromise, ...externalPromises])
            .then(() => { setShowAddAmbulanceForm(false); setSelectedUnitsToAdd([]); setSelectedExternalUnitsToAdd([]); fetchAssignments(); fetchExternalUnitsInPlay(); })
            .catch(error => { console.error('Error agregando ambulancia. ', error); alert(error.message) })
    }

    //---------------------------------identificar paciente--------------------------------------------------

    const openIdentifyForm = (patient) => {
        setIdentifyingPatientId(patient.emergency_patient_id)
        setIdentifyForm({
            firstName: '', firstSurname: '', secondSurname: '',
            cveUnicaRegistroPob: '', birthDate: '', phone: patient.phone_number || '',
        })
    }

    const handleIdentifyPatient = (e, patient) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/hospitales/identificar-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userProfileId: patient.user_profile_id,
                firstName: identifyForm.firstName,
                firstSurname: identifyForm.firstSurname,
                secondSurname: identifyForm.secondSurname,
                cveUnicaRegistroPob: identifyForm.cveUnicaRegistroPob,
                birthDate: identifyForm.birthDate,
                phone: identifyForm.phone,
            })
        })
            .then(parseResponse)
            .then(() => { setIdentifyingPatientId(null); fetchPatients(); })
            .catch(error => { console.error('Error identificando al paciente. ', error); alert(error.message) })
    }

    //---------------------------------agregar paciente a la emergencia en curso--------------------------------------------------

    const handleAddPatientCurpSearch = () => {
        const curp = addPatientForm.curp.trim()
        if (!curp) return
        setAddPatientCurpBusy(true)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const found = toLowerCaseKeys(data[0])
                    setAddPatientForm((prev) => ({
                        ...prev, found: true, userProfileId: found.user_profile_id,
                        firstName: found.first_name || '', firstSurname: found.first_surname || '',
                        secondSurname: found.second_surname || '', phone: found.phone_number || '',
                        birthDate: found.birth_date ? found.birth_date.split('T')[0] : '',
                    }))
                } else {
                    setAddPatientForm((prev) => ({ ...prev, found: false, userProfileId: null }))
                }
            })
            .catch(error => console.error('Error buscando por CURP. ', error))
            .finally(() => setAddPatientCurpBusy(false))
    }

    const linkPatientToEmergency = (userProfileId) => {
        return fetch(`${API_BASE_URL}/emergencias/registrar-paciente`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, userProfileId, notes: addPatientForm.notes })
        }).then(parseResponse)
    }

    const handleAddPatient = (e) => {
        e.preventDefault();
        const emptyForm = { curp: '', found: null, userProfileId: null, firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '', notes: '' }

        const afterLink = () => {
            setAddPatientForm(emptyForm)
            setShowAddPatientForm(false)
            fetchPatients()
        }

        if (addPatientForm.userProfileId) {
            linkPatientToEmergency(addPatientForm.userProfileId).then(afterLink)
                .catch(error => { console.error('Error agregando paciente. ', error); alert(error.message) })
            return
        }

        fetch(`${API_BASE_URL}/usuarios/registro-paciente`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: user.institutionId,
                firstName: addPatientForm.firstName || 'No identificado',
                firstSurname: addPatientForm.firstSurname || '',
                secondSurname: addPatientForm.secondSurname || '',
                phone: addPatientForm.phone,
                birthDate: addPatientForm.birthDate || null,
                cveUnicaRegistroPob: addPatientForm.curp || null,
                emergencyContact: '', emergencyPhone: '',
            })
        })
            .then(parseResponse)
            .then((newProfile) => linkPatientToEmergency(newProfile.userProfileId))
            .then(afterLink)
            .catch(error => { console.error('Error agregando paciente. ', error); alert(error.message) })
    }

    //---------------------------------reasignar hospital destino de un paciente--------------------------------------------------

    const openReassignForm = (patient) => {
        setReassigningPatientId(patient.emergency_patient_id)
        setReassignInstitutionId('')
        setReassignSpecialityId('')
    }

    // Cambiar de hospital invalida la especialidad ya elegida (podría no existir
    // en el hospital nuevo) — se resetea junto con el cambio de institución.
    const handleReassignInstitutionChange = (value) => {
        setReassignInstitutionId(value)
        setReassignSpecialityId('')
    }

    // Especialidades activas de una institución específica, con su nombre ya
    // resuelto contra el catálogo — mismo patrón de filtrado que NewEmergency.jsx.
    const getSpecialitiesForInstitution = (institutionId) => {
        if (!institutionId) return []
        return institutionSpecialities
            .filter((row) => String(row.institution_id) === String(institutionId) && row.is_active)
            .map((row) => ({
                institution_speciality_id: row.institution_speciality_id,
                speciality_id: row.speciality_id,
                name: specialitiesCatalog.find((s) => s.speciality_id === row.speciality_id)?.name || 'Especialidad',
            }))
    }

    const handleReassignPatient = (patient) => {
        if (!reassignInstitutionId) return
        fetch(`${API_BASE_URL}/emergencias/reasignar-destino-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                emergencyPatientId: patient.emergency_patient_id,
                newDestinationInstitutionId: reassignInstitutionId,
                // se mantiene la ambulancia actual del paciente por default — no se
                // obliga al despachador a elegir una unidad nueva solo por reasignar destino
                newAmbulanceId: patient.ambulance_id,
                newDestinationSpecialityId: reassignSpecialityId || null,
            })
        })
            .then(parseResponse)
            .then(() => {
                const newInstitution = destinationInstitutions.find(
                    (inst) => String(inst.institution_id) === String(reassignInstitutionId)
                )
                const newSpeciality = getSpecialitiesForInstitution(reassignInstitutionId).find(
                    (spec) => String(spec.speciality_id) === String(reassignSpecialityId)
                )
                setPatients((current) => current.map((p) =>
                    p.emergency_patient_id === patient.emergency_patient_id
                        ? {
                            ...p,
                            destination_institution_id: reassignInstitutionId,
                            destination_institution_name: newInstitution?.name || p.destination_institution_name,
                            destination_speciality_id: reassignSpecialityId || null,
                            speciality_name: newSpeciality?.name || null,
                            reception_status_name: 'Pendiente',
                        }
                        : p
                ))
                setReassigningPatientId(null)
                setReassignInstitutionId('')
                setReassignSpecialityId('')
            })
            .catch(error => { console.error('Error reasignando destino del paciente. ', error); alert(error.message) })
    }

    //---------------------------------asignar unidad a un paciente concreto--------------------------------------------------

    // El pool completo de unidades ya comprometidas con esta emergencia: propias
    // (assignments) + externas ya aceptadas. "Agregar ambulancia" solo llena este
    // pool — de aquí es de donde se elige a qué paciente va cada una.
    const assignableUnits = [
        ...assignments.map(a => ({ ambulance_id: a.ambulance_id, unit_number: a.unit_number })),
        ...externalUnitsInPlay.map(r => ({ ambulance_id: r.ambulance_id, unit_number: r.unit_number, pending: parseInt(r.request_status_id) === 1 })),
    ].filter((u, index, list) => u.ambulance_id && list.findIndex(x => x.ambulance_id === u.ambulance_id) === index)

    // El <select> ya no manda el PATCH al cambiar — solo "propone" un valor
    // (guardado aquí, por paciente) hasta que se confirme con "Aceptar". Así
    // un clic accidental en el dropdown no reasigna nada solo.
    const [pendingAmbulanceByPatient, setPendingAmbulanceByPatient] = useState({});
    const hasUnsavedAmbulanceChanges = Object.keys(pendingAmbulanceByPatient).length > 0;

    const handleStageAmbulanceChange = (patient, value) => {
        const current = patient.ambulance_id ? String(patient.ambulance_id) : ''
        setPendingAmbulanceByPatient((prev) => {
            const copy = { ...prev }
            if (value === current) {
                // Volvió al valor que ya tenía confirmado — no hay nada que aceptar/cancelar.
                delete copy[patient.emergency_patient_id]
            } else {
                copy[patient.emergency_patient_id] = value
            }
            return copy
        })
    }

    const handleCancelAmbulanceChange = (patient) => {
        setPendingAmbulanceByPatient((prev) => {
            const copy = { ...prev }
            delete copy[patient.emergency_patient_id]
            return copy
        })
    }

    const handleConfirmAmbulanceChange = (patient) => {
        const ambulanceId = pendingAmbulanceByPatient[patient.emergency_patient_id]
        fetch(`${API_BASE_URL}/emergencias/asignar-ambulancia-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId: patient.emergency_patient_id, ambulanceId: ambulanceId || null })
        })
            .then(parseResponse)
            .then(() => {
                const unit = assignableUnits.find(u => String(u.ambulance_id) === String(ambulanceId))
                setPatients((current) => current.map((p) =>
                    p.emergency_patient_id === patient.emergency_patient_id
                        ? { ...p, ambulance_id: ambulanceId || null, unit_number: unit?.unit_number || null }
                        : p
                ))
                setPendingAmbulanceByPatient((prev) => {
                    const copy = { ...prev }
                    delete copy[patient.emergency_patient_id]
                    return copy
                })
            })
            .catch(error => { console.error('Error asignando unidad al paciente. ', error); alert(error.message) })
    }

    // Avisa antes de cerrar/recargar la pestaña si hay cambios de unidad sin
    // confirmar — el navegador ignora el texto que se le pase, pero exige
    // preventDefault() + returnValue para mostrar su propio diálogo nativo.
    useEffect(() => {
        const handler = (e) => {
            if (!hasUnsavedAmbulanceChanges) return
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [hasUnsavedAmbulanceChanges]);

    // Lo mismo pero para navegar DENTRO de la app (p. ej. clic en el navbar) —
    // el evento anterior no aplica ahí porque React Router nunca dispara una
    // navegación real de navegador. Se intercepta el clic en cualquier <a> en
    // fase de captura, antes de que React Router lo procese.
    useEffect(() => {
        const handler = (e) => {
            if (!hasUnsavedAmbulanceChanges) return
            const link = e.target.closest('a')
            if (!link) return
            const confirmed = window.confirm('Tienes cambios de unidad sin confirmar en esta emergencia. ¿Seguro que quieres salir sin guardarlos?')
            if (!confirmed) {
                e.preventDefault()
                e.stopPropagation()
            } else {
                setPendingAmbulanceByPatient({})
            }
        }
        document.addEventListener('click', handler, true)
        return () => document.removeEventListener('click', handler, true)
    }, [hasUnsavedAmbulanceChanges]);

    //---------------------------------registrar, posts--------------------------------------------------

    const timeline = buildTimeline(emergencyData, assignments, patients, notesByPatient)

    // Quien registró la(s) asignación(es) — el DESPACHADOR. Se muestra arriba, en el
    // detalle de la emergencia (campo "Despachador"), no en cada tarjeta de ambulancia
    // (ahí va quien CONDUCE la unidad, ver driver_* abajo).
    const assignedBy = assignments[0]?.assigned_by_first_name
        ? `${assignments[0].assigned_by_first_name} ${assignments[0].assigned_by_first_surname || ''}`.trim()
        : null

    // Verde=Aceptada, ámbar=Pendiente, rojo=Rechazada — mismos tonos que el resto del
    // proyecto. Un reception_status_name vacío (dato sembrado de antes de esta columna)
    // se trata visualmente como Pendiente.
    const receptionBadgeClass = (statusName) => {
        if (statusName === 'Aceptada') return 'reception-aceptada'
        if (statusName === 'Rechazada') return 'reception-rechazada'
        return 'reception-pendiente'
    }

    // Busca el siguiente estado de la secuencia por nombre (usando los IDs reales del
    // catálogo ya consultado), nunca asumiendo que el orden numérico coincide.
    const currentSequenceIndex = emergencyData ? STATUS_SEQUENCE.indexOf(emergencyData.status_name) : -1
    const nextStatusName = currentSequenceIndex >= 0 && currentSequenceIndex < STATUS_SEQUENCE.length - 1
        ? STATUS_SEQUENCE[currentSequenceIndex + 1]
        : null
    const nextStatus = nextStatusName
        ? emergencyStatuses.find(s => s.name === nextStatusName)
        : null

    if (emergencyData === null) {
        return <div className="detail-loading">Cargando...</div>
    }

    return (
        <div className="emergency-detail-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="detail-body">
                <div className="detail-header">
                    <h2>{emergencyData.type_name}</h2>
                    <span className="detail-status">{emergencyData.status_name}</span>
                    {emergencyData.triage_level && (
                        <span className="detail-triage-badge" style={{ background: emergencyData.triage_hex_color }}>
                            Triage Nivel {emergencyData.triage_level} — {emergencyData.triage_color_name}
                        </span>
                    )}
                    {parseInt(user?.roleId) === 2 && emergencyData.closed_at === null && nextStatus && (
                        <button
                            className="detail-advance-btn"
                            onClick={() => handleAdvanceStatus(nextStatus.emergency_status_id)}
                        >
                            Avanzar a: {nextStatus.name}
                        </button>
                    )}
                    {emergencyData.closed_at === null && (
                        <button className="detail-close-btn" onClick={handleCloseEmergency}>
                            Cerrar Emergencia
                        </button>
                    )}
                    {emergencyData.closed_at === null && parseInt(user?.roleId) === 1 && (
                        <button className="detail-close-btn detail-force-close-btn" onClick={handleForceCloseEmergency} title="Cierra sin importar si hay pacientes pendientes — exige un motivo">
                            Cierre Forzado
                        </button>
                    )}
                    {emergencyData.close_reason && (
                        <span className="detail-close-reason" title="Motivo del cierre forzado">
                            Cerrada con motivo: {emergencyData.close_reason}
                        </span>
                    )}
                </div>

                <div className="detail-grid">
                    <div className="detail-field">
                        <span className="field-label">Descripción</span>
                        <span className="field-value">{emergencyData.description}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Reportante</span>
                        <span className="field-value">{emergencyData.reporter_name}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Teléfono</span>
                        <span className="field-value">{emergencyData.reporter_phone}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Despachador</span>
                        <span className="field-value">{assignedBy || '—'}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Pacientes reportados / registrados</span>
                        <span className="field-value">Pacientes reportados: {emergencyData.num_patients} · Pacientes registrados: {patients.length}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Ubicación (coordenadas)</span>
                        <span className="field-value">{emergencyData.latitude}, {emergencyData.longitude}</span>
                    </div>
                </div>

                <div className="detail-section">
                    <h3>Mapa</h3>
                    {showAddAmbulanceForm && (
                        <p className="detail-section-hint">
                            También se muestran las unidades disponibles para agregar (abajo) — así se ven todas antes de elegir.
                        </p>
                    )}
                    <div className="detail-map-wrapper">
                        <MapArea
                            ambulances={[
                                ...ambulanceLocations,
                                // Mientras el formulario de agregar está abierto, también se ven en
                                // el mapa las candidatas — sin esto solo se veían las que YA están
                                // asignadas, el despachador no podía comparar visualmente antes de elegir.
                                ...(showAddAmbulanceForm
                                    ? availableUnitsForAdd
                                        .filter(u => !ambulanceLocations.some(a => a.ambulance_id === u.ambulance_id))
                                        .map(u => ({ ...u, ...(addUnitLocations[u.ambulance_id] || {}) }))
                                    : [])
                            ]}
                            emergencyLocation={emergencyData.latitude ? { latitude: emergencyData.latitude, longitude: emergencyData.longitude } : null}
                            routes={ambulanceRoutes}
                        />
                    </div>
                </div>

                <div className="detail-section">
                    <div className="section-header-row">
                        <h3>Ambulancias Asignadas ({assignments.length})</h3>
                        {[1, 2].includes(parseInt(user?.roleId)) && emergencyData.closed_at === null && (
                            <button className="add-patient-btn" onClick={openAddAmbulanceForm}>+ Agregar ambulancia</button>
                        )}
                    </div>
                    <p className="detail-section-hint">Estas unidades quedan disponibles para asignar a un paciente específico en la sección de Pacientes, abajo — las externas se pueden asignar aunque todavía no las acepten; si las rechazan, se sueltan solas.</p>

                    {showAddAmbulanceForm && (
                        <form className="patient-form" onSubmit={handleAddAmbulance} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <p className="unit-add-subtitle">Tus unidades (asignación directa)</p>
                            {addRoutesLoading && <p className="ne-distance-hint">Calculando rutas...</p>}
                            {availableUnitsForAdd.length === 0 ? (
                                <p className="detail-empty">No hay unidades disponibles en tu institución ahorita mismo.</p>
                            ) : (
                                <div className="unit-cards-grid">
                                    {sortedAvailableUnitsForAdd.map((u) => (
                                        <label key={u.ambulance_id} className={`unit-card ${selectedUnitsToAdd.includes(u.ambulance_id) ? 'selected' : ''}`}>
                                            <input type="checkbox" checked={selectedUnitsToAdd.includes(u.ambulance_id)} onChange={() => toggleUnitToAdd(u.ambulance_id)} />
                                            <div className="unit-card-info">
                                                <span className="unit-card-number">
                                                    {u.unit_number}
                                                    {u.ambulance_id === nearestAddUnitId && <span className="unit-nearest-badge">Más cercana</span>}
                                                </span>
                                                <span className="unit-card-plate">
                                                    {u.license_plate}
                                                    {u.route && ` · ${u.route.distanceKm.toFixed(1)} km · ${Math.round(u.route.durationMin)} min`}
                                                </span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <p className="unit-add-subtitle unit-add-subtitle-external">Otras instituciones (requiere solicitud)</p>
                            {externalUnitsForAdd.length === 0 ? (
                                <p className="detail-empty">No hay unidades externas disponibles por el momento.</p>
                            ) : (
                                <div className="unit-cards-grid">
                                    {externalUnitsForAdd.map((u) => (
                                        <label key={u.ambulance_id} className={`unit-card unit-card-external ${selectedExternalUnitsToAdd.includes(u.ambulance_id) ? 'selected' : ''}`}>
                                            <input type="checkbox" checked={selectedExternalUnitsToAdd.includes(u.ambulance_id)} onChange={() => toggleExternalUnitToAdd(u.ambulance_id)} />
                                            <div className="unit-card-info">
                                                <span className="unit-card-number">{u.unit_number}</span>
                                                <span className="unit-card-institution">{u.institution_name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div className="institutions-form-actions">
                                <button type="submit" className="institutions-form-submit">Confirmar unidades seleccionadas</button>
                                <button type="button" className="institutions-form-cancel" onClick={() => setShowAddAmbulanceForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {assignments.length === 0 && externalUnitsInPlay.length === 0 ? (
                        <p className="detail-empty">Sin ambulancias asignadas todavía.</p>
                    ) : (
                        <div className="assignments-list">
                            {assignments.map((a) => (
                                <div key={a.assignment_id} className="assignment-card">
                                    <span className="assignment-unit">{a.unit_number}</span>
                                    <span className="assignment-plate">{a.license_plate}</span>
                                    <span className="assignment-paramedic">
                                        {a.driver_first_name ? `${a.driver_first_name} ${a.driver_first_surname}` : 'Sin conductor con turno activo'}
                                    </span>
                                    {a.unassigned_at ? (
                                        <span className="assignment-tag">Desasignada</span>
                                    ) : (
                                        [1, 2].includes(parseInt(user?.roleId)) && (
                                            <button
                                                className="assignment-unassign-btn"
                                                onClick={() => handleUnassignAmbulance(a)}
                                            >
                                                Desasignar
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                            {/* Las de otra institución nunca vivían en `assignments` (esa tabla es
                                solo para asignación directa propia) — por eso una unidad externa,
                                aunque ya viniera en camino, nunca se veía aquí. */}
                            {externalUnitsInPlay.map((r) => (
                                <div key={`ext-${r.inter_institutional_request_id}`} className="assignment-card assignment-card-external">
                                    <span className="assignment-unit">{r.unit_number}</span>
                                    <span className="assignment-plate">{r.receiving_institution || 'Otra institución'}</span>
                                    <span className="assignment-paramedic">Unidad externa</span>
                                    <span className={`assignment-tag ${parseInt(r.request_status_id) === 1 ? 'assignment-tag-pending' : 'assignment-tag-accepted'}`}>
                                        {parseInt(r.request_status_id) === 1 ? 'Pendiente de aceptar' : 'En camino (aceptada)'}
                                    </span>
                                    {[1, 2].includes(parseInt(user?.roleId)) && (
                                        <button
                                            className="assignment-unassign-btn"
                                            onClick={() => handleCancelExternalRequest(r)}
                                        >
                                            Cancelar solicitud
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="detail-section">
                    <div className="section-header-row">
                        <h3>Pacientes ({patients.length})</h3>
                        {[1, 2, 3].includes(parseInt(user?.roleId)) && (
                            <button className="add-patient-btn" onClick={() => setShowAddPatientForm(!showAddPatientForm)}>
                                + Agregar paciente
                            </button>
                        )}
                    </div>
                    <p className="detail-note-hint">
                        Los pacientes y sus notas de urgencia son registrados por el paramédico en campo desde la app móvil.
                    </p>

                    {showAddPatientForm && (
                        <form className="patient-form" onSubmit={handleAddPatient} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div className="patient-id-curp-row">
                                <input
                                    type="text" placeholder="CURP"
                                    value={addPatientForm.curp}
                                    onChange={(e) => setAddPatientForm(p => ({ ...p, curp: e.target.value }))}
                                    maxLength={18}
                                />
                                <button type="button" onClick={handleAddPatientCurpSearch} disabled={addPatientCurpBusy || !addPatientForm.curp.trim()}>
                                    {addPatientCurpBusy ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>
                            {addPatientForm.found === true && <p className="patient-id-found">✓ Paciente encontrado — datos cargados automáticamente</p>}
                            {addPatientForm.found === false && <p className="patient-id-notfound">No se encontró. Llena los datos manualmente si los tienes.</p>}
                            <div className="patient-id-row">
                                <input type="text" placeholder="Nombre(s)" value={addPatientForm.firstName} onChange={(e) => setAddPatientForm(p => ({ ...p, firstName: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={100} />
                                <input type="text" placeholder="Apellido paterno" value={addPatientForm.firstSurname} onChange={(e) => setAddPatientForm(p => ({ ...p, firstSurname: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={150} />
                            </div>
                            <div className="patient-id-row">
                                <input type="text" placeholder="Apellido materno" value={addPatientForm.secondSurname} onChange={(e) => setAddPatientForm(p => ({ ...p, secondSurname: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={150} />
                                <input type="text" placeholder="Teléfono" value={addPatientForm.phone} onChange={(e) => setAddPatientForm(p => ({ ...p, phone: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={10} />
                            </div>
                            <textarea placeholder="Notas (opcional)" value={addPatientForm.notes} onChange={(e) => setAddPatientForm(p => ({ ...p, notes: e.target.value }))} maxLength={300} />
                            <div className="institutions-form-actions">
                                <button type="submit" className="institutions-form-submit">Agregar paciente</button>
                                <button type="button" className="institutions-form-cancel" onClick={() => setShowAddPatientForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {patients.length === 0 ? (
                        <p className="detail-empty">Sin pacientes registrados todavía.</p>
                    ) : (
                        patients.map((patient) => (
                            <div key={patient.emergency_patient_id} className="patient-card">
                                <div className="patient-header">
                                    <span className="patient-name">
                                        {patient.first_name
                                            ? `${patient.first_name} ${patient.first_surname || ''}`
                                            : 'Paciente sin identificar'}
                                    </span>
                                    {patient.curp && <span className="patient-curp">{patient.curp}</span>}
                                    {patient.blood_type && <span className="patient-blood-type">Tipo {patient.blood_type}</span>}
                                    {!patient.first_name && [1, 4].includes(parseInt(user?.roleId)) && (
                                        <button className="add-note-btn" onClick={() => openIdentifyForm(patient)}>Identificar paciente</button>
                                    )}
                                </div>
                                {patient.notes && <p className="patient-notes">{patient.notes}</p>}

                                {[1, 2].includes(parseInt(user?.roleId)) && (
                                    <div className="patient-unit-row">
                                        <label className="patient-unit-label">Unidad asignada:</label>
                                        <select
                                            value={pendingAmbulanceByPatient[patient.emergency_patient_id] ?? (patient.ambulance_id || '')}
                                            onChange={(e) => handleStageAmbulanceChange(patient, e.target.value)}
                                        >
                                            <option value="">Sin unidad asignada</option>
                                            {assignableUnits.map((u) => (
                                                <option key={u.ambulance_id} value={u.ambulance_id}>
                                                    Unidad {u.unit_number}{u.pending ? ' (pendiente de aceptar)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {pendingAmbulanceByPatient[patient.emergency_patient_id] !== undefined && (
                                            <>
                                                <button type="button" className="patient-unit-confirm-btn" onClick={() => handleConfirmAmbulanceChange(patient)}>Aceptar</button>
                                                <button type="button" className="patient-unit-cancel-btn" onClick={() => handleCancelAmbulanceChange(patient)}>Cancelar</button>
                                            </>
                                        )}
                                        {assignableUnits.length === 0 && (
                                            <span className="patient-unit-hint">Agrega una ambulancia arriba para poder asignarla.</span>
                                        )}
                                    </div>
                                )}

                                {patient.destination_institution_id && (
                                    <div className="patient-reception-row">
                                        <span className={`reception-badge ${receptionBadgeClass(patient.reception_status_name)}`}>
                                            {patient.reception_status_name || 'Pendiente'}
                                        </span>
                                        {patient.delivered_at && (
                                            <span className="reception-badge reception-entregada">Entregado</span>
                                        )}
                                        <span className="patient-destination">
                                            → {patient.destination_institution_name || 'Institución desconocida'}
                                            {patient.speciality_name ? ` — ${patient.speciality_name}` : ''}
                                        </span>
                                        {patient.reception_status_name === 'Rechazada' && patient.rejection_reason && (
                                            <span className="patient-rejection-reason">Motivo: {patient.rejection_reason}</span>
                                        )}

                                        {['Pendiente', 'Rechazada'].includes(patient.reception_status_name || 'Pendiente') &&
                                            [1, 2].includes(parseInt(user?.roleId)) && (
                                            reassigningPatientId === patient.emergency_patient_id ? (
                                                <div className="reassign-control">
                                                    <select
                                                        value={reassignInstitutionId}
                                                        onChange={(e) => handleReassignInstitutionChange(e.target.value)}
                                                    >
                                                        <option value="">Selecciona hospital</option>
                                                        {destinationInstitutions.map((inst) => (
                                                            <option key={inst.institution_id} value={inst.institution_id}>
                                                                {inst.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={reassignSpecialityId}
                                                        onChange={(e) => setReassignSpecialityId(e.target.value)}
                                                        disabled={!reassignInstitutionId}
                                                    >
                                                        <option value="">
                                                            {reassignInstitutionId ? 'Especialidad — sin definir' : 'Elige hospital primero'}
                                                        </option>
                                                        {getSpecialitiesForInstitution(reassignInstitutionId).map((spec) => (
                                                            <option key={spec.institution_speciality_id} value={spec.speciality_id}>
                                                                {spec.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className="add-note-btn"
                                                        disabled={!reassignInstitutionId}
                                                        onClick={() => handleReassignPatient(patient)}
                                                    >
                                                        Reasignar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="institutions-form-cancel"
                                                        onClick={() => setReassigningPatientId(null)}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="reassign-control">
                                                    <button
                                                        type="button"
                                                        className="add-note-btn"
                                                        onClick={() => openReassignForm(patient)}
                                                    >
                                                        Reasignar hospital
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}

                                {identifyingPatientId === patient.emergency_patient_id && (
                                    <form className="note-form" onSubmit={(e) => handleIdentifyPatient(e, patient)}>
                                        <div className="note-form-row">
                                            <input type="text" placeholder="Nombre(s)" value={identifyForm.firstName} onChange={(e) => setIdentifyForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required />
                                            <input type="text" placeholder="Apellido paterno" value={identifyForm.firstSurname} onChange={(e) => setIdentifyForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required />
                                        </div>
                                        <div className="note-form-row">
                                            <input type="text" placeholder="Apellido materno" value={identifyForm.secondSurname} onChange={(e) => setIdentifyForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} />
                                            <input type="text" placeholder="CURP" maxLength={18} value={identifyForm.cveUnicaRegistroPob} onChange={(e) => setIdentifyForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} />
                                        </div>
                                        <div className="note-form-row">
                                            <input type="date" value={identifyForm.birthDate} onChange={(e) => setIdentifyForm(p => ({ ...p, birthDate: e.target.value }))} />
                                            <input type="text" placeholder="Teléfono" value={identifyForm.phone} onChange={(e) => setIdentifyForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} />
                                        </div>
                                        <button type="submit">Guardar identidad</button>
                                        <button type="button" className="institutions-form-cancel" onClick={() => setIdentifyingPatientId(null)}>Cancelar</button>
                                    </form>
                                )}

                                {clinicalByPatient[patient.emergency_patient_id] && (
                                    <div className="patient-clinical-info">
                                        {clinicalByPatient[patient.emergency_patient_id].allergies.length > 0 && (
                                            <div className="clinical-row"><strong>Alergias:</strong> {clinicalByPatient[patient.emergency_patient_id].allergies.map(a => a.name).join(', ')}</div>
                                        )}
                                        {clinicalByPatient[patient.emergency_patient_id].conditions.length > 0 && (
                                            <div className="clinical-row"><strong>Condiciones:</strong> {clinicalByPatient[patient.emergency_patient_id].conditions.map(c => c.name).join(', ')}</div>
                                        )}
                                        {clinicalByPatient[patient.emergency_patient_id].medications.length > 0 && (
                                            <div className="clinical-row"><strong>Medicamentos:</strong> {clinicalByPatient[patient.emergency_patient_id].medications.map(m => m.name).join(', ')}</div>
                                        )}
                                    </div>
                                )}

                                {notesByPatient[patient.emergency_patient_id]?.map((note) => (
                                    <div key={note.emergency_note_id} className="triage-note">
                                        <span className="triage-badge" style={{ background: note.color }}>
                                            Nivel {note.level}
                                        </span>
                                        <div className="vitals-grid">
                                            <span>PA: {note.blood_pressure}</span>
                                            <span>FC: {note.heart_rate}</span>
                                            <span>Temp: {note.temperature}°C</span>
                                            <span>SpO2: {note.oxygen_saturation}%</span>
                                        </div>
                                        <p className="triage-diagnosis">{note.initial_diagnosis}</p>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className="detail-section">
                    <h3>Línea de Tiempo</h3>
                    {timeline.length === 0 ? (
                        <p className="detail-empty">Sin eventos registrados todavía.</p>
                    ) : (
                        <div className="timeline">
                            {timeline.map((event, index) => (
                                <div key={index} className="timeline-item">
                                    <div className="timeline-marker">
                                        <span className="timeline-dot" />
                                        {index < timeline.length - 1 && <span className="timeline-line" />}
                                    </div>
                                    <div className="timeline-content">
                                        <span className="timeline-time">{formatDateTime(event.at)}</span>
                                        <span className="timeline-label">{event.label}</span>
                                        {event.detail && <span className="timeline-detail">{event.detail}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default EmergencyDetail;