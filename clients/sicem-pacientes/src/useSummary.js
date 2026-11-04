import { useCallback, useEffect, useState } from 'react'
import { toLowerCaseKeys } from './utils/formatData'

// Todo lo que el personal médico vería de este paciente en una emergencia: una sola carga, reutilizada por
// la "tarjeta médica" (resumen) y la columna lateral de pantallas anchas.
export const useSummary = (call, profileId, hasEce, refreshKey) => {
  const [summary, setSummary] = useState(null)

  const load = useCallback(async () => {
    if (!profileId) return
    const [profile, ece, blood, al, co, me] = await Promise.all([
      call(`/usuarios/obtener-usuario-id/${profileId}`),
      call(`/pacientes/ece/${profileId}`),
      call('/pacientes/tipos-sangre'),
      hasEce ? call('/pacientes/alergias/0') : Promise.resolve({ data: {} }),
      hasEce ? call('/pacientes/condiciones/0') : Promise.resolve({ data: {} }),
      hasEce ? call('/pacientes/medicamentos/0') : Promise.resolve({ data: {} }),
    ])
    const u = profile.data.user?.[0] || {}
    const rec = ece.data.clinicalRecord?.[0] ? toLowerCaseKeys(ece.data.clinicalRecord[0]) : null
    const bloodTypes = (blood.data.bloodTypes || []).map(toLowerCaseKeys)
    const active = (list) => (list || []).map(toLowerCaseKeys).filter((x) => x.is_active)
    setSummary({
      name: [u.first_name, u.first_surname, u.second_surname].filter(Boolean).join(' '),
      birthDate: u.birth_date,
      phone: u.phone_number,
      emergencyContact: u.emergency_contact,
      emergencyPhone: u.emergency_phone,
      institutionId: u.institution_id,
      bloodType: rec ? bloodTypes.find((b) => String(b.blood_type_id) === String(rec.blood_type_id))?.blood_type : null,
      weight: rec?.weight,
      height: rec?.height,
      hasRecord: Boolean(rec),
      allergies: active(al.data.allergies),
      conditions: active(co.data.conditions),
      medications: active(me.data.medications),
    })
  }, [call, profileId, hasEce])

  useEffect(() => { load() }, [load, refreshKey])
  return { summary, reload: load }
}
