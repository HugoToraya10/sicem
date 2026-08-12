import { jsPDF } from 'jspdf'
import { API_BASE_URL } from '../config/api'

// Reporte formal en PDF (estilo documento que expide una institución de
// salud a través del Sistema SICEM). Todo se genera programáticamente con
// jsPDF — sin plantillas HTML frágiles.
//
// Recibe el paciente del historial y se encarga de juntar el resto de los
// datos desde el backend (emergencia completa, asignación/conductor, y el
// membrete del hospital que expide con su dirección), para que la pantalla
// que lo llama solo tenga que disparar el botón.
//
// IMPORTANTE: comparte EXACTAMENTE el mismo esquema/estructura de datos que el
// reporte de sicem-web (generateEmergencyReport). Ambos envían el MISMO
// contenido — si aquí se agrega/renombra/se quita un campo, hay que replicarlo
// en el otro para que los dos historiales reporten la misma información.
// Workflow:
//   1. Carga el logo de Salud desde public/assets.
//   2. Consulta los endpoints complementarios.
//   3. Dibuja el documento en hoja A4.
//   4. Abre el diálogo de guardado nativo (guarda en el dispositivo).

const fmtDateTime = (v) =>
    v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '—'
const fmtSimple = (v) =>
    v ? new Date(v).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtCoord = (v) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n.toFixed(5) : '—'
}
const fmtDuration = (start, end) => {
    if (!start || !end) return '—'
    const diffMs = new Date(end) - new Date(start)
    if (isNaN(diffMs) || diffMs < 0) return '—'
    const mins = Math.round(diffMs / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h === 0 ? `${m} minutos` : `${h} horas ${m} minutos`
}

const toDataURL = async (url) => {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

const fetchJson = (url, token) =>
    fetch(url, {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    }).then((r) => r.json())

const toLower = (o) => {
    if (!o || typeof o !== 'object') return o
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))
}

// Margen geométrico de A4 en puntos (jsPDF usa pt, 1pt ≈ 0.35 mm).
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2

const GRAY = '#444444'
const DARK = '#000000'
const PANEL = '#5c5e5d'

