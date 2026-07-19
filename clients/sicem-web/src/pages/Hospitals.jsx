import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './Hospitals.css';
import { getNavLinks } from '../utils/Navlinks';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const Hospitals = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [institutions, setInstitutions] = useState([]);

    useEffect(() => {
        fetch('http://localhost:3000/hospitales/instituciones-destino', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutions(data.map(inst => toLowerCaseKeys(inst))))
            .catch(error => console.error('Error recuperando instituciones. ', error))
    }, []);

    const occupancyPercent = (available, capacity) => {
        if (!capacity) return 0
        const occupied = capacity - available
        return Math.round((occupied / capacity) * 100)
    }

    const occupancyLevel = (percent) => {
        if (percent >= 80) return 'high'
        if (percent >= 50) return 'mid'
        return 'low'
    }

    return (
        <div className="hospitals-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="hospitals-body">
                <h2 className="hospitals-title">Directorio de Instituciones</h2>
                <p className="hospitals-subtitle">Consulta la disponibilidad de camas y especialidades en tiempo real.</p>

                <div className="hospitals-grid">
                    {institutions.map((inst) => {
                        const percent = occupancyPercent(inst.available_beds, inst.bed_capacity)
                        const level = occupancyLevel(percent)
                        return (
                            <div key={inst.institution_id} className="hospital-card">
                                <h4 className="hospital-name">{inst.name}</h4>

                                <div className="hospital-beds-row">
                                    <div className="hospital-beds-numbers">
                                        <span className="beds-available">{inst.available_beds}</span>
                                        <span className="beds-total">/ {inst.bed_capacity} camas</span>
                                    </div>
                                    <div className="hospital-progress-bar">
                                        <div className={`hospital-progress-fill fill-${level}`} style={{ width: `${percent}%` }} />
                                    </div>
                                </div>

                                <div className="hospital-specialities">
                                    {inst.specialities
                                        ? inst.specialities.split(', ').map((sp) => (
                                            <span key={sp} className="speciality-tag">{sp}</span>
                                        ))
                                        : <span className="speciality-empty">Sin especialidades registradas</span>
                                    }
                                </div>
                            </div>
                        )
                    })}
                </div>

                {institutions.length === 0 && (
                    <p className="hospitals-empty">No hay instituciones registradas todavía.</p>
                )}
            </div>
        </div>
    )
}

export default Hospitals;