import { useState, useEffect } from 'react'
import SpecialtyCapacityCard from '../components/capacity/SpecialtyCapacityCard'
import BedMatrixModal from '../components/capacity/BedMatrixModal'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { useDialogs } from '../context/useDialogs'
import './Capacity.css'
import AnimatedNumber from '../components/ui/AnimatedNumber'

const Capacity = () => {
    const { user, token } = useAuth()
    const { notify } = useDialogs()
    const [specialties, setSpecialties] = useState([])
    const [generalBeds, setGeneralBeds] = useState(null)
    const [generalBedsModalOpen, setGeneralBedsModalOpen] = useState(false)
    const [savingGeneralBeds, setSavingGeneralBeds] = useState(false)

    useEffect(() => {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/hospitales/especialidades`, { headers }).then(res => res.json()),
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
        fetch(`${API_BASE_URL}/hospitales/instituciones`, {
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
        fetch(`${API_BASE_URL}/hospitales/actualizar-camas-institucion`, {
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
                notify('Camas generales actualizadas.', 'ok')
            })
            .catch(error => {
                console.error('Error actualizando camas generales disponibles. ', error)
                notify('No se pudo actualizar. Intenta de nuevo.', 'error')
            })
            .finally(() => setSavingGeneralBeds(false))
    }

    const handleUpdate = (institutionSpecialityId, availableBeds) => {
        return fetch(`${API_BASE_URL}/hospitales/actualizar-camas-especialidad`, {
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
                notify('Disponibilidad actualizada.', 'ok')
            })
            .catch(error => {
                console.error('Error actualizando camas disponibles. ', error)
                notify('No se pudo actualizar la disponibilidad. Intenta de nuevo.', 'error')
            })
    }

    const totalFree = specialties.reduce((sum, x) => sum + (Number(x.available_beds) || 0), 0)

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Capacidad</h1>
                    <p className="page-sub">Mantén al día las camas libres: el despachador decide a dónde enviar pacientes con estos números.</p>
                </div>
                <ul className="stat-row" aria-label="Resumen">
                    {generalBeds && <li><b><AnimatedNumber value={generalBeds.available_beds} /></b><span>de {generalBeds.bed_capacity} camas generales</span></li>}
                    <li><b><AnimatedNumber value={totalFree} /></b><span>libres en especialidades</span></li>
                </ul>
            </div>

            {generalBeds && (
                <section className="general-beds-card" aria-labelledby="gb-title">
                    <div>
                        <h2 id="gb-title" className="general-beds-label">Camas generales del hospital</h2>
                        <p className="general-beds-hint">Ajusta esto si llega un paciente que no pasó por una emergencia registrada en SICEM (por ejemplo, uno que el CRUM no envió). La capacidad total solo la edita un administrador, en Administración.</p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => setGeneralBedsModalOpen(true)}>Gestionar camas</button>

                    {generalBedsModalOpen && (
                        <BedMatrixModal
                            title="Camas generales del hospital"
                            totalBeds={generalBeds.bed_capacity}
                            availableBeds={generalBeds.available_beds}
                            saving={savingGeneralBeds}
                            onConfirm={handleConfirmGeneralBeds}
                            onClose={() => setGeneralBedsModalOpen(false)}
                        />
                    )}
                </section>
            )}

            <h2 className="capacity-heading">Por especialidad</h2>
            <div className="capacity-grid">
                {specialties.map((s) => (
                    <SpecialtyCapacityCard key={s.institution_speciality_id} specialty={s} onUpdate={handleUpdate} />
                ))}
                {specialties.length === 0 && (
                    <p className="empty">Tu institución no tiene especialidades activas. Un administrador puede agregarlas en Administración.</p>
                )}
            </div>
        </div>
    )
}

export default Capacity
