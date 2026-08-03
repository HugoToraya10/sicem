import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toLowerCaseKeys } from "../utils/formatData";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import MapArea from "../components/map/MapArea";
import { getNavLinks } from "../utils/Navlinks";
import { parseResponse } from '../utils/apiRequest';
import { connectUnitsSocket } from '../sockets/unitsSocket';
import './NewEmergency.css';

// Ruta real por calle (no línea recta) vía OSRM — mismo ecosistema OpenStreetMap
// que ya usa esta pantalla para geocodificar direcciones (Nominatim) y pintar
// el mapa (Leaflet + tiles de OSM), así que no se suma ningún proveedor nuevo
// ni llave de API. OJO: este es el servidor demo PÚBLICO de OSRM
// (router.project-osrm.org) — es gratuito pero limitado, pensado para pruebas
// y bajo volumen, no para producción con muchas unidades/consultas por
// segundo. Si esto crece en uso real, lo correcto es self-hostear OSRM (es
// software libre) con el mapa de México, en vez de seguir pegándole al
// servidor demo compartido.
const fetchRouteDistance = (originLat, originLon, destLat, destLon) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`
    return fetch(url)
        .then(res => res.json())
        .then((data) => {
            if (data.code !== 'Ok' || !data.routes?.[0]) return null
            return {
                distanceKm: data.routes[0].distance / 1000,
                durationMin: data.routes[0].duration / 60,
            }
        })
        .catch((error) => {
            console.error('Error consultando ruta en OSRM. ', error)
            return null
        })
}

// Tope de pacientes por ambulancia en una misma emergencia. No hay un número
// oficial en ambulance_types (la BD no trae capacidad de pacientes por tipo),
// y la NOM-034-SSA3-2013 solo exige que el compartimento dé cabida "al menos
// a un paciente en camilla" — no fija un máximo. 2 es lo que de verdad cabe
// en la práctica (1 en camilla + 1 ambulatorio sentado), sin ser tan rígido
// que le quite al despachador la libertad de decidir en casos razonables.
const MAX_PATIENTS_PER_AMBULANCE = 5

const NewEmergency = () => {
    const [emergencyTypeId, setEmergencyTypeId] = useState('');
    const [longitude, setLongitude] = useState('');
    const [latitude, setLatitude] = useState('');
    const [description, setDescription] = useState('');
    const [reporterName, setReporterName] = useState('');
    const [reporterPhone, setReporterPhone] = useState('');
    const [numPatients, setNumPatients] = useState('');
    const [emergencyTypes, setEmergencyTypes] = useState([]);
    const [triageLevelId, setTriageLevelId] = useState('');
    const [triageLevels, setTriageLevels] = useState([]);
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const navLinks = getNavLinks(user?.roleId)

    const [availableUnits, setAvailableUnits] = useState([]);
    const [groupedUnits, setGroupedUnits] = useState({});
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [notes, setNotes] = useState('');
    const [unitTypes, setUnitTypes] = useState([]);
    const [unitLocations, setUnitLocations] = useState({});
    const [unitRoutes, setUnitRoutes] = useState({});
    const [routesLoading, setRoutesLoading] = useState(false);
    const [externalUnitLocations, setExternalUnitLocations] = useState({});
    const [nearestRouteGeometry, setNearestRouteGeometry] = useState(null);

    const [externalUnits, setExternalUnits] = useState([]);
    const [groupedExternalUnits, setGroupedExternalUnits] = useState({});
    const [selectedExternalUnits, setSelectedExternalUnits] = useState([]);

    const [addressSearch, setAddressSearch] = useState('');
    const [searchingAddress, setSearchingAddress] = useState(false);

    const [destinationInstitutions, setDestinationInstitutions] = useState([]);
    const [institutionSpecialities, setInstitutionSpecialities] = useState([]);
    const [specialitiesCatalog, setSpecialitiesCatalog] = useState([]);

    // ── Paso 2: identificación de pacientes (opcional, no bloqueante) ──
    const [step, setStep] = useState(1); // 1 = registro de emergencia, 2 = identificación de pacientes
    const [registeredEmergencyId, setRegisteredEmergencyId] = useState(null);
    const [patientForms, setPatientForms] = useState([]);
    const [searchingCurpIndex, setSearchingCurpIndex] = useState(null);

    // Unidades que ya quedaron registradas en el backend al enviar el Paso 1 —
    // la emergencia ya existe para cuando se llega al Paso 2, así que no se
    // puede simplemente "regresar" y reenviar el formulario (duplicaría la
    // emergencia). En vez de eso, esto distingue "ya asignada" de "seleccionada
    // pero todavía no confirmada", para poder agregar más unidades sin tocar
    // las que ya se mandaron.
    const [committedOwnUnitIds, setCommittedOwnUnitIds] = useState([]);
    const [committedExternalUnitIds, setCommittedExternalUnitIds] = useState([]);
    const [addUnitsOpen, setAddUnitsOpen] = useState(false);
    const [addingUnits, setAddingUnits] = useState(false);

    //---------------------------------consultar, gets--------------------------------------------------

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/tipos-emergencia',
            { headers: { "Content-Type": "application/json" } })
            .then((res) => res.json())
            .then(({data}) => setEmergencyTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando los tipos de emergencia. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/niveles-triage',
            { headers: { "Content-Type": "application/json" } })
            .then((res) => res.json())
            .then(({data}) => setTriageLevels((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando los niveles de triage. ', error))
    }, []);

    // Función con nombre (no solo un efecto inline) porque también hay que
    // volver a llamarla cuando llega eventAmbulanceStatusChanged por socket —
    // así la lista de "disponibles" se mantiene correcta en vivo sin que el
    // despachador tenga que recargar la pantalla (una unidad puede aparecer o
    // desaparecer de aquí según inicien/terminen turno en sicem-mobile).
    const fetchAvailableUnits = () => {
        fetch(`http://localhost:3000/unidades/ambulancias-disponibles/${user.institutionId}`,
            { headers: { "Content-Type": "application/json", "Authorization":`Bearer ${token}` } })
            .then(res => res.json())
            .then(({data}) => {
                const units = data.map((u) => toLowerCaseKeys(u))
                setAvailableUnits(units)
                setSelectedUnits((current) => current.filter((id) => units.some((u) => u.ambulance_id === id)))
            })
            .catch(error => console.error('Error recuperando las unidades disponibles. ', error))
    }
    useEffect(fetchAvailableUnits, [])

    // Última ubicación conocida de cada unidad propia disponible — para poder
    // recomendar la más cercana en cuanto se marque dónde está la emergencia.
    // Mismo patrón de fetch-por-unidad que ya usa Dashboard.jsx.
    useEffect(() => {
        if (availableUnits.length === 0) { setUnitLocations({}); return }
        Promise.all(availableUnits.map((u) =>
            fetch(`http://localhost:3000/unidades/ubicacion/${u.ambulance_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then((res) => res.ok ? res.json() : { data: null })
                .then(({ data }) => [u.ambulance_id, data ? toLowerCaseKeys(data) : null])
                .catch(() => [u.ambulance_id, null])
        )).then((entries) => setUnitLocations(Object.fromEntries(entries)))
    }, [availableUnits, token])

    // En cuanto se sabe dónde está la emergencia Y dónde está cada unidad, se le
    // pide a OSRM la ruta real de cada una hacia ese punto — se recalcula si
    // cambia la ubicación marcada o la lista de ubicaciones de las unidades.
    useEffect(() => {
        if (!latitude || !longitude) { setUnitRoutes({}); return }
        const unitsWithLocation = availableUnits.filter((u) => unitLocations[u.ambulance_id]?.latitude && unitLocations[u.ambulance_id]?.longitude)
        if (unitsWithLocation.length === 0) { setUnitRoutes({}); return }

        setRoutesLoading(true)
        Promise.all(unitsWithLocation.map((u) => {
            const loc = unitLocations[u.ambulance_id]
            return fetchRouteDistance(parseFloat(loc.latitude), parseFloat(loc.longitude), parseFloat(latitude), parseFloat(longitude))
                .then((route) => [u.ambulance_id, route])
        }))
            .then((entries) => setUnitRoutes(Object.fromEntries(entries)))
            .finally(() => setRoutesLoading(false))
    }, [latitude, longitude, availableUnits, unitLocations])

    const fetchExternalUnits = () => {
        fetch(`http://localhost:3000/unidades/ambulancias-externas/${user.institutionId}`,
            { headers: { "Content-Type": "application/json", "Authorization":`Bearer ${token}` } })
            .then(res => res.json())
            .then(({data}) => {
                const units = data.map((u) => toLowerCaseKeys(u))
                setExternalUnits(units)
                setSelectedExternalUnits((current) => current.filter((id) => units.some((u) => u.ambulance_id === id)))
            })
            .catch(error => console.error('Error recuperando las unidades externas. ', error))
    }
    useEffect(()=>{
        fetchExternalUnits()
    }, [])

    // Socket.io — servicio de unidades: si una unidad entra o sale de
    // "Disponible" (turno iniciado/terminado en sicem-mobile, o cambio manual
    // de estado) mientras el despachador tiene esta pantalla abierta, se
    // vuelve a pedir la lista completa — es más simple y confiable que tratar
    // de reconstruir a mano una unidad nueva que aparece (no llega toda su
    // info por el socket, solo el ID y el estado).
    useEffect(() => {
        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventAmbulanceStatusChanged', () => {
            fetchAvailableUnits()
            fetchExternalUnits()
        })
        return () => unitsSocket.disconnect()
    }, [token])

    // Misma idea que unitLocations pero para las externas — así también se ven
    // en el mapa, no solo las propias.
    useEffect(() => {
        if (externalUnits.length === 0) { setExternalUnitLocations({}); return }
        Promise.all(externalUnits.map((u) =>
            fetch(`http://localhost:3000/unidades/ubicacion/${u.ambulance_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then((res) => res.ok ? res.json() : { data: null })
                .then(({ data }) => [u.ambulance_id, data ? toLowerCaseKeys(data) : null])
                .catch(() => [u.ambulance_id, null])
        )).then((entries) => setExternalUnitLocations(Object.fromEntries(entries)))
    }, [externalUnits, token])

    useEffect(() =>{
        fetch('http://localhost:3000/unidades/tipos-ambulancia', {
            headers: { "Content-Type":"application/json" }
        })
        .then(res => res.json())
        .then(({data}) => setUnitTypes(data.map(type => toLowerCaseKeys(type))))
        .catch(error => console.error('Error consultando los tipos de unidades. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/hospitales/instituciones-destino', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({data}) => setDestinationInstitutions(data.map(inst => toLowerCaseKeys(inst))))
            .catch(error => console.error('Error recuperando instituciones de destino. ', error))
    }, []);

    // Mismo patrón que ya usa Capacity.jsx en sicem-desktop: trae ambas listas una
    // sola vez al montar, y se filtra en el cliente por institución al renderizar
    // el select de especialidad de cada paciente.
    useEffect(() => {
        Promise.all([
            fetch('http://localhost:3000/hospitales/especialidades-instituciones', { headers: { "Content-Type": "application/json" } }).then(res => res.json()),
            fetch('http://localhost:3000/hospitales/especialidades', { headers: { "Content-Type": "application/json" } }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                setInstitutionSpecialities((institutionSpecialtiesRes.data || []).map(row => toLowerCaseKeys(row)))
                setSpecialitiesCatalog((catalogRes.data || []).map(s => toLowerCaseKeys(s)))
            })
            .catch(error => console.error('Error recuperando especialidades por institución. ', error))
    }, []);

    //---------------------------------registrar, posts--------------------------------------------------

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/emergencias/registrar-emergencia',
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    emergencyTypeId: emergencyTypeId,
                    emergencyStatusId: 1,
                    userProfileId: user.profileId,
                    longitude: longitude,
                    latitude: latitude,
                    description: description,
                    reporterName: reporterName,
                    reporterPhone: reporterPhone,
                    numPatients: numPatients,
                    triageLevelId: triageLevelId || null
                }),})
                .then(parseResponse)
                .catch(error => {
                    console.error('Error registrando la emergencia. ', error)
                    alert(error.message)
                    throw error // nunca se creó nada — aborta el flujo, es seguro reintentar
                })
                .then(emergencyData => {
                    // La emergencia YA existe en este punto. Si asignar unidades o mandar
                    // solicitudes falla, no lo tratamos como que "todo falló" (evita que el
                    // despachador reintente el formulario y duplique la emergencia) — solo
                    // avisamos qué parte específica no se pudo completar.
                    const assignPromise = selectedUnits.length !== 0
                        ? fetch('http://localhost:3000/emergencias/registrar-asignacion', {
                            method: "POST",
                            headers: { "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
                            body: JSON.stringify({
                                emergencyId: emergencyData.emergencyId,
                                ambulanceIds: selectedUnits,
                                userProfileId: user.profileId,
                                notes: notes,
                            })
                        }).then(parseResponse).catch(error => {
                            console.error('Error asignando unidades. ', error)
                            alert(`La emergencia se registró, pero no se pudieron asignar las unidades: ${error.message}`)
                        })
                        : Promise.resolve(null)

                    const requestPromises = selectedExternalUnits.map((ambulanceId) => {
                        const externalUnit = externalUnits.find(u => u.ambulance_id === ambulanceId)
                        return fetch('http://localhost:3000/emergencias/registrar-solicitud', {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                            body: JSON.stringify({
                                emergencyId: emergencyData.emergencyId,
                                ambulanceId: ambulanceId,
                                userProfileId: user.profileId,
                                requestStatusId: 1,
                                requestingInstitutionId: user.institutionId,
                                receivingInstitutionId: externalUnit.institution_id,
                            })
                        }).then(parseResponse).catch(error => {
                            console.error('Error enviando solicitud interinstitucional. ', error)
                            alert(`La emergencia se registró, pero no se pudo enviar la solicitud para la unidad ${externalUnit?.unit_number || ''}: ${error.message}`)
                        })
                    })

                    return Promise.all([assignPromise, ...requestPromises]).then(() => emergencyData)
                })
                .then((emergencyData) => {
                    // La ambulancia ya está en camino — ahora pasamos al paso 2 (opcional)
                    setRegisteredEmergencyId(emergencyData.emergencyId)
                    setCommittedOwnUnitIds(selectedUnits)
                    setCommittedExternalUnitIds(selectedExternalUnits)
                    const count = parseInt(numPatients) || 1
                    // Si solo se eligió UNA unidad para toda la emergencia, no tiene caso
                    // preguntar por paciente cuál le toca — se precarga sola (el selector
                    // se oculta en el JSX de abajo cuando hay una sola unidad).
                    const onlyUnitId = (selectedUnits.length + selectedExternalUnits.length) === 1
                        ? (selectedUnits[0] ?? selectedExternalUnits[0])
                        : ''
                    setPatientForms(
                        Array.from({ length: count }, () => ({
                            curp: '', found: null, userProfileId: null,
                            firstName: '', firstSurname: '', secondSurname: '',
                            phone: '', birthDate: '', notes: '',
                            destinationInstitutionId: '', ambulanceId: onlyUnitId, destinationSpecialityId: ''
                        }))
                    )
                    setStep(2)
                })
                .catch(() => {
                    // El registro inicial ya mostró su propio error arriba; no dupliques el alert.
                })
    }

    const handleAddressSearch = () => {
        if (!addressSearch.trim()) return
        setSearchingAddress(true)
        const query = `${addressSearch}, Tabasco, México`
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
            .then(res => res.json())
            .then((results) => {
                if (results.length > 0) {
                    setLatitude(parseFloat(results[0].lat).toFixed(8))
                    setLongitude(parseFloat(results[0].lon).toFixed(8))
                } else {
                    alert('No se encontró esa dirección. Intenta ser más específico o marca directamente en el mapa.')
                }
            })
            .catch(error => console.error('Error buscando dirección. ', error))
            .finally(() => setSearchingAddress(false))
    }

    //---------------------------------paso 2: identificación de pacientes--------------------------------------------------

    const updatePatientField = (index, field, value) => {
        setPatientForms((prev) => {
            const copy = [...prev]
            copy[index] = { ...copy[index], [field]: value }
            return copy
        })
    }

    // Cambiar de hospital destino invalida la especialidad ya elegida (podría no
    // existir en el hospital nuevo) — se resetea junto con el cambio de institución.
    const handlePatientDestinationChange = (index, value) => {
        setPatientForms((prev) => {
            const copy = [...prev]
            copy[index] = { ...copy[index], destinationInstitutionId: value, destinationSpecialityId: '' }
            return copy
        })
    }

    // Especialidades activas de una institución específica, con su nombre ya
    // resuelto contra el catálogo — mismo patrón de filtrado que Capacity.jsx.
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

    const handleCurpSearch = (index) => {
        const curp = patientForms[index].curp.trim()
        if (!curp) return
        setSearchingCurpIndex(index)
        fetch(`http://localhost:3000/usuarios/obtener-usuario-curp/${curp}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const found = toLowerCaseKeys(data[0])
                    setPatientForms((prev) => {
                        const copy = [...prev]
                        copy[index] = {
                            ...copy[index],
                            found: true,
                            userProfileId: found.user_profile_id,
                            firstName: found.first_name || '',
                            firstSurname: found.first_surname || '',
                            secondSurname: found.second_surname || '',
                            phone: found.phone_number || '',
                            birthDate: found.birth_date ? found.birth_date.split('T')[0] : '',
                        }
                        return copy
                    })
                } else {
                    setPatientForms((prev) => {
                        const copy = [...prev]
                        copy[index] = { ...copy[index], found: false, userProfileId: null }
                        return copy
                    })
                }
            })
            .catch(error => console.error('Error buscando por CURP. ', error))
            .finally(() => setSearchingCurpIndex(null))
    }

const handleConfirmPatients = () => {
    // Cualquier CURP escrita pero nunca verificada contra el backend (o editada
    // después de una búsqueda anterior) se resuelve aquí, automáticamente, antes
    // de registrar nada. Sin esto, una CURP ya existente pero no buscada se trata
    // como paciente nuevo y el backend la rechaza por duplicada — con la emergencia
    // ya creada de antes.
    const needsLookup = patientForms
        .map((p, index) => ({ ...p, index }))
        .filter(p => p.curp.trim() && p.curp.trim() !== p.searchedCurp)

    const lookups = needsLookup.map(({ curp, index }) =>
        fetch(`http://localhost:3000/usuarios/obtener-usuario-curp/${curp.trim()}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => ({ index, data }))
    )

    Promise.all(lookups)
        .then((results) => {
            const resolvedForms = [...patientForms]
            results.forEach(({ index, data }) => {
                const curp = resolvedForms[index].curp.trim()
                if (data && data.length > 0) {
                    const found = toLowerCaseKeys(data[0])
                    resolvedForms[index] = {
                        ...resolvedForms[index],
                        found: true,
                        userProfileId: found.user_profile_id,
                        firstName: found.first_name || '',
                        firstSurname: found.first_surname || '',
                        secondSurname: found.second_surname || '',
                        phone: found.phone_number || '',
                        birthDate: found.birth_date ? found.birth_date.split('T')[0] : '',
                        searchedCurp: curp,
                    }
                } else {
                    resolvedForms[index] = { ...resolvedForms[index], found: false, userProfileId: null, searchedCurp: curp }
                }
            })
            setPatientForms(resolvedForms)
            proceedWithConfirmation(resolvedForms)
        })
        .catch(error => {
            console.error('Error verificando CURPs antes de registrar. ', error)
            alert('No se pudo verificar las CURPs contra el sistema. Revisa tu conexión e intenta de nuevo.')
        })
}

const proceedWithConfirmation = (forms) => {
    const hasAnyData = (p) =>
        p.curp.trim() || p.firstName.trim() || p.firstSurname.trim() || p.notes.trim()

    const emptyIndex = forms.findIndex((p) => !hasAnyData(p))
    if (emptyIndex !== -1) {
        alert(`El Paciente ${emptyIndex + 1} no tiene ningún dato. Llena al menos un campo (CURP, nombre o notas) o usa "Omitir por ahora".`)
        return
    }

    const filledCurps = forms.map(p => p.curp.trim()).filter(curp => curp !== '')
    const duplicatedCurp = filledCurps.find((curp, index) => filledCurps.indexOf(curp) !== index)
    if (duplicatedCurp) {
        alert(`La CURP ${duplicatedCurp} está repetida en más de un paciente. Cada paciente debe tener una CURP distinta.`)
        return
    }

    // Todo paciente con datos capturados debe tener un hospital destino asignado —
    // la ambulancia necesita saber a dónde va, no es opcional como la unidad.
    const missingDestinationIndex = forms.findIndex((p) => !p.destinationInstitutionId)
    if (missingDestinationIndex !== -1) {
        alert(`El Paciente ${missingDestinationIndex + 1} no tiene hospital destino asignado. Selecciona uno antes de continuar.`)
        return
    }

    // Una misma ambulancia no puede llevar pacientes a dos hospitales destino
    // distintos — solo puede estar en un lugar. Se revisa aquí, antes de
    // enviar nada, para no descubrirlo a medias (el backend también lo
    // valida, pero avisar antes es mejor experiencia y evita una carrera
    // entre envíos en paralelo).
    const destinationByAmbulance = {}
    for (let i = 0; i < forms.length; i++) {
        const p = forms[i]
        if (!p.ambulanceId) continue
        const previousDestination = destinationByAmbulance[p.ambulanceId]
        if (previousDestination && previousDestination.destinationInstitutionId !== p.destinationInstitutionId) {
            alert(`El Paciente ${previousDestination.index + 1} y el Paciente ${i + 1} tienen la misma unidad asignada pero hospitales destino distintos. Una ambulancia no puede ir a dos hospitales a la vez — corrígelo antes de continuar.`)
            return
        }
        destinationByAmbulance[p.ambulanceId] = { destinationInstitutionId: p.destinationInstitutionId, index: i }
    }

    // Tope de pacientes por ambulancia (MAX_PATIENTS_PER_AMBULANCE) — evita el
    // caso obvio de amontonar pacientes que no caben físicamente, sin bloquear
    // casos razonables (2 está permitido). No es configurable por tipo de
    // unidad porque la BD no trae esa capacidad — ver constante arriba.
    const patientsByAmbulance = {}
    for (let i = 0; i < forms.length; i++) {
        const p = forms[i]
        if (!p.ambulanceId) continue
        patientsByAmbulance[p.ambulanceId] = (patientsByAmbulance[p.ambulanceId] || []).concat(i)
    }
    for (const [ambulanceId, indices] of Object.entries(patientsByAmbulance)) {
        if (indices.length > MAX_PATIENTS_PER_AMBULANCE) {
            const unit = assignedUnitsForPatients.find(u => String(u.ambulance_id) === String(ambulanceId))
            const pacientesTexto = indices.map(i => i + 1).join(', ')
            alert(`La unidad ${unit?.unit_number || ambulanceId} tiene ${indices.length} pacientes asignados (Paciente ${pacientesTexto}) — el máximo es ${MAX_PATIENTS_PER_AMBULANCE} por ambulancia. Reparte los pacientes entre más unidades antes de continuar.`)
            return
        }
    }

    // el resto es idéntico a lo que ya tenías, solo cambia patientForms por forms:
    const promises = forms.map((patient) => {
        if (patient.userProfileId) {
            return fetch('http://localhost:3000/emergencias/registrar-paciente', {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    emergencyId: registeredEmergencyId,
                    userProfileId: patient.userProfileId,
                    notes: patient.notes,
                    destinationInstitutionId: patient.destinationInstitutionId || null,
                    ambulanceId: patient.ambulanceId || null,
                    destinationSpecialityId: patient.destinationSpecialityId || null,
                })
            }).then(parseResponse)
        }
        return fetch('http://localhost:3000/usuarios/registro-paciente', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: user.institutionId,
                firstName: patient.firstName || 'No identificado',
                firstSurname: patient.firstSurname || '',
                secondSurname: patient.secondSurname || '',
                phone: patient.phone,
                birthDate: patient.birthDate || null,
                cveUnicaRegistroPob: patient.curp || null,
                emergencyContact: '',
                emergencyPhone: '',
            })
        })
            .then(parseResponse)
            .then((newProfile) => {
                return fetch('http://localhost:3000/emergencias/registrar-paciente', {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        emergencyId: registeredEmergencyId,
                        userProfileId: newProfile.userProfileId,
                        notes: patient.notes,
                        destinationInstitutionId: patient.destinationInstitutionId || null,
                        ambulanceId: patient.ambulanceId || null,
                        destinationSpecialityId: patient.destinationSpecialityId || null,
                    })
                }).then(parseResponse)
            })
    })

    Promise.all(promises)
        .then(() => navigate('/dashboard'))
        .catch(error => {
            console.error('Error registrando pacientes. ', error)
            alert(`La emergencia ya está registrada y en curso. No se pudo guardar la identificación de uno o más pacientes: ${error.message}. Puedes agregarla después desde el detalle de la emergencia.`)
            navigate('/dashboard')
        })
}

    const handleSkipPatients = () => {
        navigate('/dashboard')
    }

    // Agrega más unidades a la emergencia YA registrada — es aditivo (INSERT),
    // no reemplaza las anteriores, así que es seguro llamarlo varias veces.
    // Las propias van directo por registrar-asignacion; las externas necesitan
    // el mismo flujo de solicitud que en el Paso 1 (no se asignan directo).
    const handleAddMoreUnits = () => {
        const newOwnIds = selectedUnits.filter((id) => !committedOwnUnitIds.includes(id))
        const newExternalIds = selectedExternalUnits.filter((id) => !committedExternalUnitIds.includes(id))

        if (newOwnIds.length === 0 && newExternalIds.length === 0) {
            alert('Selecciona al menos una unidad nueva antes de confirmar.')
            return
        }

        setAddingUnits(true)

        const ownPromise = newOwnIds.length > 0
            ? fetch('http://localhost:3000/emergencias/registrar-asignacion', {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    emergencyId: registeredEmergencyId,
                    ambulanceIds: newOwnIds,
                    userProfileId: user.profileId,
                    notes: notes,
                })
            }).then(parseResponse)
            : Promise.resolve(null)

        const externalPromises = newExternalIds.map((ambulanceId) => {
            const externalUnit = externalUnits.find(u => u.ambulance_id === ambulanceId)
            return fetch('http://localhost:3000/emergencias/registrar-solicitud', {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    emergencyId: registeredEmergencyId,
                    ambulanceId: ambulanceId,
                    userProfileId: user.profileId,
                    requestStatusId: 1,
                    requestingInstitutionId: user.institutionId,
                    receivingInstitutionId: externalUnit.institution_id,
                })
            }).then(parseResponse)
        })

        Promise.all([ownPromise, ...externalPromises])
            .then(() => {
                setCommittedOwnUnitIds((prev) => [...prev, ...newOwnIds])
                setCommittedExternalUnitIds((prev) => [...prev, ...newExternalIds])
                setAddUnitsOpen(false)
            })
            .catch((error) => {
                console.error('Error agregando unidades adicionales. ', error)
                alert(`No se pudieron agregar las unidades nuevas: ${error.message}`)
            })
            .finally(() => setAddingUnits(false))
    }

    //---------------------------------registrar, posts--------------------------------------------------

    const toggleUnitSelection = (ambulanceId) => {
        let newList = [];
        if (selectedUnits.includes(ambulanceId)) {
            newList = selectedUnits.filter(id => id !== ambulanceId);
        } else {
            newList = [...selectedUnits, ambulanceId];
        }
        return setSelectedUnits(newList)
    }

    const toggleExternalUnitSelection = (ambulanceId) => {
        let newList = [];
        if (selectedExternalUnits.includes(ambulanceId)) {
            newList = selectedExternalUnits.filter(id => id !== ambulanceId);
        } else {
            newList = [...selectedExternalUnits, ambulanceId];
        }
        return setSelectedExternalUnits(newList)
    }

    useEffect(() => {
        const separateUnitTypes = () => {
            let unitsPerType = {};
            for(let i=0; i < availableUnits.length; i++){
                let ambType = parseInt(availableUnits[i].ambulance_type_id);
                if(unitsPerType[ambType] === undefined){ unitsPerType[ambType] = [] }
                unitsPerType[ambType].push(availableUnits[i]);
            }
            return unitsPerType;
        }
        setGroupedUnits(separateUnitTypes())
    }, [availableUnits])

    useEffect(() => {
        const separateExternalUnitTypes = () => {
            let unitsPerType = {};
            for(let i=0; i < externalUnits.length; i++){
                let ambType = parseInt(externalUnits[i].ambulance_type_id);
                if(unitsPerType[ambType] === undefined){ unitsPerType[ambType] = [] }
                unitsPerType[ambType].push(externalUnits[i]);
            }
            return unitsPerType;
        }
        setGroupedExternalUnits(separateExternalUnitTypes())
    }, [externalUnits])

    const handleMapClick = (lat, lng) => {
        setLatitude(lat.toFixed(8))
        setLongitude(lng.toFixed(8))
    }

    // Antes esto mandaba las unidades sin ubicación (el catálogo de
    // disponibles/externas no la trae) — MapArea las descarta en silencio si
    // no tienen latitude/longitude, así que nunca se veía ninguna en el mapa.
    const allUnitsForMap = [
        ...availableUnits.map(u => ({ ...u, ...(unitLocations[u.ambulance_id] || {}) })),
        ...externalUnits.map(u => ({ ...u, ...(externalUnitLocations[u.ambulance_id] || {}) })),
    ]

    // Le pega la ruta real (ya calculada por OSRM en el useEffect de arriba) a
    // cada unidad y ordena por tiempo de traslado — no por distancia en línea
    // recta, dos unidades a la misma distancia recta pueden tardar muy
    // distinto según por dónde entra la carretera. Sin ruta todavía (o si
    // OSRM no encontró camino), se queda al final.
    const sortUnitsByDistance = (units) => {
        const withRoute = units.map((u) => ({ ...u, route: unitRoutes[u.ambulance_id] || null }))
        return withRoute.sort((a, b) => {
            if (!a.route && !b.route) return 0
            if (!a.route) return 1
            if (!b.route) return -1
            return a.route.durationMin - b.route.durationMin
        })
    }

    // La más cercana (en tiempo real de traslado) de TODAS las unidades propias
    // disponibles, sin importar tipo — es la recomendación principal; cada
    // tarjeta ya muestra su propia ruta, esto solo marca cuál es la ganadora.
    const nearestUnitId = (() => {
        if (!latitude || !longitude) return null
        const withRoute = sortUnitsByDistance(availableUnits).filter(u => u.route !== null)
        return withRoute.length > 0 ? withRoute[0].ambulance_id : null
    })()

    // Traza completa (punto A: la unidad más cercana → punto B: la emergencia)
    // para dibujarla en el mapa — a diferencia del cálculo de arriba (que solo
    // pide distancia/duración con overview=false, más liviano), aquí sí se
    // pide la geometría completa (overview=full), pero solo para la unidad
    // ganadora — pedirla para las 5-10 unidades sería tirar la mayoría.
    useEffect(() => {
        if (!nearestUnitId || !latitude || !longitude) { setNearestRouteGeometry(null); return }
        const loc = unitLocations[nearestUnitId]
        if (!loc?.latitude || !loc?.longitude) { setNearestRouteGeometry(null); return }
        const url = `https://router.project-osrm.org/route/v1/driving/${loc.longitude},${loc.latitude};${longitude},${latitude}?overview=full&geometries=geojson`
        fetch(url)
            .then(res => res.json())
            .then((data) => {
                if (data.code !== 'Ok' || !data.routes?.[0]) { setNearestRouteGeometry(null); return }
                // GeoJSON trae [lon, lat] — Leaflet quiere [lat, lon].
                setNearestRouteGeometry(data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]))
            })
            .catch((error) => { console.error('Error trazando la ruta más cercana. ', error); setNearestRouteGeometry(null) })
    }, [nearestUnitId, latitude, longitude, unitLocations])

    //---------------------------------PASO 2: JSX de identificación de pacientes--------------------------------------------------

    // Unidades ya asignadas a esta emergencia en el Paso 1 (propias + externas), con su
    // unit_number, para elegir por paciente a cuál va cada uno
    const assignedUnitsForPatients = [
        ...availableUnits.filter((u) => selectedUnits.includes(u.ambulance_id)),
        ...externalUnits.filter((u) => selectedExternalUnits.includes(u.ambulance_id)),
    ]

    if (step === 2) {
        return (
            <div className="new-emergency-page">
                <Navbar
                    userName={user?.firstName || 'Usuario'}
                    roleLabel="Despachador"
                    links={navLinks}
                />

                <div className="ne-header">
                    <h2 className="ne-title">Identificación de Pacientes</h2>
                    <p className="ne-subtitle">
                        La ambulancia ya va en camino. Esta información es opcional y puedes completarla ahora o después.
                    </p>
                </div>

                <div className="ne-step2-body">
                    <div className="ne-add-units-box">
                        <button type="button" className="ne-add-units-toggle" onClick={() => setAddUnitsOpen((v) => !v)}>
                            {addUnitsOpen ? 'Ocultar' : '+ Agregar otra unidad a esta emergencia'}
                        </button>
                        {addUnitsOpen && (
                            <div className="ne-add-units-panel">
                                <p className="ne-add-units-hint">
                                    Marca las unidades adicionales que necesitas. Las que ya están asignadas o solicitadas aparecen bloqueadas.
                                </p>
                                <div className="ne-add-units-grid">
                                    {availableUnits.map((unit) => {
                                        const committed = committedOwnUnitIds.includes(unit.ambulance_id)
                                        return (
                                            <label key={unit.ambulance_id} className={`unit-card ${selectedUnits.includes(unit.ambulance_id) ? 'selected' : ''} ${committed ? 'unit-card-committed' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUnits.includes(unit.ambulance_id)}
                                                    disabled={committed}
                                                    onChange={() => toggleUnitSelection(unit.ambulance_id)}
                                                />
                                                <div className="unit-card-info">
                                                    <span className="unit-card-number">{unit.unit_number}</span>
                                                    <span className="unit-card-plate">{committed ? 'Ya asignada' : unit.license_plate}</span>
                                                </div>
                                            </label>
                                        )
                                    })}
                                    {externalUnits.map((unit) => {
                                        const committed = committedExternalUnitIds.includes(unit.ambulance_id)
                                        return (
                                            <label key={`ext-${unit.ambulance_id}`} className={`unit-card unit-card-external ${selectedExternalUnits.includes(unit.ambulance_id) ? 'selected' : ''} ${committed ? 'unit-card-committed' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedExternalUnits.includes(unit.ambulance_id)}
                                                    disabled={committed}
                                                    onChange={() => toggleExternalUnitSelection(unit.ambulance_id)}
                                                />
                                                <div className="unit-card-info">
                                                    <span className="unit-card-number">{unit.unit_number}</span>
                                                    <span className="unit-card-institution">{committed ? 'Ya solicitada' : unit.institution_name}</span>
                                                </div>
                                            </label>
                                        )
                                    })}
                                    {availableUnits.length === 0 && externalUnits.length === 0 && (
                                        <p className="unit-empty">No hay unidades disponibles.</p>
                                    )}
                                </div>
                                <button type="button" className="ne-add-units-confirm" onClick={handleAddMoreUnits} disabled={addingUnits}>
                                    {addingUnits ? 'Agregando...' : 'Confirmar unidades nuevas'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="ne-step2-grid">
                        {patientForms.map((patient, index) => (
                            <div key={index} className="patient-id-card">
                                <h4>Paciente {index + 1}</h4>

                                <div className="patient-id-curp-row">
                                    <input
                                        type="text"
                                        placeholder="CURP"
                                        value={patient.curp}
                                        onChange={(e) => updatePatientField(index, 'curp', e.target.value)}
                                        maxLength={18}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCurpSearch(index)}
                                        disabled={searchingCurpIndex === index || !patient.curp.trim()}
                                    >
                                        {searchingCurpIndex === index ? 'Buscando...' : 'Buscar'}
                                    </button>
                                </div>

                                {patient.found === true && (
                                    <p className="patient-id-found">✓ Paciente encontrado — datos cargados automáticamente</p>
                                )}
                                {patient.found === false && (
                                    <p className="patient-id-notfound">No se encontró. Llena los datos manualmente si los tienes.</p>
                                )}

                                <div className="patient-id-row">
                                    <input
                                        type="text" placeholder="Nombre(s)"
                                        value={patient.firstName}
                                        onChange={(e) => updatePatientField(index, 'firstName', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={100}
                                    />
                                    <input
                                        type="text" placeholder="Apellido paterno"
                                        value={patient.firstSurname}
                                        onChange={(e) => updatePatientField(index, 'firstSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={150}
                                    />
                                </div>
                                <div className="patient-id-row">
                                    <input
                                        type="text" placeholder="Apellido materno"
                                        value={patient.secondSurname}
                                        onChange={(e) => updatePatientField(index, 'secondSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={150}
                                    />
                                    <input
                                        type="text" placeholder="Teléfono"
                                        value={patient.phone}
                                        onChange={(e) => updatePatientField(index, 'phone', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={10}
                                    />
                                </div>

                                <input
                                    type="date"
                                    value={patient.birthDate}
                                    onChange={(e) => updatePatientField(index, 'birthDate', e.target.value)}
                                    readOnly={patient.found === true}
                                    className="patient-id-date"
                                />

                                <textarea
                                    placeholder="Notas adicionales (ej. descripción física si no hay identificación)"
                                    value={patient.notes}
                                    onChange={(e) => updatePatientField(index, 'notes', e.target.value)}
                                    maxLength={300}
                                />

                                <div className="patient-id-row">
                                    <select
                                        value={patient.destinationInstitutionId}
                                        onChange={(e) => handlePatientDestinationChange(index, e.target.value)}
                                    >
                                        <option value="">Hospital destino — sin definir</option>
                                        {destinationInstitutions.map((inst) => (
                                            <option key={inst.institution_id} value={inst.institution_id}>
                                                {inst.name} — {inst.available_beds} camas
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={patient.destinationSpecialityId}
                                        onChange={(e) => updatePatientField(index, 'destinationSpecialityId', e.target.value)}
                                        disabled={!patient.destinationInstitutionId}
                                    >
                                        <option value="">
                                            {patient.destinationInstitutionId ? 'Especialidad destino — sin definir' : 'Elige hospital primero'}
                                        </option>
                                        {getSpecialitiesForInstitution(patient.destinationInstitutionId).map((spec) => (
                                            <option key={spec.institution_speciality_id} value={spec.speciality_id}>
                                                {spec.name}
                                            </option>
                                        ))}
                                    </select>
                                    {assignedUnitsForPatients.length > 1 ? (
                                        <select
                                            value={patient.ambulanceId}
                                            onChange={(e) => updatePatientField(index, 'ambulanceId', e.target.value)}
                                        >
                                            <option value="">Unidad asignada — sin definir</option>
                                            {assignedUnitsForPatients.map((unit) => (
                                                <option key={unit.ambulance_id} value={unit.ambulance_id}>
                                                    {unit.unit_number}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        // Solo hay una unidad para esta emergencia — no tiene caso
                                        // preguntar cuál, ya se sabe. ambulanceId ya viene precargado
                                        // con esa unidad desde que se crea patientForms (ver
                                        // handleSubmit), esto solo oculta el selector.
                                        <span className="patient-id-single-unit">
                                            {assignedUnitsForPatients.length === 1
                                                ? `Unidad asignada: ${assignedUnitsForPatients[0].unit_number}`
                                                : 'Sin unidades asignadas'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ne-step2-actions-fixed">
                    <button className="ne-submit" onClick={handleConfirmPatients}>
                        Guardar pacientes y continuar
                    </button>
                    <button className="ne-skip-btn" onClick={handleSkipPatients}>
                        Omitir por ahora
                    </button>
                </div>
            </div>
        )
    }

    //---------------------------------PASO 1: JSX del formulario principal--------------------------------------------------

    return (
        <div className="new-emergency-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel="Despachador"
                links={navLinks}
            />

            <div className="ne-header">
                <h2 className="ne-title">Registrar Nueva Emergencia</h2>
                <p className="ne-subtitle">Busca la dirección o haz clic en el mapa para marcar la ubicación.</p>
            </div>

            <form onSubmit={handleSubmit} className="new-emergency-body">

                <div className="ne-map-column">
                    <div className="ne-address-search">
                        <input
                            type="text"
                            value={addressSearch}
                            onChange={(e) => setAddressSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                            placeholder="Dirección reportada por la llamada..."
                        />
                        <button type="button" onClick={handleAddressSearch} disabled={searchingAddress}>
                            {searchingAddress ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>

                    <div className="ne-map-wrapper">
                        <MapArea
                            ambulances={allUnitsForMap}
                            emergencyLocation={latitude && longitude ? { latitude, longitude } : null}
                            onMapClick={handleMapClick}
                            flyToLocation={latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : null}
                            routes={nearestRouteGeometry ? [{ coordinates: nearestRouteGeometry }] : []}
                        />
                    </div>

                    <div className="ne-coords">
                        <div className="ne-field">
                            <label>Latitud</label>
                            <input
                                type="number" step="0.00000001"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                placeholder="Clic en el mapa"
                                required
                            />
                        </div>
                        <div className="ne-field">
                            <label>Longitud</label>
                            <input
                                type="number" step="0.00000001"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                placeholder="Clic en el mapa"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="ne-form-column">
                    <div className="ne-field">
                        <label>Tipo de emergencia</label>
                        <select value={emergencyTypeId} onChange={(e) => setEmergencyTypeId(e.target.value)} required>
                            <option value="">Selecciona un tipo</option>
                            {emergencyTypes.map((type) => (
                                <option key={type.emergency_type_id} value={type.emergency_type_id}>{type.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ne-field">
                        <label>Descripción del evento</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe lo que reportó la persona que llamó"
                            maxLength={200}
                            required
                        />
                    </div>

                    <div className="ne-row">
                        <div className="ne-field">
                            <label>Nombre de quien reporta</label>
                            <input type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} maxLength={200} required />
                        </div>
                        <div className="ne-field">
                            <label>Teléfono de quien reporta</label>
                            <input type="text" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} maxLength={10} required />
                        </div>
                    </div>

                    <div className="ne-field">
                        <label>Número de pacientes</label>
                        <input type="number" value={numPatients} onChange={(e) => setNumPatients(e.target.value)} min="1" required />
                    </div>

                    <div className="ne-field">
                        <label>Nivel de urgencia estimado (opcional)</label>
                        <div className="ne-triage-row">
                            <select value={triageLevelId} onChange={(e) => setTriageLevelId(e.target.value)}>
                                <option value="">Sin estimar todavía</option>
                                {triageLevels.map((t) => (
                                    <option key={t.triage_level_id} value={t.triage_level_id}>
                                        Nivel {t.level} — {t.color}
                                    </option>
                                ))}
                            </select>
                            {triageLevelId && (
                                <span
                                    className="ne-triage-swatch"
                                    style={{ background: triageLevels.find(t => String(t.triage_level_id) === String(triageLevelId))?.hex_color }}
                                />
                            )}
                        </div>
                    </div>

                    <button className="ne-submit" type="submit">
                        Registrar Emergencia
                    </button>
                </div>

                <div className="ne-units-column">
                    <label className="ne-units-title">Tus Unidades (asignación directa)</label>
                    {latitude && longitude && (
                        <p className="ne-distance-hint">
                            {routesLoading ? 'Calculando rutas...' : 'Ordenadas por tiempo de traslado real a la ubicación marcada.'}
                        </p>
                    )}

                    {unitTypes.map((type) => {
                        const unitsOfThisType = sortUnitsByDistance(groupedUnits[type.ambulance_type_id] || [])
                        return (
                            <div key={type.ambulance_type_id} className="unit-type-group">
                                <div className="unit-type-header">
                                    {type.image_url && (
                                        <img className="unit-type-image" src={`/src/assets/units/${type.image_url}`} alt={type.ambulance_type} />
                                    )}
                                    <span className="unit-type-name">{type.ambulance_type}</span>
                                    <span className="unit-type-count">{unitsOfThisType.length} disp.</span>
                                </div>

                                {unitsOfThisType.length === 0 ? (
                                    <p className="unit-empty">Sin unidades de este tipo.</p>
                                ) : (
                                    <div className="unit-cards-grid">
                                        {unitsOfThisType.map((unit) => (
                                            <label key={unit.ambulance_id} className={`unit-card ${selectedUnits.includes(unit.ambulance_id) ? 'selected' : ''}`}>
                                                <input type="checkbox" checked={selectedUnits.includes(unit.ambulance_id)} onChange={() => toggleUnitSelection(unit.ambulance_id)} />
                                                <div className="unit-card-info">
                                                    <span className="unit-card-number">
                                                        {unit.unit_number}
                                                        {unit.ambulance_id === nearestUnitId && <span className="unit-nearest-badge">Más cercana</span>}
                                                    </span>
                                                    <span className="unit-card-plate">
                                                        {unit.license_plate}
                                                        {unit.route && ` · ${unit.route.distanceKm.toFixed(1)} km · ${Math.round(unit.route.durationMin)} min`}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    <label className="ne-units-title ne-units-title-external">
                        Otras Instituciones (requiere solicitud)
                    </label>

                    {unitTypes.map((type) => {
                        const unitsOfThisType = groupedExternalUnits[type.ambulance_type_id] || []
                        if (unitsOfThisType.length === 0) return null
                        return (
                            <div key={`ext-${type.ambulance_type_id}`} className="unit-type-group unit-type-group-external">
                                <div className="unit-type-header">
                                    {type.image_url && (
                                        <img className="unit-type-image" src={`/src/assets/units/${type.image_url}`} alt={type.ambulance_type} />
                                    )}
                                    <span className="unit-type-name">{type.ambulance_type}</span>
                                    <span className="unit-type-count">{unitsOfThisType.length} disp.</span>
                                </div>
                                <div className="unit-cards-grid">
                                    {unitsOfThisType.map((unit) => (
                                        <label key={unit.ambulance_id} className={`unit-card unit-card-external ${selectedExternalUnits.includes(unit.ambulance_id) ? 'selected' : ''}`}>
                                            <input type="checkbox" checked={selectedExternalUnits.includes(unit.ambulance_id)} onChange={() => toggleExternalUnitSelection(unit.ambulance_id)} />
                                            <div className="unit-card-info">
                                                <span className="unit-card-number">{unit.unit_number}</span>
                                                <span className="unit-card-institution">{unit.institution_name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    {externalUnits.length === 0 && (
                        <p className="unit-empty">No hay unidades externas disponibles por el momento.</p>
                    )}
                </div>
            </form>
        </div>
    )
}

export default NewEmergency;