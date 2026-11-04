import { useEffect, useRef, useState } from "react";
import { OSRM_ROUTE_URL } from '../config/services'
import { MAX_PATIENTS_PER_AMBULANCE, ADDRESS_RESULTS_LIMIT } from '../config/operations'
import { roleLabel } from '../config/roles'
import { useAuth } from "../context/AuthContext";
import { toLowerCaseKeys } from "../utils/formatData";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import MapArea from "../components/map/MapArea";
import Icon from "../components/ui/Icon";
import { readableTextOn } from "../utils/color";
import { useRegion } from "../context/useRegion";
import { searchAddress } from "../utils/geocode";
import RegionNotice from "../components/ui/RegionNotice";
import { getNavLinks } from "../utils/Navlinks";
import { parseResponse } from '../utils/apiRequest';
import { connectUnitsSocket } from '../sockets/unitsSocket';
import './NewEmergency.css';
import {API_BASE_URL} from '../config/api'
import { useDialogs } from '../context/useDialogs'

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
    const url = `${OSRM_ROUTE_URL}/${originLon},${originLat};${destLon},${destLat}?overview=false`
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

const NewEmergency = () => {
    const { notify } = useDialogs()
    const [emergencyTypeId, setEmergencyTypeId] = useState('');
    const [longitude, setLongitude] = useState('');
    const [latitude, setLatitude] = useState('');
    const [description, setDescription] = useState('');
    const [reporterName, setReporterName] = useState('');
    const [reporterPhone, setReporterPhone] = useState('');
    const [numPatients, setNumPatients] = useState('1');
    const [emergencyTypes, setEmergencyTypes] = useState([]);
    const [triageLevelId, setTriageLevelId] = useState('');
    const [triageLevels, setTriageLevels] = useState([]);
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const navLinks = getNavLinks(user?.roleId)

    const [availableUnits, setAvailableUnits] = useState([]);
    const [groupedUnits, setGroupedUnits] = useState({});
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [notes] = useState('');
    const [unitTypes, setUnitTypes] = useState([]);
    const [unitLocations, setUnitLocations] = useState({});
    const [unitRoutes, setUnitRoutes] = useState({});
    const [routesLoading, setRoutesLoading] = useState(false);
    const [externalUnitLocations, setExternalUnitLocations] = useState({});
    const [externalUnitRoutes, setExternalUnitRoutes] = useState({});
    const [recommendExternalUnits, setRecommendExternalUnits] = useState(false);
    const [nearestRouteGeometry, setNearestRouteGeometry] = useState(null);

    // Para distinguir "el despachador acaba de marcar/mover el destino"
    // (debe sentirse instantáneo) de "solo se movió una unidad en vivo"
    // (eso sí se debounce, ver los useEffect de rutas de abajo).
    const lastDestKeyRef = useRef(null);
    const lastExternalDestKeyRef = useRef(null);
    const lastNearestDestKeyRef = useRef(null);

    const [externalUnits, setExternalUnits] = useState([]);
    const [groupedExternalUnits, setGroupedExternalUnits] = useState({});
    const [selectedExternalUnits, setSelectedExternalUnits] = useState([]);

    const [addressSearch, setAddressSearch] = useState('');
    const [searchingAddress, setSearchingAddress] = useState(false);
    const [addressResults, setAddressResults] = useState([]);
    const [addressMessage, setAddressMessage] = useState('');
    const { region } = useRegion();

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
        fetch(`${API_BASE_URL}/emergencias/tipos-emergencia`,
            { headers: { "Content-Type": "application/json" } })
            .then((res) => res.json())
            .then(({data}) => setEmergencyTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando los tipos de emergencia. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`,
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
        fetch(`${API_BASE_URL}/unidades/ambulancias-disponibles/${user.institutionId}`,
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
            fetch(`${API_BASE_URL}/unidades/ubicacion/${u.ambulance_id}`, {
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
    //
    // unitLocations ahora puede cambiar cada pocos segundos POR CADA unidad
    // (llega en vivo por eventoUbicacionAmbulancia) — sin debounce, cada
    // actualización de CUALQUIER unidad dispararía una tanda completa de
    // llamadas a OSRM. PERO el debounce solo debe aplicar cuando lo que
    // cambió fue la ubicación de una unidad EN VIVO — no cuando el
    // despachador acaba de marcar/mover el destino, que debe sentirse
    // instantáneo (antes se sentía "tardadísimo" porque el debounce le
    // pegaba a los dos casos por igual). lastDestKeyRef distingue uno del
    // otro: si el destino cambió desde la última corrida, se pide la ruta YA;
    // si el destino sigue igual (solo se movió alguna unidad), se espera.
    useEffect(() => {
        if (!latitude || !longitude) { setUnitRoutes({}); return }
        const unitsWithLocation = availableUnits.filter((u) => unitLocations[u.ambulance_id]?.latitude && unitLocations[u.ambulance_id]?.longitude)
        if (unitsWithLocation.length === 0) { setUnitRoutes({}); return }

        const run = () => {
            setRoutesLoading(true)
            Promise.all(unitsWithLocation.map((u) => {
                const loc = unitLocations[u.ambulance_id]
                return fetchRouteDistance(parseFloat(loc.latitude), parseFloat(loc.longitude), parseFloat(latitude), parseFloat(longitude))
                    .then((route) => [u.ambulance_id, route])
            }))
                .then((entries) => setUnitRoutes(Object.fromEntries(entries)))
                .finally(() => setRoutesLoading(false))
        }

        const destKey = `${latitude},${longitude}`
        const destinationJustChanged = lastDestKeyRef.current !== destKey
        lastDestKeyRef.current = destKey

        if (destinationJustChanged) { run(); return }

        const timeoutId = setTimeout(run, 4000)
        return () => clearTimeout(timeoutId)
    }, [latitude, longitude, availableUnits, unitLocations])

    const fetchExternalUnits = () => {
        fetch(`${API_BASE_URL}/unidades/ambulancias-externas/${user.institutionId}`,
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

        // El backend YA manda esto (sicem-mobile reporta ubicación cada 15s
        // mientras hay turno activo) — solo faltaba escucharlo. Antes cada
        // unidad se ubicaba UNA vez al aparecer en availableUnits/externalUnits
        // (ver los useEffect de arriba con fetch a /unidades/ubicacion/:id) y
        // ya nunca se volvía a mover en el mapa ni a recalcular su ruta/ETA
        // sin recargar la página. Actualiza el que corresponda (propia o
        // externa) — si el ambulanceId no está en ninguna todavía, no hace
        // nada (se resuelve solo cuando esa unidad aparezca en la lista).
        unitsSocket.on('eventoUbicacionAmbulancia', ({ ambulanceId, latitude, longitude }) => {
            setUnitLocations((current) => current[ambulanceId]
                ? { ...current, [ambulanceId]: { ...current[ambulanceId], latitude, longitude } }
                : current)
            setExternalUnitLocations((current) => current[ambulanceId]
                ? { ...current, [ambulanceId]: { ...current[ambulanceId], latitude, longitude } }
                : current)
        })

        return () => unitsSocket.disconnect()
    }, [token])

    // Misma idea que unitLocations pero para las externas — así también se ven
    // en el mapa, no solo las propias.
    useEffect(() => {
        if (externalUnits.length === 0) { setExternalUnitLocations({}); return }
        Promise.all(externalUnits.map((u) =>
            fetch(`${API_BASE_URL}/unidades/ubicacion/${u.ambulance_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then((res) => res.ok ? res.json() : { data: null })
                .then(({ data }) => [u.ambulance_id, data ? toLowerCaseKeys(data) : null])
                .catch(() => [u.ambulance_id, null])
        )).then((entries) => setExternalUnitLocations(Object.fromEntries(entries)))
    }, [externalUnits, token])

    // Rutas de las unidades EXTERNAS hacia el destino — solo se calculan si
    // recommendExternalUnits está prendido (el filtro que pidió Hugo: por
    // default NO se recomiendan unidades de otras instituciones como "la más
    // cercana", porque pedirlas de verdad implica un paso extra —
    // interinstitucional, esperar autorización— que una unidad propia no
    // necesita). Mismo criterio de "instantáneo si cambió el destino,
    // debounced si solo se movió una unidad" que el efecto de arriba.
    useEffect(() => {
        if (!recommendExternalUnits || !latitude || !longitude) { setExternalUnitRoutes({}); return }
        const unitsWithLocation = externalUnits.filter((u) => externalUnitLocations[u.ambulance_id]?.latitude && externalUnitLocations[u.ambulance_id]?.longitude)
        if (unitsWithLocation.length === 0) { setExternalUnitRoutes({}); return }

        const run = () => {
            Promise.all(unitsWithLocation.map((u) => {
                const loc = externalUnitLocations[u.ambulance_id]
                return fetchRouteDistance(parseFloat(loc.latitude), parseFloat(loc.longitude), parseFloat(latitude), parseFloat(longitude))
                    .then((route) => [u.ambulance_id, route])
            })).then((entries) => setExternalUnitRoutes(Object.fromEntries(entries)))
        }

        const destKey = `${latitude},${longitude}`
        const destinationJustChanged = lastExternalDestKeyRef.current !== destKey
        lastExternalDestKeyRef.current = destKey

        if (destinationJustChanged) { run(); return }

        const timeoutId = setTimeout(run, 4000)
        return () => clearTimeout(timeoutId)
    }, [recommendExternalUnits, latitude, longitude, externalUnits, externalUnitLocations])

    useEffect(() =>{
        fetch(`${API_BASE_URL}/unidades/tipos-ambulancia`, {
            headers: { "Content-Type":"application/json" }
        })
        .then(res => res.json())
        .then(({data}) => setUnitTypes(data.map(type => toLowerCaseKeys(type))))
        .catch(error => console.error('Error consultando los tipos de unidades. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-destino`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({data}) => setDestinationInstitutions(data.map(inst => toLowerCaseKeys(inst))))
            .catch(error => console.error('Error recuperando instituciones de destino. ', error))
        // Se vuelve a pedir al pasar al paso de pacientes: las camas y especialidades de un hospital
        // cambian mientras el despachador tiene esta pantalla abierta.
    }, [step]);

    // Mismo patrón que ya usa Capacity.jsx en sicem-desktop: trae ambas listas una
    // sola vez al montar, y se filtra en el cliente por institución al renderizar
    // el select de especialidad de cada paciente.
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
    }, [step]);

    //---------------------------------registrar, posts--------------------------------------------------

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/emergencias/registrar-emergencia`,
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
                    notify(error.message, 'error')
                    throw error // nunca se creó nada — aborta el flujo, es seguro reintentar
                })
                .then(emergencyData => {
                    // La emergencia YA existe en este punto. Si asignar unidades o mandar
                    // solicitudes falla, no lo tratamos como que "todo falló" (evita que el
                    // despachador reintente el formulario y duplique la emergencia) — solo
                    // avisamos qué parte específica no se pudo completar.
                    const assignPromise = selectedUnits.length !== 0
                        ? fetch(`${API_BASE_URL}/emergencias/registrar-asignacion`, {
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
                            notify(`La emergencia se registró, pero no se pudieron asignar las unidades: ${error.message}`, 'error')
                        })
                        : Promise.resolve(null)

                    const requestPromises = selectedExternalUnits.map((ambulanceId) => {
                        const externalUnit = externalUnits.find(u => u.ambulance_id === ambulanceId)
                        return fetch(`${API_BASE_URL}/emergencias/registrar-solicitud`, {
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
                            notify(`La emergencia se registró, pero no se pudo enviar la solicitud para la unidad ${externalUnit?.unit_number || ''}: ${error.message}`, 'error')
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

    // Marca el punto elegido: coordenadas al formulario (el mapa se centra solo con flyToLocation)
    const applyAddressResult = (result) => {
        setLatitude(result.lat.toFixed(8))
        setLongitude(result.lon.toFixed(8))
        setAddressResults([])
        setAddressMessage('')
    }

    // Busca la dirección dentro de la región de la institución. Con una sola coincidencia se marca
    // sola; con varias se muestran para elegir (la primera a ciegas puede mandar la unidad al lugar
    // equivocado).
    const handleAddressSearch = () => {
        if (!addressSearch.trim()) return
        setSearchingAddress(true)
        setAddressResults([])
        setAddressMessage('')
        searchAddress(addressSearch, region, { limit: ADDRESS_RESULTS_LIMIT })
            .then((results) => {
                if (results.length === 0) {
                    setAddressMessage('No encontramos esa dirección. Prueba con la calle y la colonia, o marca el punto directamente en el mapa.')
                } else if (results.length === 1) {
                    applyAddressResult(results[0])
                } else {
                    setAddressResults(results)
                    setAddressMessage('Hay varias coincidencias: elige la correcta.')
                }
            })
            .catch((error) => {
                console.error('Error buscando dirección. ', error)
                setAddressMessage('No se pudo consultar el buscador de direcciones. Marca el punto directamente en el mapa.')
            })
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
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp}`, {
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
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp.trim()}`, {
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
            notify('No se pudo verificar las CURPs contra el sistema. Revisa tu conexión e intenta de nuevo.', 'error')
        })
}

const proceedWithConfirmation = (forms) => {
    const hasAnyData = (p) =>
        p.curp.trim() || p.firstName.trim() || p.firstSurname.trim() || p.notes.trim()

    const emptyIndex = forms.findIndex((p) => !hasAnyData(p))
    if (emptyIndex !== -1) {
        notify(`El Paciente ${emptyIndex + 1} no tiene ningún dato. Llena al menos un campo (CURP, nombre o notas) o usa "Omitir por ahora".`, 'error')
        return
    }

    const filledCurps = forms.map(p => p.curp.trim()).filter(curp => curp !== '')
    const duplicatedCurp = filledCurps.find((curp, index) => filledCurps.indexOf(curp) !== index)
    if (duplicatedCurp) {
        notify(`La CURP ${duplicatedCurp} está repetida en más de un paciente. Cada paciente debe tener una CURP distinta.`, 'error')
        return
    }

    // Todo paciente con datos capturados debe tener un hospital destino asignado —
    // la ambulancia necesita saber a dónde va, no es opcional como la unidad.
    const missingDestinationIndex = forms.findIndex((p) => !p.destinationInstitutionId)
    if (missingDestinationIndex !== -1) {
        notify(`El Paciente ${missingDestinationIndex + 1} no tiene hospital destino asignado. Selecciona uno antes de continuar.`, 'error')
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
            notify(`El Paciente ${previousDestination.index + 1} y el Paciente ${i + 1} tienen la misma unidad asignada pero hospitales destino distintos. Una ambulancia no puede ir a dos hospitales a la vez — corrígelo antes de continuar.`, 'error')
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
            notify(`La unidad ${unit?.unit_number || ambulanceId} tiene ${indices.length} pacientes asignados (Paciente ${pacientesTexto}) — el máximo es ${MAX_PATIENTS_PER_AMBULANCE} por ambulancia. Reparte los pacientes entre más unidades antes de continuar.`, 'error')
            return
        }
    }

    // el resto es idéntico a lo que ya tenías, solo cambia patientForms por forms:
    const promises = forms.map((patient) => {
        if (patient.userProfileId) {
            return fetch(`${API_BASE_URL}/emergencias/registrar-paciente`, {
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
        return fetch(`${API_BASE_URL}/usuarios/registro-paciente`, {
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
                return fetch(`${API_BASE_URL}/emergencias/registrar-paciente`, {
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
            notify(`La emergencia ya está registrada y en curso. No se pudo guardar la identificación de uno o más pacientes: ${error.message}. Puedes agregarla después desde el detalle de la emergencia.`, 'error')
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
            notify('Selecciona al menos una unidad nueva antes de confirmar.', 'error')
            return
        }

        setAddingUnits(true)

        const ownPromise = newOwnIds.length > 0
            ? fetch(`${API_BASE_URL}/emergencias/registrar-asignacion`, {
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
            return fetch(`${API_BASE_URL}/emergencias/registrar-solicitud`, {
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
                notify(`No se pudieron agregar las unidades nuevas: ${error.message}`, 'error')
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
    const sortByRoute = (units, routesDict) => {
        const withRoute = units.map((u) => ({ ...u, route: routesDict[u.ambulance_id] || null }))
        return withRoute.sort((a, b) => {
            if (!a.route && !b.route) return 0
            if (!a.route) return 1
            if (!b.route) return -1
            return a.route.durationMin - b.route.durationMin
        })
    }
    const sortUnitsByDistance = (units) => sortByRoute(units, unitRoutes)
    const sortExternalUnitsByDistance = (units) => sortByRoute(units, externalUnitRoutes)

    // La más cercana (en tiempo real de traslado) — por default solo entre las
    // propias disponibles, sin importar tipo. Si recommendExternalUnits está
    // prendido (filtro que pidió Hugo), también compite contra las externas
    // con ruta ya calculada; si no, ni se le calcula ruta a las externas (ver
    // el useEffect de arriba) para no gastar de más en OSRM por algo que ni
    // se va a mostrar.
    const nearestUnitId = (() => {
        if (!latitude || !longitude) return null
        const ownWithRoute = sortUnitsByDistance(availableUnits).filter(u => u.route !== null)
        if (!recommendExternalUnits) {
            return ownWithRoute.length > 0 ? ownWithRoute[0].ambulance_id : null
        }
        const externalWithRoute = sortExternalUnitsByDistance(externalUnits).filter(u => u.route !== null)
        const combined = [...ownWithRoute, ...externalWithRoute].sort((a, b) => a.route.durationMin - b.route.durationMin)
        return combined.length > 0 ? combined[0].ambulance_id : null
    })()

    // Traza completa (punto A: la unidad más cercana → punto B: la emergencia)
    // para dibujarla en el mapa — a diferencia del cálculo de arriba (que solo
    // pide distancia/duración con overview=false, más liviano), aquí sí se
    // pide la geometría completa (overview=full), pero solo para la unidad
    // ganadora — pedirla para las 5-10 unidades sería tirar la mayoría. La
    // unidad ganadora puede ser propia o externa (si el filtro está prendido),
    // por eso busca la ubicación en las dos listas.
    useEffect(() => {
        if (!nearestUnitId || !latitude || !longitude) { setNearestRouteGeometry(null); return }
        const loc = unitLocations[nearestUnitId] || externalUnitLocations[nearestUnitId]
        if (!loc?.latitude || !loc?.longitude) { setNearestRouteGeometry(null); return }

        const run = () => {
            const url = `${OSRM_ROUTE_URL}/${loc.longitude},${loc.latitude};${longitude},${latitude}?overview=full&geometries=geojson`
            fetch(url)
                .then(res => res.json())
                .then((data) => {
                    if (data.code !== 'Ok' || !data.routes?.[0]) { setNearestRouteGeometry(null); return }
                    // GeoJSON trae [lon, lat] — Leaflet quiere [lat, lon].
                    setNearestRouteGeometry(data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]))
                })
                .catch((error) => { console.error('Error trazando la ruta más cercana. ', error); setNearestRouteGeometry(null) })
        }

        // Mismo criterio de "instantáneo si de verdad cambió algo (destino o
        // unidad ganadora), debounced si solo se movió una unidad en vivo".
        const destKey = `${nearestUnitId}:${latitude},${longitude}`
        const changed = lastNearestDestKeyRef.current !== destKey
        lastNearestDestKeyRef.current = destKey

        if (changed) { run(); return }

        const timeoutId = setTimeout(run, 4000)
        return () => clearTimeout(timeoutId)
    }, [nearestUnitId, latitude, longitude, unitLocations, externalUnitLocations])

    //---------------------------------PASO 2: JSX de identificación de pacientes--------------------------------------------------

    // Unidades ya asignadas a esta emergencia en el Paso 1 (propias + externas), con su
    // unit_number, para elegir por paciente a cuál va cada uno
    const assignedUnitsForPatients = [
        ...availableUnits.filter((u) => selectedUnits.includes(u.ambulance_id)),
        ...externalUnits.filter((u) => selectedExternalUnits.includes(u.ambulance_id)),
    ]

    //---------------------------------PRESENTACIÓN COMPARTIDA (solo visual)--------------------------------------------------

    const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }

    // Encabezado con el indicador de pasos. `active` = 1 (reporte y unidades) | 2 (pacientes)
    const renderHeader = (active) => (
        <div className="ne-header">
            <div>
                <h1 className="ne-title">{active === 1 ? 'Nueva emergencia' : 'Identificación de pacientes'}</h1>
                <p className="ne-subtitle">
                    {active === 1
                        ? 'Registra el reporte, elige la unidad más cercana y deja listo el traslado.'
                        : (chosenUnitNames.length > 0 ? 'La ambulancia ya va en camino. ' : 'Aún no hay unidad asignada. ') + 'Esta información es opcional y puedes completarla ahora o después.'}
                </p>
            </div>
            <ol className="ne-steps" aria-label="Pasos del registro">
                <li className={active === 1 ? 'on' : 'done'} aria-current={active === 1 ? 'step' : undefined}>
                    <span className="ne-step-n">{active === 1 ? '1' : <Icon name="check" size={14} strokeWidth={3} />}</span>Reporte y unidades
                </li>
                <li className={active === 2 ? 'on' : ''} aria-current={active === 2 ? 'step' : undefined}>
                    <span className="ne-step-n">2</span>Pacientes
                </li>
            </ol>
        </div>
    )

    // Resumen de lo que se va a registrar, para la barra de acción del paso 1
    const selectedTypeName = emergencyTypes.find((t) => String(t.emergency_type_id) === String(emergencyTypeId))?.name
    const selectedTriage = triageLevels.find((t) => String(t.triage_level_id) === String(triageLevelId))
    const chosenUnitNames = [
        ...availableUnits.filter((u) => selectedUnits.includes(u.ambulance_id)).map((u) => u.unit_number),
        ...externalUnits.filter((u) => selectedExternalUnits.includes(u.ambulance_id)).map((u) => `${u.unit_number} (otra institución)`),
    ]
    const missingFields = [
        !(latitude && longitude) && 'ubicación en el mapa',
        !emergencyTypeId && 'tipo de emergencia',
        !description.trim() && 'descripción',
        !reporterName.trim() && 'quién reporta',
        reporterPhone.length !== 10 && 'teléfono de 10 dígitos',
        !numPatients && 'número de pacientes',
    ].filter(Boolean)

    if (step === 2) {
        return (
            <div className="new-emergency-page">
                <Navbar
                    userName={user?.firstName || 'Usuario'}
                    roleLabel={roleLabel(user?.roleId)}
                    links={navLinks}
                />

                <main id="contenido" className="ne-step2-main">
                {renderHeader(2)}

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
                                    <label className="pid-field pid-grow"><span>CURP</span><input type="text" 
                                        value={patient.curp}
                                        onChange={(e) => updatePatientField(index, 'curp', e.target.value)}
                                        maxLength={18}
                                    /></label>
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
                                    <label className="pid-field"><span>Nombre(s)</span><input type="text" 
                                        value={patient.firstName}
                                        onChange={(e) => updatePatientField(index, 'firstName', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={100}
                                    /></label>
                                    <label className="pid-field"><span>Apellido paterno</span><input type="text" 
                                        value={patient.firstSurname}
                                        onChange={(e) => updatePatientField(index, 'firstSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={150}
                                    /></label>
                                </div>
                                <div className="patient-id-row">
                                    <label className="pid-field"><span>Apellido materno</span><input type="text" 
                                        value={patient.secondSurname}
                                        onChange={(e) => updatePatientField(index, 'secondSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={150}
                                    /></label>
                                    <label className="pid-field"><span>Teléfono</span><input type="text" 
                                        value={patient.phone}
                                        onChange={(e) => updatePatientField(index, 'phone', e.target.value)}
                                        readOnly={patient.found === true}
                                        maxLength={10}
                                    /></label>
                                </div>

                                <label className="pid-field"><span>Fecha de nacimiento</span><input type="date" 
                                    value={patient.birthDate}
                                    onChange={(e) => updatePatientField(index, 'birthDate', e.target.value)}
                                    readOnly={patient.found === true}
                                    className="patient-id-date"
                                /></label>

                                <label className="pid-field"><span>Notas adicionales <em>(opcional: descripción física si no hay identificación)</em></span><textarea 
                                    value={patient.notes}
                                    onChange={(e) => updatePatientField(index, 'notes', e.target.value)}
                                    maxLength={300}
                                /></label>

                                <div className="patient-id-row">
                                    <select aria-label="Hospital destino"
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
                                    <select aria-label="Especialidad"
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
                                        <select aria-label="Unidad asignada"
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
                </main>
            </div>
        )
    }

    //---------------------------------PASO 1: JSX del formulario principal--------------------------------------------------

    return (
        <div className="new-emergency-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <div role="main" id="contenido" className="ne-scroll">
                <RegionNotice />
                {renderHeader(1)}

                <form onSubmit={handleSubmit} className="ne-form">
                    <div className="ne-layout">

                        <div className="ne-main">
                            <section className="ne-card" aria-labelledby="ne-loc-title">
                                <h2 className="ne-card-title" id="ne-loc-title">Ubicación</h2>
                                <p className="ne-card-sub">Busca la dirección que dio quien llamó, o haz clic en el mapa para marcarla.</p>

                                <div className="ne-address-search">
                                    <input
                                        type="text"
                                        value={addressSearch}
                                        onChange={(e) => setAddressSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                                        placeholder="Dirección reportada por la llamada"
                                        aria-label="Dirección reportada"
                                    />
                                    <button type="button" className="ne-btn ne-btn-primary" onClick={handleAddressSearch} disabled={searchingAddress}>
                                        <Icon name="search" size={16} />{searchingAddress ? 'Buscando…' : 'Buscar'}
                                    </button>
                                </div>

                                {addressMessage && <p className="ne-address-msg" role="status">{addressMessage}</p>}
                                {addressResults.length > 0 && (
                                    <ul className="ne-address-results" aria-label="Coincidencias de la dirección">
                                        {addressResults.map((r, i) => (
                                            <li key={`${r.lat}-${r.lon}-${i}`}>
                                                <button type="button" onClick={() => applyAddressResult(r)}>
                                                    <Icon name="pin" size={15} />{r.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="ne-map-wrapper">
                                    <MapArea
                                        ambulances={allUnitsForMap}
                                        emergencyLocation={latitude && longitude ? { latitude, longitude } : null}
                                        hospitals={destinationInstitutions}
                                        onMapClick={handleMapClick}
                                        flyToLocation={latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : null}
                                        routes={nearestRouteGeometry ? [{ coordinates: nearestRouteGeometry }] : []}
                                    />
                                </div>

                                <div className="ne-coords">
                                    <div className="ne-field">
                                        <label htmlFor="ne-lat">Latitud</label>
                                        <input
                                            id="ne-lat"
                                            type="number" step="0.00000001"
                                            value={latitude}
                                            onChange={(e) => setLatitude(e.target.value)}
                                            placeholder="Clic en el mapa"
                                            required
                                        />
                                    </div>
                                    <div className="ne-field">
                                        <label htmlFor="ne-lon">Longitud</label>
                                        <input
                                            id="ne-lon"
                                            type="number" step="0.00000001"
                                            value={longitude}
                                            onChange={(e) => setLongitude(e.target.value)}
                                            placeholder="Clic en el mapa"
                                            required
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="ne-card" aria-labelledby="ne-rep-title">
                                <h2 className="ne-card-title" id="ne-rep-title">Reporte</h2>
                                <p className="ne-card-sub">Con estos datos el equipo en campo sabrá qué esperar.</p>

                                <div className="ne-row">
                                    <div className="ne-field">
                                        <label htmlFor="ne-type">Tipo de emergencia</label>
                                        <select id="ne-type" value={emergencyTypeId} onChange={(e) => setEmergencyTypeId(e.target.value)} required>
                                            <option value="">Selecciona un tipo</option>
                                            {emergencyTypes.map((type) => (
                                                <option key={type.emergency_type_id} value={type.emergency_type_id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ne-field">
                                        <label htmlFor="ne-pac">Número de pacientes</label>
                                        <input id="ne-pac" type="number" value={numPatients} onChange={(e) => setNumPatients(e.target.value)} min="1" required />
                                    </div>
                                </div>

                                <div className="ne-field">
                                    <label htmlFor="ne-desc">Qué pasó</label>
                                    <textarea
                                        id="ne-desc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe lo que reportó la persona que llamó"
                                        maxLength={200}
                                        required
                                    />
                                    <span className="ne-hint">{description.length}/200 · Anota solo lo que dijo quien llamó.</span>
                                </div>

                                <div className="ne-row">
                                    <div className="ne-field">
                                        <label htmlFor="ne-who">Quién reporta</label>
                                        <input id="ne-who" type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} maxLength={200} required />
                                    </div>
                                    <div className="ne-field">
                                        <label htmlFor="ne-tel">Teléfono de contacto</label>
                                        <input
                                            id="ne-tel"
                                            type="text"
                                            inputMode="numeric"
                                            value={reporterPhone}
                                            onChange={(e) => setReporterPhone(e.target.value)}
                                            maxLength={10}
                                            required
                                            aria-describedby="ne-tel-hint"
                                            className={reporterPhone.length > 0 && reporterPhone.length < 10 ? 'ne-invalid' : ''}
                                        />
                                        <span id="ne-tel-hint" className={reporterPhone.length > 0 && reporterPhone.length < 10 ? 'ne-hint-error' : 'ne-hint'}>
                                            {reporterPhone.length > 0 && reporterPhone.length < 10
                                                ? <><Icon name="alert" size={14} />Faltan dígitos: el teléfono tiene 10 ({reporterPhone.length} de 10).</>
                                                : '10 dígitos, sin lada internacional.'}
                                        </span>
                                    </div>
                                </div>

                                <div className="ne-field">
                                    <span className="ne-label">Nivel de urgencia estimado <span className="ne-optional">(opcional)</span></span>
                                    <div className="ne-tri" role="group" aria-label="Nivel de urgencia estimado">
                                        <button
                                            type="button"
                                            className="ne-tri-opt ne-tri-none"
                                            aria-pressed={triageLevelId === ''}
                                            onClick={() => setTriageLevelId('')}
                                        >
                                            Sin estimar
                                        </button>
                                        {triageLevels.map((t) => (
                                            <button
                                                key={t.triage_level_id}
                                                type="button"
                                                className="ne-tri-opt"
                                                style={{ '--c': t.hex_color }}
                                                aria-pressed={String(triageLevelId) === String(t.triage_level_id)}
                                                onClick={() => setTriageLevelId(String(t.triage_level_id))}
                                            >
                                                <b>{ROMAN[t.level] || t.level}</b>
                                                <span>{t.color}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="ne-side">
                            <section className="ne-card ne-units-card" aria-labelledby="ne-units-title">
                                <h2 className="ne-card-title" id="ne-units-title">Tus unidades</h2>
                                <p className="ne-card-sub">Asignación directa, sin pedir permiso a nadie.</p>
                                {latitude && longitude && (
                                    <p className="ne-distance-hint">
                                        {routesLoading ? 'Calculando rutas…' : 'Ordenadas por tiempo real de traslado a la ubicación marcada.'}
                                    </p>
                                )}

                                {unitTypes.map((type) => {
                                    const unitsOfThisType = sortUnitsByDistance(groupedUnits[type.ambulance_type_id] || [])
                                    return (
                                        <div key={type.ambulance_type_id} className="unit-type-group">
                                            <div className="unit-type-header">
                                                {type.image_url && (
                                                    <img className="unit-type-image" src={`/assets/units/${type.image_url}`} alt="" />
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
                                                                    {unit.ambulance_id === nearestUnitId && <span className="unit-nearest-badge"><Icon name="check" size={12} />Más cercana</span>}
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
                            </section>

                            <section className="ne-card ne-units-card" aria-labelledby="ne-ext-title">
                                <h2 className="ne-card-title" id="ne-ext-title">Otras instituciones</h2>
                                <p className="ne-card-sub">Requieren solicitud: el hospital dueño de la unidad debe aceptarla.</p>

                                <label className="ne-recommend-external-toggle">
                                    <input
                                        type="checkbox"
                                        checked={recommendExternalUnits}
                                        onChange={(e) => setRecommendExternalUnits(e.target.checked)}
                                    />
                                    <span>Recomendar unidades de otras instituciones como "más cercana"</span>
                                </label>
                                <p className="ne-distance-hint">
                                    {recommendExternalUnits
                                        ? 'Compiten contra tus propias unidades, pero pedirlas de verdad necesita autorización de su hospital: no es asignación directa.'
                                        : 'Apagado: solo tus propias unidades pueden salir recomendadas como "más cercana". Actívalo para incluir también las externas en esa comparación.'}
                                </p>

                                {unitTypes.map((type) => {
                                    const unitsOfType = groupedExternalUnits[type.ambulance_type_id] || []
                                    const unitsOfThisType = recommendExternalUnits ? sortExternalUnitsByDistance(unitsOfType) : unitsOfType
                                    if (unitsOfThisType.length === 0) return null
                                    return (
                                        <div key={`ext-${type.ambulance_type_id}`} className="unit-type-group unit-type-group-external">
                                            <div className="unit-type-header">
                                                {type.image_url && (
                                                    <img className="unit-type-image" src={`/assets/units/${type.image_url}`} alt="" />
                                                )}
                                                <span className="unit-type-name">{type.ambulance_type}</span>
                                                <span className="unit-type-count">{unitsOfThisType.length} disp.</span>
                                            </div>
                                            <div className="unit-cards-grid">
                                                {unitsOfThisType.map((unit) => (
                                                    <label key={unit.ambulance_id} className={`unit-card unit-card-external ${selectedExternalUnits.includes(unit.ambulance_id) ? 'selected' : ''}`}>
                                                        <input type="checkbox" checked={selectedExternalUnits.includes(unit.ambulance_id)} onChange={() => toggleExternalUnitSelection(unit.ambulance_id)} />
                                                        <div className="unit-card-info">
                                                            <span className="unit-card-number">
                                                                {unit.unit_number}
                                                                {recommendExternalUnits && unit.ambulance_id === nearestUnitId && <span className="unit-nearest-badge"><Icon name="check" size={12} />Más cercana</span>}
                                                            </span>
                                                            <span className="unit-card-institution">
                                                                {unit.institution_name}
                                                                {recommendExternalUnits && unit.route && ` · ${unit.route.distanceKm.toFixed(1)} km · ${Math.round(unit.route.durationMin)} min`}
                                                            </span>
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
                            </section>
                        </aside>
                    </div>

                    <div className="ne-actionbar" role="region" aria-label="Resumen y registro">
                        <dl className="ne-summary">
                            <div>
                                <dt>Emergencia</dt>
                                <dd>{selectedTypeName || <span className="ne-pending">Sin tipo</span>}{numPatients ? ` · ${numPatients} ${Number(numPatients) === 1 ? 'paciente' : 'pacientes'}` : ''}</dd>
                            </div>
                            <div>
                                <dt>Urgencia</dt>
                                <dd>
                                    {selectedTriage
                                        ? <><span className="ne-tri-chip" style={{ '--c': selectedTriage.hex_color, color: readableTextOn(selectedTriage.hex_color) }}>{ROMAN[selectedTriage.level] || selectedTriage.level}</span> {selectedTriage.color}</>
                                        : <span className="ne-pending">Sin estimar</span>}
                                </dd>
                            </div>
                            <div>
                                <dt>Unidades</dt>
                                <dd>{chosenUnitNames.length > 0 ? chosenUnitNames.join(', ') : <span className="ne-pending">Ninguna elegida</span>}</dd>
                            </div>
                        </dl>
                        <div className="ne-actionbar-end">
                            {missingFields.length > 0 && (
                                <span className="ne-missing">Falta: {missingFields.join(', ')}.</span>
                            )}
                            <button className="ne-submit" type="submit">
                                Registrar emergencia
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default NewEmergency;
