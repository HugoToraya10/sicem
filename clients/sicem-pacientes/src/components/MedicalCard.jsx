import { age } from '../utils/dates'

const num = (v) => { const n = Number(v); return Number.isNaN(n) ? v : String(n) }

// Lo que verá el personal de emergencias. Lo crítico (sangre y alergias) arriba y grande.
const MedicalCard = ({ summary, institutionName, onNavigate, compact = false }) => {
  if (!summary) return <div className="medcard" aria-busy="true"><p className="empty">Cargando tu tarjeta médica…</p></div>
  const { name, birthDate, bloodType, allergies, conditions, medications, hasRecord, weight, height, emergencyContact, emergencyPhone, phone } = summary
  const years = age(birthDate)
  const heightText = height ? (Number(height) < 3 ? `${num(height)} m` : `${num(height)} cm`) : null

  return (
    <section className={`medcard${compact ? ' compact' : ''}`} aria-label="Tarjeta médica">
      <header className="medcard-head">
        <div>
          <p className="medcard-eyebrow">Tarjeta médica</p>
          <h2 className="medcard-name">{name || 'Tu perfil'}</h2>
          <p className="medcard-sub">{[years !== null ? `${years} años` : null, institutionName].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={`medcard-blood${bloodType ? '' : ' empty'}`} aria-label={bloodType ? `Tipo de sangre ${bloodType}` : 'Tipo de sangre sin registrar'}>
          <span>Sangre</span>
          <b>{bloodType || '—'}</b>
        </div>
      </header>

      {!hasRecord && (
        <div className="notice notice-info">
          Aún no tienes expediente clínico.{' '}
          <button type="button" className="btn-inline" onClick={() => onNavigate('general')}>Créalo ahora</button> para que el personal médico conozca tu sangre, alergias y medicamentos.
        </div>
      )}

      <div className={`medcard-block${allergies.length ? ' alert' : ''}`}>
        <h3>Alergias</h3>
        {allergies.length === 0
          ? <p className="medcard-none">Sin alergias registradas. <button type="button" className="btn-inline" onClick={() => onNavigate('allergies')}>Agregar</button></p>
          : <ul className="medcard-tags">{allergies.map((a) => <li key={a.patient_allergy_id} className="tag tag-bad">{a.name}{a.severity ? ` · ${a.severity}` : ''}</li>)}</ul>}
      </div>

      <div className="medcard-cols">
        <div className="medcard-block">
          <h3>Condiciones</h3>
          {conditions.length === 0
            ? <p className="medcard-none">Ninguna registrada.</p>
            : <ul className="medcard-tags">{conditions.map((c) => <li key={c.patient_condition_id} className="tag tag-warn">{c.name}</li>)}</ul>}
        </div>
        <div className="medcard-block">
          <h3>Medicamentos</h3>
          {medications.length === 0
            ? <p className="medcard-none">Ninguno registrado.</p>
            : <ul className="medcard-list">{medications.map((m) => <li key={m.patient_medication_id}><b>{m.name}</b>{[m.dosage, m.frequency].filter(Boolean).length ? <span> {[m.dosage, m.frequency].filter(Boolean).join(' · ')}</span> : null}</li>)}</ul>}
        </div>
      </div>

      <dl className="medcard-facts">
        <div><dt>Peso</dt><dd>{weight ? `${num(weight)} kg` : '—'}</dd></div>
        <div><dt>Estatura</dt><dd>{heightText || '—'}</dd></div>
        <div><dt>Mi teléfono</dt><dd>{phone || '—'}</dd></div>
        <div><dt>Contacto de emergencia</dt><dd>{emergencyContact ? `${emergencyContact}${emergencyPhone ? ` · ${emergencyPhone}` : ''}` : <button type="button" className="btn-inline" onClick={() => onNavigate('datos')}>Agregar</button>}</dd></div>
      </dl>
    </section>
  )
}

export default MedicalCard
