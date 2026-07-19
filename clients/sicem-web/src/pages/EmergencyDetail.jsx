import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './EmergencyDetail.css';
import { getNavLinks } from '../utils/Navlinks';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const EmergencyDetail = () => {
    const { emergencyId } = useParams();
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencyData, setEmergencyData] = useState(null);
    const [patients, setPatients] = useState([]);
    const [notesByPatient, setNotesByPatient] = useState({});
    const [assignments, setAssignments] = useState([]);

    //---------------------------------consultar, gets--------------------------------------------------

    useEffect(() => {
        fetch(`http://localhost:3000/emergencias/emergencia/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setEmergencyData(toLowerCaseKeys(data)))
            .catch(error => console.error('Ocurrió un error al consultar esta emergencia. ', error))
    }, [emergencyId]);

    useEffect(() => {
        fetch(`http://localhost:3000/emergencias/pacientes/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data.map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error consultando pacientes. ', error))
    }, [emergencyId]);

    useEffect(() => {
        patients.forEach((patient) => {
            fetch(`http://localhost:3000/emergencias/notas/${patient.emergency_patient_id}`, {
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

    useEffect(() => {
        fetch(`http://localhost:3000/emergencias/asignaciones/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAssignments(data.map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando asignaciones. ', error))
    }, [emergencyId]);

    //---------------------------------registrar, posts--------------------------------------------------

    const handleCloseEmergency = () => {
        fetch('http://localhost:3000/emergencias/cerrar-emergencia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId })
        })
            .then(res => res.json())
            .then(() => navigate('/dashboard'))
            .catch(error => console.error('Error cerrando la emergencia. ', error))
    }

    //---------------------------------registrar, posts--------------------------------------------------

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
                    {emergencyData.closed_at === null && (
                        <button className="detail-close-btn" onClick={handleCloseEmergency}>
                            Cerrar Emergencia
                        </button>
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
                        <span className="field-label">Número de pacientes</span>
                        <span className="field-value">{emergencyData.num_patients}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Ubicación (coordenadas)</span>
                        <span className="field-value">{emergencyData.latitude}, {emergencyData.longitude}</span>
                    </div>
                </div>

                <div className="detail-section">
                    <h3>Ambulancias Asignadas ({assignments.length})</h3>
                    {assignments.length === 0 ? (
                        <p className="detail-empty">Sin ambulancias asignadas todavía.</p>
                    ) : (
                        <div className="assignments-list">
                            {assignments.map((a) => (
                                <div key={a.assignment_id} className="assignment-card">
                                    <span className="assignment-unit">{a.unit_number}</span>
                                    <span className="assignment-plate">{a.license_plate}</span>
                                    <span className="assignment-paramedic">
                                        {a.first_name ? `${a.first_name} ${a.first_surname}` : 'Sin paramédico asignado'}
                                    </span>
                                    {a.unassigned_at && <span className="assignment-tag">Desasignada</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="detail-section">
                    <h3>Pacientes ({patients.length})</h3>
                    <p className="detail-note-hint">
                        Los pacientes y sus notas de urgencia son registrados por el paramédico en campo desde la app móvil.
                    </p>
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
                                </div>
                                {patient.notes && <p className="patient-notes">{patient.notes}</p>}

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
            </div>
        </div>
    )
}

export default EmergencyDetail;