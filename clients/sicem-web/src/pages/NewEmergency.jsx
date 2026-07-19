import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toLowerCaseKeys } from "../utils/formatData";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import MapArea from "../components/map/MapArea";
import { getNavLinks } from "../utils/Navlinks";
import './NewEmergency.css';

const NewEmergency = () => {
    const [emergencyTypeId, setEmergencyTypeId] = useState('');
    const [longitude, setLongitude] = useState('');
    const [latitude, setLatitude] = useState('');
    const [description, setDescription] = useState('');
    const [reporterName, setReporterName] = useState('');
    const [reporterPhone, setReporterPhone] = useState('');
    const [numPatients, setNumPatients] = useState('');
    const [emergencyTypes, setEmergencyTypes] = useState([]);
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const navLinks = getNavLinks(user?.roleId)

    const [availableUnits, setAvailableUnits] = useState([]);
    const [groupedUnits, setGroupedUnits] = useState({});
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [notes, setNotes] = useState('');
    const [unitTypes, setUnitTypes] = useState([]);

    const [externalUnits, setExternalUnits] = useState([]);
    const [groupedExternalUnits, setGroupedExternalUnits] = useState({});
    const [selectedExternalUnits, setSelectedExternalUnits] = useState([]);

    const [addressSearch, setAddressSearch] = useState('');
    const [searchingAddress, setSearchingAddress] = useState(false);

    const [destinationInstitutions, setDestinationInstitutions] = useState([]);
    const [destinationInstitutionId, setDestinationInstitutionId] = useState('');

    // ── Paso 2: identificación de pacientes (opcional, no bloqueante) ──
    const [step, setStep] = useState(1); // 1 = registro de emergencia, 2 = identificación de pacientes
    const [registeredEmergencyId, setRegisteredEmergencyId] = useState(null);
    const [patientForms, setPatientForms] = useState([]);
    const [searchingCurpIndex, setSearchingCurpIndex] = useState(null);

    //---------------------------------consultar, gets--------------------------------------------------

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/tipos-emergencia',
            { headers: { "Content-Type": "application/json" } })
            .then((res) => res.json())
            .then(({data}) => setEmergencyTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando los tipos de emergencia. ', error))
    }, []);

    useEffect(()=>{
        fetch(`http://localhost:3000/unidades/ambulancias-disponibles/${user.institutionId}`,
            { headers: { "Content-Type": "application/json", "Authorization":`Bearer ${token}` } })
            .then(res => res.json())
            .then(({data}) => setAvailableUnits(data.map((u) => toLowerCaseKeys(u))))
            .catch(error => console.error('Error recuperando las unidades disponibles. ', error))
    }, [])

    useEffect(()=>{
        fetch(`http://localhost:3000/unidades/ambulancias-externas/${user.institutionId}`,
            { headers: { "Content-Type": "application/json", "Authorization":`Bearer ${token}` } })
            .then(res => res.json())
            .then(({data}) => setExternalUnits(data.map((u) => toLowerCaseKeys(u))))
            .catch(error => console.error('Error recuperando las unidades externas. ', error))
    }, [])

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
                    numPatients: numPatients
                }),})
                .then(res => res.json())
                .then(emergencyData => {
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
                        }).then(res => res.json())
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
                        }).then(res => res.json())
                    })

                    return Promise.all([assignPromise, ...requestPromises]).then(() => emergencyData)
                })
                .then((emergencyData) => {
                    // La ambulancia ya está en camino — ahora pasamos al paso 2 (opcional)
                    setRegisteredEmergencyId(emergencyData.emergencyId)
                    const count = parseInt(numPatients) || 1
                    setPatientForms(
                        Array.from({ length: count }, () => ({
                            curp: '', found: null, userProfileId: null,
                            firstName: '', firstSurname: '', secondSurname: '',
                            phone: '', birthDate: '', notes: ''
                        }))
                    )
                    setStep(2)
                })
                .catch(error => console.error('Se ha producido un error en fetch. ', error))
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
        // Validación: cada paciente necesita al menos un dato (CURP, nombre, o notas)
        const hasAnyData = (p) =>
            p.curp.trim() || p.firstName.trim() || p.firstSurname.trim() || p.notes.trim()

        const emptyIndex = patientForms.findIndex((p) => !hasAnyData(p))
        if (emptyIndex !== -1) {
            alert(`El Paciente ${emptyIndex + 1} no tiene ningún dato. Llena al menos un campo (CURP, nombre o notas) o usa "Omitir por ahora".`)
            return
        }

        const promises = patientForms.map((patient) => {
            // Si ya existe (encontrado por CURP), solo lo asociamos a la emergencia
            if (patient.userProfileId) {
                return fetch('http://localhost:3000/emergencias/registrar-paciente', {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        emergencyId: registeredEmergencyId,
                        userProfileId: patient.userProfileId,
                        notes: patient.notes,
                    })
                }).then(res => res.json())
            }

            // Si no existe, primero creamos su perfil básico SIN credenciales
            // (el paramédico nunca asigna email/password, eso lo hace el paciente después)
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
                .then(res => res.json())
                .then((newProfile) => {
                    // Ahora sí vinculamos usando el userProfileId real que regresa el backend
                    return fetch('http://localhost:3000/emergencias/registrar-paciente', {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({
                            emergencyId: registeredEmergencyId,
                            userProfileId: newProfile.userProfileId,
                            notes: patient.notes,
                        })
                    }).then(res => res.json())
                })
        })

        Promise.all(promises)
            .then(() => navigate('/dashboard'))
            .catch(error => console.error('Error registrando pacientes. ', error))
    }

    const handleSkipPatients = () => {
        navigate('/dashboard')
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

    const allUnitsForMap = [...availableUnits, ...externalUnits]

    //---------------------------------PASO 2: JSX de identificación de pacientes--------------------------------------------------

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
                                    />
                                    <input
                                        type="text" placeholder="Apellido paterno"
                                        value={patient.firstSurname}
                                        onChange={(e) => updatePatientField(index, 'firstSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                    />
                                </div>
                                <div className="patient-id-row">
                                    <input
                                        type="text" placeholder="Apellido materno"
                                        value={patient.secondSurname}
                                        onChange={(e) => updatePatientField(index, 'secondSurname', e.target.value)}
                                        readOnly={patient.found === true}
                                    />
                                    <input
                                        type="text" placeholder="Teléfono"
                                        value={patient.phone}
                                        onChange={(e) => updatePatientField(index, 'phone', e.target.value)}
                                        readOnly={patient.found === true}
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
                        <label>Hospital de destino sugerido</label>
                        <select value={destinationInstitutionId} onChange={(e) => setDestinationInstitutionId(e.target.value)}>
                            <option value="">Sin definir todavía</option>
                            {destinationInstitutions.map((inst) => (
                                <option key={inst.institution_id} value={inst.institution_id}>
                                    {inst.name} — {inst.available_beds} camas{inst.specialities ? ` — ${inst.specialities}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button className="ne-submit" type="submit">
                        Registrar Emergencia
                    </button>
                </div>

                <div className="ne-units-column">
                    <label className="ne-units-title">Tus Unidades (asignación directa)</label>

                    {unitTypes.map((type) => {
                        const unitsOfThisType = groupedUnits[type.ambulance_type_id] || []
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
                                                    <span className="unit-card-number">{unit.unit_number}</span>
                                                    <span className="unit-card-plate">{unit.license_plate}</span>
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