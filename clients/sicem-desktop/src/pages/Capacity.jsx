import { useState, useEffect } from 'react'
import SpecialtyCapacityCard from '../components/capacity/SpecialtyCapacityCard'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import './Capacity.css'

const Capacity = () => {
    const { user, token } = useAuth()
    const [specialties, setSpecialties] = useState([])

    useEffect(() => {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

        Promise.all([
            fetch('http://localhost:3000/hospitales/especialidades-instituciones', { headers }).then(res => res.json()),
            fetch('http://localhost:3000/hospitales/especialidades', { headers }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                const myRows = institutionSpecialtiesRes.data
                    .map(row => toLowerCaseKeys(row))
                    .filter(row => parseInt(row.institution_id) === parseInt(user.institutionId) && row.is_active)

                const catalog = catalogRes.data.map(s => toLowerCaseKeys(s))

                const merged = myRows.map(row => ({
                    ...row,
                    name: catalog.find(s => s.speciality_id === row.speciality_id)?.name || 'Especialidad'
                }))

                setSpecialties(merged)
            })
            .catch(error => console.error('Error recuperando capacidad por especialidad. ', error))
    }, [user, token])

    const handleUpdate = (institutionSpecialityId, availableBeds) => {
        return fetch('http://localhost:3000/hospitales/actualizar-camas-especialidad', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionSpecialityId, availableBeds })
        })
            .then(res => {
                if (!res.ok) throw new Error('No se pudo actualizar')
                return res.json()
            })
            .then(() => {
                setSpecialties((current) => current.map((s) =>
                    s.institution_speciality_id === institutionSpecialityId
                        ? { ...s, available_beds: availableBeds }
                        : s
                ))
            })
            .catch(error => {
                console.error('Error actualizando camas disponibles. ', error)
                alert('No se pudo actualizar la disponibilidad. Intenta de nuevo.')
            })
    }

    return (
        <div className="capacity-layout">
            <div className="section-title">Capacidad por Especialidad</div>
            <div className="capacity-grid">
                {specialties.map((s) => (
                    <SpecialtyCapacityCard key={s.institution_speciality_id} specialty={s} onUpdate={handleUpdate} />
                ))}
                {specialties.length === 0 && (
                    <p className="empty-state">Sin especialidades registradas para tu institución.</p>
                )}
            </div>
        </div>
    )
}

export default Capacity