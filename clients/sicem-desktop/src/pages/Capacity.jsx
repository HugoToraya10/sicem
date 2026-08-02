import { useState, useEffect } from 'react'
import SpecialtyCapacityCard from '../components/capacity/SpecialtyCapacityCard'
import BedMatrixModal from '../components/capacity/BedMatrixModal'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import './Capacity.css'

const Capacity = () => {
    const { user, token } = useAuth()
    const [specialties, setSpecialties] = useState([])
    const [generalBeds, setGeneralBeds] = useState(null)
    const [generalBedsModalOpen, setGeneralBedsModalOpen] = useState(false)
    const [savingGeneralBeds, setSavingGeneralBeds] = useState(false)

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

    // Camas generales del hospital (capacidad total, independiente de la
    // capacidad por especialidad de abajo) — cualquier rol 4 puede verlas y
    // ajustar las DISPONIBLES desde aquí (ver handleSaveGeneralBeds). La
    // capacidad TOTAL sigue siendo exclusiva de is_institution_admin, desde
    // Administración de mi Hospital.
    useEffect(() => {
        fetch('http://localhost:3000/hospitales/instituciones', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => {
                const mine = (data || []).map(i => toLowerCaseKeys(i)).find(i => parseInt(i.institution_id) === parseInt(user.institutionId))
                setGeneralBeds(mine || null)
            })
            .catch(error => console.error('Error recuperando camas generales del hospital. ', error))
    }, [user, token])

    // Camas generales disponibles — cualquier rol 4 puede ajustarlas (ver
    // controllers/hospital.js updateAvailableBedsI), pensado para cuando llega
    // un paciente que no pasó por el flujo normal del CRUM (no hay emergencia
    // registrada en SICEM que descuente la cama sola) y hay que reflejarlo a mano.
    const handleConfirmGeneralBeds = (newAvailable) => {
        setSavingGeneralBeds(true)
        fetch('http://localhost:3000/hospitales/actualizar-camas-institucion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId: user.institutionId, availableBeds: newAvailable })
        })
            .then(res => {
                if (!res.ok) throw new Error('No se pudo actualizar')
                return res.json()
            })
            .then(() => {
                setGeneralBeds((current) => ({ ...current, available_beds: newAvailable }))
                setGeneralBedsModalOpen(false)
            })
            .catch(error => {
                console.error('Error actualizando camas generales disponibles. ', error)
                alert('No se pudo actualizar. Intenta de nuevo.')
            })
            .finally(() => setSavingGeneralBeds(false))
    }

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
            {generalBeds && (
                <div className="general-beds-card">
                    <span className="general-beds-label">Camas generales del hospital</span>
                    <span className="general-beds-numbers">
                        <strong>{generalBeds.available_beds}</strong> / {generalBeds.bed_capacity} disponibles
                    </span>
                    <button className="update-btn general-beds-update-btn" onClick={() => setGeneralBedsModalOpen(true)}>
                        Gestionar camas
                    </button>
                    <span className="general-beds-hint">Ajusta esto si llega un paciente que no pasó por una emergencia registrada en SICEM (p. ej. no enviado por el CRUM) — la capacidad TOTAL solo la edita un administrador, desde Administración.</span>

                    {generalBedsModalOpen && (
                        <BedMatrixModal
                            title="Camas Generales del Hospital"
                            totalBeds={generalBeds.bed_capacity}
                            availableBeds={generalBeds.available_beds}
                            saving={savingGeneralBeds}
                            onConfirm={handleConfirmGeneralBeds}
                            onClose={() => setGeneralBedsModalOpen(false)}
                        />
                    )}
                </div>
            )}

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