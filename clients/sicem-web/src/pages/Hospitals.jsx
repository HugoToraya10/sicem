import { useEffect, useState } from 'react';
import { roleLabel } from '../config/roles'
import Icon from '../components/ui/Icon';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './Hospitals.css';
import { getNavLinks } from '../utils/Navlinks';
import {API_BASE_URL} from '../config/api'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SkeletonCards from '../components/ui/SkeletonCards'


const Hospitals = () => {
    const { user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [institutions, setInstitutions] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState('');
    const [onlyWithBeds, setOnlyWithBeds] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-destino`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => { setInstitutions(data.map(inst => toLowerCaseKeys(inst))); setLoaded(true) })
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

    const visibleInstitutions = institutions.filter((inst) => {
        if (onlyWithBeds && !(inst.available_beds > 0)) return false
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (inst.name || '').toLowerCase().includes(q) || (inst.specialities || '').toLowerCase().includes(q)
    })

    return (
        <div className="hospitals-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <div role="main" id="contenido" className="hospitals-body">
                <h1 className="hospitals-title">Directorio de instituciones</h1>
                <p className="hospitals-subtitle">Consulta la disponibilidad de camas y las especialidades de cada institución.</p>

                <div className="hospitals-toolbar">
                    <div className="hospitals-search">
                        <Icon name="search" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por institución o especialidad"
                            aria-label="Buscar por institución o especialidad"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <label className="hospitals-check">
                        <input type="checkbox" checked={onlyWithBeds} onChange={(e) => setOnlyWithBeds(e.target.checked)} />
                        Solo con camas disponibles
                    </label>
                    <span className="hospitals-count" role="status">{visibleInstitutions.length} de {institutions.length}</span>
                </div>

                {!loaded && <SkeletonCards count={3} />}
                <div className="hospitals-grid" hidden={!loaded}>
                    {visibleInstitutions.map((inst) => {
                        const percent = occupancyPercent(inst.available_beds, inst.bed_capacity)
                        const level = occupancyLevel(percent)
                        return (
                            <div key={inst.institution_id} className="hospital-card">
                                <h2 className="hospital-name">{inst.name}</h2>

                                <div className="hospital-beds-row">
                                    <div className="hospital-beds-numbers">
                                        <span className="beds-available"><AnimatedNumber value={inst.available_beds} /></span>
                                        <span className="beds-total">de {inst.bed_capacity} camas libres</span>
                                    </div>
                                    <div className="hospital-progress-bar" role="img" aria-label={`Ocupación ${percent}%`}>
                                        <div className={`hospital-progress-fill fill-${level}`} style={{ width: `${percent}%` }} />
                                    </div>
                                    <span className={`hospital-occupancy occ-${level}`}>
                                        {inst.available_beds > 0 ? `Ocupación ${percent}%` : 'Sin camas disponibles'}
                                    </span>
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

                {loaded && visibleInstitutions.length === 0 && (
                    <p className="hospitals-empty">{institutions.length === 0 ? 'No hay instituciones registradas todavía.' : 'Ninguna institución coincide. Quita un filtro o cambia la búsqueda.'}</p>
                )}
            </div>
        </div>
    )
}

export default Hospitals;