export const generatePatientReport = async (patient, token) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

    // —— Carga de logo (falla sin romper: una red con logos no tapa un reporte). ——
    let logoDataURL = null
    let logoWidth = 0
    const logoHeight = 46
    try {
        const logoUrl = new URL('assets/SALUD_Logo_(2024).png', window.location.href).href
        logoDataURL = await toDataURL(logoUrl)
        const dims = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
            img.onerror = () => resolve(null)
            img.src = logoDataURL
        })
        logoWidth = dims ? (logoHeight * dims.w) / dims.h : logoHeight
    } catch (e) {
        console.warn('No se pudo cargar el logo de Salud para el reporte. ', e)
    }
    const logoGap = logoDataURL ? logoWidth + 22 : 0

    // —— Recopilar datos complementarios del backend. ——
    let emergency = {}
    let assignment = {}
    let institution = {}
    let city = {}
    let state = {}
    let otherPatients = []
    let instById = {}
    try {
        const [emergencyRes, assignmentsRes, patientsRes] = await Promise.all([
            fetchJson(`${API_BASE_URL}/emergencias/emergencia/${patient.emergency_id}`, token),
            fetchJson(`${API_BASE_URL}/emergencias/asignaciones/${patient.emergency_id}`, token),
            fetchJson(`${API_BASE_URL}/emergencias/pacientes/${patient.emergency_id}`, token),
        ])
        emergency = toLower(emergencyRes?.data?.[0]) || toLower(emergencyRes?.data) || {}
        assignment = ((assignmentsRes?.data || [])[0] && toLower(assignmentsRes.data[0])) || {}

        // Pacientes de la misma emergencia (además de este) para poder mostrar
        // un bloque "Datos del paciente" POR CADA UNO cuando num_patients > 1.
        otherPatients = (patientsRes?.data || [])
            .map(toLower)
            .filter((p) => Number(p.emergency_patient_id) !== Number(patient.emergency_patient_id))

        const instRes = await fetchJson(`${API_BASE_URL}/hospitales/instituciones`, token)
        const instArray = Array.isArray(instRes?.data) ? instRes.data : []
        instById = Object.fromEntries(instArray.map((i) => [String(toLower(i).institution_id), toLower(i)]))
        const rawInst = instArray.map(toLower).find((i) => Number(i.institution_id) === Number(patient.destination_institution_id))
            || instArray.map(toLower)[0]
        institution = rawInst || {}

        if (institution.city_id) {
            const cityRes = await fetchJson(`${API_BASE_URL}/usuarios/ciudad/${institution.city_id}`, token)
            const cityRow = (cityRes?.data || []).map(toLower)[0]
            city = cityRow || {}
            if (city.state_id) {
                const statesRes = await fetchJson(`${API_BASE_URL}/usuarios/estados`, token)
                state = ((statesRes?.data || []).map(toLower).find((s) => Number(s.state_id) === Number(city.state_id))) || {}
            }
        }
    } catch (e) {
        console.warn('No se pudieron completar todos los datos del reporte. ', e)
    }

    // // — datos de la emergencia (objeto común con sicem-web) —
    const em = {
        type_name: emergency.type_name || patient.emergency_type_id,
        triage_level: patient.triage_level,
        triage_color_name: patient.triage_color_name,
        description: emergency.description || patient.description,
        latitude: emergency.latitude ?? patient.emergency_latitude,
        longitude: emergency.longitude ?? patient.emergency_longitude,
        reporter_name: emergency.reporter_name || patient.reporter_name,
        reporter_phone: emergency.reporter_phone || patient.reporter_phone,
        num_patients: emergency.num_patients || patient.num_patients,
        created_at: emergency.created_at || patient.created_at,
        closed_at: emergency.closed_at || patient.closed_at,
        close_reason: emergency.close_reason,
    }

    const fullName = [patient.first_name, patient.first_surname, patient.second_surname].filter(Boolean).join(' ') || 'No identificado'
    const issuingAddress = [institution.street_address, institution.zip_code ? `C.P. ${institution.zip_code}` : null, (city.name ? `${city.name}, ${state.name || ''}` : state.name)]
        .filter(Boolean).join(', ')

    const folio = `SICEM-${String(patient.emergency_patient_id || '').padStart(8, '0')}`
    const issuedAt = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })

    // Normaliza TODO paciente (el de la fila y los demás de la emergencia) al
    // MISMO esquema que usa sicem-web, para dibujar bloques idénticos.
    const toPatientDisplay = (p) => ({
        name: [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado',
        curp: p.curp,
        bloodType: p.blood_type,
        weight: p.weight,
        height: p.height,
        allergies: p.allergies,
        conditions: p.conditions,
        medications: p.medications,
        clinicalNotes: p.clinical_record_notes,
        reception: p.reception_status_name,
        speciality: p.speciality_name,
        destination: p.destination_institution_name
            || (instById[String(p.destination_institution_id)]?.name) || '—',
        unit: p.unit_number,
        createdAt: p.created_at,
        deliveredAt: p.delivered_at,
        dischargedAt: p.discharged_at,
        paramedicConcludedAt: p.paramedic_concluded_at,
    })
    const patients = [toPatientDisplay(patient), ...otherPatients.map(toPatientDisplay)]

    // ───────────────────────── INICIO: dibujo ─────────────────────────
    let y = 0

    // Membrete: logo a la izquierda y bloque de identificación alineado a la
    // DERECHA (desde el nombre del hospital hasta la fecha de emisión).
    const rightX = PAGE_W - MARGIN
    const wrapWidth = Math.max(120, rightX - (MARGIN + logoGap) - 24)
    if (logoDataURL) {
        doc.addImage(logoDataURL, 'PNG', MARGIN, 24, logoWidth, logoHeight, undefined, 'FAST')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(DARK)
    const nameLines = doc.splitTextToSize(institution.name || 'Institución de Salud', wrapWidth)
    let memberY = 40
    doc.text(nameLines, rightX, memberY, { align: 'right' })
    memberY += nameLines.length >= 2 ? 18 : 26
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(GRAY)
    doc.text('Secretaría de Salud · Sistema SICEM', rightX, memberY, { align: 'right' })
    memberY += 16
    let memberBottom = memberY
    if (issuingAddress) {
        const addrLines = doc.splitTextToSize(issuingAddress, wrapWidth)
        doc.text(addrLines, rightX, memberY, { align: 'right' })
        memberBottom = memberY + addrLines.length * 12
    }

    // Folio + fecha de emisión — mismo bloque, también alineado a la derecha.
    const folioY = Math.max(memberBottom + 16, 60)
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(DARK)
    doc.text(`FOLIO: ${folio}`, rightX, folioY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(GRAY)
    doc.text(`Fecha de emisión: ${issuedAt}`, rightX, folioY + 14, { align: 'right' })

    y = 128
    doc.setDrawColor('#c8c8c8')
    doc.line(MARGIN, y, PAGE_W - MARGIN, y)

    // Título central del documento.
    y += 36
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(DARK)
    doc.text('REPORTE DE ATENCIÓN DE EMERGENCIA', PAGE_W / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(GRAY)
    y += 16
    doc.text('Documento expedido mediante el Sistema SICEM', PAGE_W / 2, y, { align: 'center' })

    // ── Secciones ──
    const ensureSpace = (needed = 40) => {
        if (y + needed > PAGE_H - 60) {
            doc.addPage()
            y = 40
        }
    }
    const sectionTitle = (text) => {
        ensureSpace(60)
        y += 20
        doc.setFillColor(PANEL)
        doc.rect(MARGIN, y, CONTENT_W, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.setTextColor('white')
        doc.text(text, MARGIN + 14, y + 14)
        y += 26
    }
    const kvBlock = (label, value) => {
        const text = value === undefined || value === null || value === '' ? '—' : String(value)
        const valueX = MARGIN + 190
        const lines = doc.splitTextToSize(text, CONTENT_W - valueX + MARGIN - 10)
        ensureSpace(lines.length * 13 + 2)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(GRAY)
        doc.text(label, MARGIN, y + 8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#111111')
        doc.text(lines, valueX, y + 8)
        y += lines.length * 13 + 2
    }
    const row = (left, right) => {
        ensureSpace(22)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(GRAY)
        doc.text(left, MARGIN, y + 8)
        doc.setTextColor('#111111')
        doc.text(right, PAGE_W - MARGIN, y + 8, { align: 'right' })
        y += 18
    }

    // ─────────── Secciones — MISMO esquema que sicem-web ───────────

    // 1) Datos de la emergencia
    sectionTitle('I. DATOS DE LA EMERGENCIA')
    kvBlock('Tipo de emergencia', em.type_name)
    kvBlock('Nivel de triage', em.triage_level ? `Triage ${em.triage_level} (${em.triage_color_name || ''})` : '—')
    kvBlock('Descripción', em.description)
    kvBlock('Coordenadas de ubicación', `Latitud ${fmtCoord(em.latitude)}, Longitud ${fmtCoord(em.longitude)}`)
    kvBlock('Reportante', em.reporter_name)
    kvBlock('Tel. del reportante', em.reporter_phone)
    kvBlock('Nº de pacientes', em.num_patients)
    kvBlock('Fecha de registro', fmtSimple(em.created_at))

    // 2) Datos de los pacientes — un bloque POR CADA UNO.
    sectionTitle(patients.length > 1 ? 'II. DATOS DE LOS PACIENTES' : 'II. DATO DEL PACIENTE')
    if (patients.length === 0) {
        kvBlock('Pacientes', 'Sin pacientes registrados en esta emergencia.')
    } else {
        patients.forEach((pd, i) => {
            if (patients.length > 1) {
                ensureSpace(20)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(10)
                doc.setTextColor(DARK)
                doc.text(`Paciente ${i + 1} de ${patients.length} — ${pd.name}`, MARGIN, y + 10)
                y += 16
            }
            kvBlock('Nombre completo', pd.name)
            kvBlock('CURP', pd.curp)
            kvBlock('Tipo de sangre', pd.bloodType)
            kvBlock('Peso / Talla', `${pd.weight ? `${pd.weight} kg` : '—'} / ${pd.height ? `${pd.height} m` : '—'}`)
            kvBlock('Alergias', pd.allergies)
            kvBlock('Padecimientos', pd.conditions)
            kvBlock('Medicamentos', pd.medications)
            kvBlock('Notas del expediente', pd.clinicalNotes)
            kvBlock('Estado de recepción', pd.reception)
            kvBlock('Especialidad de destino', pd.speciality)
            kvBlock('Institución de destino', pd.destination)
            kvBlock('Unidad asignada', pd.unit)
            kvBlock('Fecha de registro', fmtSimple(pd.createdAt))
            kvBlock('Fecha de llegada', fmtDateTime(pd.deliveredAt))
            kvBlock('Fecha de alta médica', fmtDateTime(pd.dischargedAt))
            kvBlock('Traslado concluido (parámedico)', fmtDateTime(pd.paramedicConcludedAt))
        })
    }

    // 3) Resolución de la emergencia
    sectionTitle('III. RESOLUCIÓN DE LA EMERGENCIA')
    kvBlock('Estado de resolución',
        em.closed_at ? (em.close_reason ? 'Cerrada sin resolver' : 'Resuelta') : 'Pendiente')
    kvBlock('Motivo / observaciones', em.close_reason)
    kvBlock('Duración', fmtDuration(em.created_at, em.closed_at))
    kvBlock('Fecha de cierre', fmtDateTime(em.closed_at))

    // 4) Personal y traslado
    sectionTitle('IV. PERSONAL Y TRASLADO')
    kvBlock('Despachador de la asignación',
        `${[assignment.assigned_by_first_name, assignment.assigned_by_first_surname].filter(Boolean).join(' ') || '—'}`)
    kvBlock('Paramédico / conductor',
        `${[assignment.driver_first_name, assignment.driver_first_surname].filter(Boolean).join(' ') || '—'}`)
    kvBlock('Placa de la unidad', assignment.license_plate)

    // 5) Seguimiento (línea de tiempo)
    sectionTitle('V. SEGUIMIENTO')
    row('Registro de la emergencia', fmtSimple(em.created_at))
    row('Cierre de la emergencia', fmtSimple(em.closed_at))

    // ── Nota de estado: si la emergencia aún NO ha terminado, se aclara de
    // forma explícita (no tiene sentido entregar un "reporte de atención" sin
    // decir que el caso sigue en curso). ──
    if (!em.closed_at) {
        ensureSpace(40)
        y += 8
        const noteBody = 'La emergencia asociada a este reporte aún se encuentra en curso y todavía no ha sido cerrada. Los datos de seguimiento registrados hasta este momento son los que obran en el presente documento.'
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor('#111111')
        const labelW = doc.getTextWidth('NOTA: ')
        const bodyLines = doc.splitTextToSize(noteBody, CONTENT_W - labelW - 34)
        const boxH = bodyLines.length * 12 + 18
        doc.setFillColor('#e8e8e8')
        doc.setDrawColor('#9e9e9e')
        doc.rect(MARGIN, y, CONTENT_W, boxH, 'FD')
        const ty = y + 14
        doc.text('NOTA: ', MARGIN + 12, ty)
        doc.text(bodyLines, MARGIN + 12 + labelW, ty)
        y += boxH + 8
    }

    // ── Constancia formal (pie de página) ──
    const footerY = PAGE_H - 76
    doc.setDrawColor('#c8c8c8')
    doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(GRAY)
    const statement = doc.splitTextToSize(
        `La presente constancia se expide con base en la información y los registros contenidos en el Sistema SICEM de atención prehospitalaria y de enlace hospitalario, mismos que se encuentran a disposición de las autoridades competentes para los efectos legales a que haya lugar. Este documento posee únicamente carácter informativo y no sustituye los certificados, dictámenes ni demás documentos oficiales emitidos por las instituciones que conforman el sistema nacional de salud.`,
        CONTENT_W - 20
    )
    doc.text(statement, PAGE_W / 2, footerY + 16, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.text(
        `Emitido por ${institution.name || 'la institución'} mediante el Sistema SICEM · ${issuedAt} · Folio ${folio}`,
        PAGE_W / 2, footerY + 16 + statement.length * 11 + 12, { align: 'center' }
    )

    // El archivo se nombra con el FOLIO (identificador único del reporte), no con
    // el nombre del paciente — así es consistente y auditable.
    doc.save(`Reporte_${folio}.pdf`)
}

export default generatePatientReport