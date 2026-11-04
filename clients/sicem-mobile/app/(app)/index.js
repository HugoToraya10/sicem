import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Linking, ScrollView } from 'react-native'
import { Alert } from '../../utils/alert'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors, contentColumn } from '../../constants/theme'
import { Button, Chip, StepTracker, TriageBadge, Radar } from '../../components/ui'

const WEEKDAY_LABELS = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }

// shiftWindows es un arreglo de { day, start, end } — un rango de hora POR
// día (mismo criterio que el backend en isWithinSchedule), para cubrir
// horarios rotativos donde no todos los días se trabaja igual. Sin arreglo
// (o vacío) = SIN ACCESO — el backend rechaza iniciar-turno hasta que un
// admin le asigne al menos un día.
const formatSchedule = (user) => {
    const windows = user?.shiftWindows
    if (!windows || !windows.length) {
        return 'Todavía no tienes un horario de trabajo asignado — pide a tu institución que te asigne uno antes de poder iniciar turno.'
    }
    // Se agrupan los días que comparten el mismo rango para no repetirlo siete veces.
    const byRange = new Map()
    ;[...windows].sort((x, y) => x.day - y.day).forEach((w) => {
        const key = `${w.start}-${w.end}`
        byRange.set(key, [...(byRange.get(key) || []), parseInt(w.day)])
    })
    const parts = [...byRange.entries()].map(([range, days]) =>
        `${days.length === 7 ? 'Todos los días' : days.map((d) => WEEKDAY_LABELS[d]).join(', ')} ${range}`)
    return 'Tu horario: ' + parts.join(' · ')
}

// scheduledEnd es cuándo termina la VENTANA de horario de hoy — no incluye
// los minutos de gracia (STALE_GRACE_MINUTES, solo vive en el backend) a
// propósito: mostrarle al paramédico "tienes minutos extra" invitaría a
// usarlos como parte normal del turno, cuando son solo un margen para
// terminar de cerrar cosas.
const formatCountdown = (scheduledEndIso) => {
    if (!scheduledEndIso) return null
    const diffMs = new Date(scheduledEndIso).getTime() - Date.now()
    if (diffMs <= 0) return 'Tu turno está por terminar'
    const totalMinutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) return `Termina en ${hours}h ${minutes}min`
    return `Termina en ${minutes} min`
}

const ConnectionBadge = ({ connected }) => (
    <View style={styles.connectionBadge}>
        <View style={[styles.connectionDot, { backgroundColor: connected ? '#2E7D32' : '#C21F2D' }]} />
        <Text style={styles.connectionText}>{connected ? 'Conectado' : 'Sin conexión'}</Text>
    </View>
)

// Antes, si el paramédico rechazaba (o alguna vez le desactivaron) el
// permiso de notificaciones, registerForPushNotificationsAsync solo lo
// avisaba con un console.warn — invisible para él. Con la app cerrada o en
// segundo plano, el socket no funciona (ver eventEmergencyAssignedToMe en
// SocketContext.jsx), así que sin push es la ÚNICA forma de enterarse de una
// emergencia nueva.
//
// BUG REAL corregido: el comentario original decía "se revisa cada vez que
// la pestaña Alerta vuelve a montarse", pero un useEffect con [] solo corre
// UNA vez por sesión — las pestañas de expo-router se quedan MONTADAS al
// cambiar entre ellas (mismo patrón documentado en paciente.js/mapa.js), así
// que si el paramédico activaba el permiso desde Ajustes a medio uso, el
// banner se quedaba pegado hasta reiniciar la app entera. useFocusEffect sí
// vuelve a correr cada vez que la pestaña Alerta recupera el foco.
const PushPermissionWarning = () => {
    const [denied, setDenied] = useState(false)

    useFocusEffect(useCallback(() => {
        Notifications.getPermissionsAsync()
            .then(({ status }) => setDenied(status !== 'granted'))
            .catch(() => {})
    }, []))

    if (!denied) return null
    return (
        <TouchableOpacity style={styles.pushWarningBanner} onPress={() => Linking.openSettings()}>
            <Ionicons name="notifications-off-outline" size={16} color="#8F5A00" />
            <Text style={styles.pushWarningText}>
                Sin permiso de notificaciones — puedes perderte emergencias con la app cerrada. Toca para activarlo.
            </Text>
        </TouchableOpacity>
    )
}

const Header = ({ user, connected, onLogout, onPressProfile }) => (
    <View>
        <View style={styles.header}>
            <TouchableOpacity style={styles.headerLeft} onPress={onPressProfile}>
                <Ionicons name="person-circle" size={30} color="#2E7D32" />
                <Text style={styles.welcome}>Hola, {user?.firstName || 'Paramédico'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout}><Text style={styles.logout}>Cerrar sesión</Text></TouchableOpacity>
        </View>
        <ConnectionBadge connected={connected} />
        <PushPermissionWarning />
    </View>
)

// Botón + modal de "reportar falla" — se repite en más de un estado de la
// pantalla (en curso / esperando asignación), así que vive aparte en vez de
// duplicar el JSX. Deliberadamente NO aparece en el estado de alerta
// pendiente (pantalla completa, sin distracciones — ver más abajo) ni antes
// de iniciar turno (no hay unidad que reportar todavía).
const FailureReportSection = ({ visible, onOpen, onClose, note, onChangeNote, onSubmit, submitting }) => (
    <>
        <TouchableOpacity style={styles.failureButton} onPress={onOpen}>
            <Ionicons name="warning-outline" size={16} color="#8F5A00" />
            <Text style={styles.failureButtonText}>Reportar falla en la unidad</Text>
        </TouchableOpacity>

        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalBox}>
                    <Text style={styles.modalTitle}>Reportar falla en la unidad</Text>
                    <Text style={styles.modalHint}>
                        Esto solo avisa a tu despachador/hospital — ellos deciden si te reasignan o sacan la unidad de servicio.
                    </Text>
                    <TextInput
                        style={styles.modalInput}
                        placeholder="¿Qué le pasó a la unidad?"
                        value={note}
                        onChangeText={onChangeNote}
                        multiline
                        maxLength={300}
                        autoFocus
                    />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} disabled={submitting}>
                            <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalSubmitButton, !note.trim() && styles.modalSubmitButtonDisabled]}
                            onPress={onSubmit}
                            disabled={submitting || !note.trim()}
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitButtonText}>Enviar</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    </>
)

const PHASES = ['En camino', 'En escena', 'Traslado', 'Entregado']
const phaseOf = (ambulanceStatusId) => (parseInt(ambulanceStatusId) === 3 ? 1 : parseInt(ambulanceStatusId) === 4 ? 2 : 0)

// Datos del caso: quién llamó (con teléfono que se puede tocar para marcar), cuántos pacientes y qué urgencia
const CaseSummary = ({ em }) => (
    <View style={styles.caseCard}>
        <View style={styles.caseTitleRow}>
            <Text style={styles.caseType} numberOfLines={2}>{em?.type_name || 'Emergencia'}</Text>
            {em?.triage_level ? <TriageBadge level={em.triage_level} /> : null}
        </View>
        {em?.description ? <Text style={styles.caseDesc}>{em.description}</Text> : null}
        {em?.reporter_name ? (
            <View style={styles.caseMetaRow}>
                <Ionicons name="person-outline" size={18} color={colors.text2} />
                <Text style={styles.caseMeta} numberOfLines={1}>{em.reporter_name}</Text>
                {em.reporter_phone ? (
                    <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${em.reporter_phone}`)} accessibilityRole="button" accessibilityLabel={`Llamar a ${em.reporter_name}`}>
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.callBtnText}>{em.reporter_phone}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        ) : null}
        {em?.num_patients ? <Text style={styles.caseMeta}>Pacientes reportados: {em.num_patients}</Text> : null}
    </View>
)

// Centro de la atención: pacientes de la emergencia con accesos directos a su nota y su expediente
const PatientsPanel = ({ emergencyId, activeAmbulanceId, token }) => {
    const router = useRouter()
    const { patientListVersion } = useSocketAlerts()
    const [patients, setPatients] = useState(null)

    const load = useCallback(() => {
        if (!emergencyId) return
        fetch(`${API_BASE_URL}/emergencias/pacientes/${emergencyId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then(({ data }) => setPatients((data || []).map(toLowerCaseKeys)))
            .catch(() => setPatients((prev) => prev || []))
    }, [emergencyId, token])

    useEffect(() => { load() }, [load, patientListVersion])
    useFocusEffect(useCallback(() => { load() }, [load]))

    const openExpediente = (p) => router.push({
        pathname: '/expediente',
        params: { userProfileId: p.user_profile_id, firstName: p.first_name || '', firstSurname: p.first_surname || '', secondSurname: p.second_surname || '', emergencyPatientId: p.emergency_patient_id || '', curp: p.curp || '' },
    })
    const openNota = (p) => router.push({
        pathname: '/notas',
        params: { emergencyPatientId: p.emergency_patient_id, firstName: p.first_name || '', firstSurname: p.first_surname || '', secondSurname: p.second_surname || '' },
    })

    return (
        <View>
            <Text style={styles.panelTitle}>Pacientes</Text>
            {patients === null && <ActivityIndicator color={colors.steel} style={{ marginVertical: 12 }} />}
            {patients && patients.length === 0 && (
                <Text style={styles.panelEmpty}>Todavía no hay pacientes registrados en esta emergencia.</Text>
            )}
            {(patients || []).map((p) => {
                const mine = String(p.ambulance_id) === String(activeAmbulanceId)
                const name = p.first_name ? `${p.first_name} ${p.first_surname || ''}`.trim() : 'Paciente no identificado'
                return (
                    <View key={p.emergency_patient_id} style={styles.patientCard}>
                        <View style={styles.patientHead}>
                            <Text style={styles.patientName} numberOfLines={1}>{name}</Text>
                            {mine ? <Chip label="Tu unidad" tone="steel" /> : null}
                        </View>
                        <Text style={styles.patientMeta}>
                            {p.blood_type ? `Sangre ${p.blood_type} · ` : ''}{p.destination_institution_name ? `Destino: ${p.destination_institution_name}` : 'Sin hospital destino'}
                        </Text>
                        {p.reception_status_name ? <Text style={styles.patientMeta}>Hospital: {p.reception_status_name}</Text> : null}
                        <View style={styles.patientActions}>
                            <Button label="Nota" tone="neutral" style={styles.patientBtn} onPress={() => openNota(p)} />
                            <Button label="Expediente" tone="neutral" style={styles.patientBtn} onPress={() => openExpediente(p)} />
                        </View>
                    </View>
                )
            })}
            <Button
                label="Registrar paciente"
                tone="neutral"
                icon={<Ionicons name="add-circle-outline" size={22} color={colors.text} />}
                style={{ marginTop: 6 }}
                onPress={() => router.push({ pathname: '/registrar-paciente', params: { emergencyId } })}
            />
        </View>
    )
}

const AlertaScreen = () => {
    const { user, token, logout } = useAuth()
    const { activeAmbulanceId, unitNumber, scheduledEnd, ambulanceStatusId, loading: shiftLoading, busy, startShift, endShift } = useAmbulance()
    const [makingAvailable, setMakingAvailable] = useState(false)
    // 5 = Fuera de servicio (por una falla reportada, o porque el hospital la
    // sacó de servicio directo). Solo el propio paramédico puede regresarla a
    // Disponible — ver PARAMEDIC_FORWARD_TRANSITIONS en services/unidades.
    const handleMakeAvailable = () => {
        setMakingAvailable(true)
        fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId: activeAmbulanceId, ambulanceStatusId: 1 }),
        })
            .then((res) => res.json().then((body) => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar.') }))
            .catch((err) => Alert.alert('Error', err.message))
            .finally(() => setMakingAvailable(false))
    }
    const { pendingAlert, acceptedEmergency, acknowledgeAlert, connected } = useSocketAlerts()
    const router = useRouter()
    const [shiftError, setShiftError] = useState(null)
    const [failureModalVisible, setFailureModalVisible] = useState(false)
    const [failureNote, setFailureNote] = useState('')
    const [submittingFailure, setSubmittingFailure] = useState(false)

    // Solo NOTIFICA a tu despachador/hospital (socket, sin cambiar nada del
    // estado de la unidad por su cuenta) — quien decide qué hacer con la
    // unidad (reasignar, sacarla de servicio, etc.) es tu CRUM/hospital, no
    // tú. Ver fundamentos-legales/autoridad-crum-sobre-tamp-paramedico.txt.
    const submitFailureReport = () => {
        if (!failureNote.trim()) return
        setSubmittingFailure(true)
        fetch(`${API_BASE_URL}/unidades/reportar-falla`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ note: failureNote.trim() })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo enviar el reporte.')
            }))
            .then(() => {
                setFailureModalVisible(false)
                setFailureNote('')
                Alert.alert('Reporte enviado', 'Tu despachador/hospital ya fue notificado.')
            })
            .catch((err) => {
                console.error('Error reportando falla. ', err)
                Alert.alert('Error', err.message)
            })
            .finally(() => setSubmittingFailure(false))
    }

    // Fuerza un re-render cada 30s para que el contador de turno avance solo
    // sin que el paramédico tenga que tocar nada.
    const [, forceTick] = useState(0)
    useEffect(() => {
        const interval = setInterval(() => forceTick((t) => t + 1), 30000)
        return () => clearInterval(interval)
    }, [])

    const handleStartShift = () => {
        setShiftError(null)
        startShift(user.assignedAmbulanceId).catch((err) => {
            console.error('Error iniciando turno. ', err)
            setShiftError(err.message)
        })
    }

    // Que no se pueda arrancar un turno (empieza a reportar ubicación y a
    // recibir emergencias) por un toque accidental.
    const handleStartShiftPress = () => {
        Alert.alert(
            'Iniciar turno',
            'A partir de este momento se reportará tu ubicación y podrás recibir emergencias asignadas a tu unidad. ¿Confirmas que quieres iniciar tu turno?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Iniciar turno', onPress: handleStartShift },
            ]
        )
    }

    const handleEndShift = () => {
        endShift().catch((err) => {
            console.error('Error terminando turno. ', err)
            Alert.alert('Error', err.message)
        })
    }

    // Mismo criterio que iniciar turno — terminarlo por accidente significa
    // dejar de recibir emergencias sin darte cuenta.
    const handleEndShiftPress = () => {
        Alert.alert(
            'Terminar turno',
            `¿Confirmas que quieres terminar tu turno${unitNumber ? ` en la unidad ${unitNumber}` : ''}? Dejarás de recibir emergencias hasta que inicies uno nuevo.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Terminar turno', style: 'destructive', onPress: handleEndShift },
            ]
        )
    }

    // Si hay turno activo, hay que terminarlo ANTES de cerrar sesión — si no,
    // la unidad se queda marcada como "Disponible" en el mapa del despachador
    // aunque ya nadie la esté manejando. await explícito (en vez de encadenar
    // .then/.finally) para que quede clarísimo que esperamos a que el PATCH
    // de terminar-turno de verdad termine antes de borrar el token — no se
    // bloquea el logout si esto falla (el backend igual limpia turnos
    // abandonados tras unas horas), pero si tiene tiempo de completarse, se
    // completa antes de cerrar sesión.
    const doLogout = async () => {
        if (activeAmbulanceId) {
            try {
                await endShift()
            } catch (err) {
                console.error('Error terminando turno al cerrar sesión. ', err)
            }
        }
        await logout()
    }

    const handleLogoutPress = () => {
        Alert.alert(
            'Cerrar sesión',
            activeAmbulanceId ? 'Tienes un turno activo — se terminará automáticamente al cerrar sesión. ¿Confirmas?' : '¿Confirmas que quieres cerrar sesión?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cerrar sesión', style: 'destructive', onPress: doLogout },
            ]
        )
    }

    if (shiftLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#2E7D32" />
            </View>
        )
    }

    // ── Sin ambulancia asignada — no puede iniciar turno hasta que su
    // institución lo ligue a una unidad desde sicem-web o sicem-desktop.
    if (!user?.assignedAmbulanceId) {
        return (
            <View style={styles.container}>
                <Header user={user} connected={connected} onLogout={handleLogoutPress} onPressProfile={() => router.push('/perfil')} />
                <View style={styles.idleBox}>
                    <MaterialCommunityIcons name="ambulance" size={48} color="#ccc" />
                    <Text style={styles.hint}>Todavía no tienes ninguna ambulancia asignada. Pide a tu institución que te ligue a una unidad desde sicem-web o sicem-desktop antes de poder iniciar turno.</Text>
                </View>
            </View>
        )
    }

    // ── Estado 1: tiene ambulancia asignada pero no ha iniciado turno ───
    if (!activeAmbulanceId) {
        return (
            <View style={styles.container}>
                <Header user={user} connected={connected} onLogout={handleLogoutPress} onPressProfile={() => router.push('/perfil')} />
                <View style={styles.card}>
                    <Ionicons name="play-circle-outline" size={40} color="#2E7D32" style={{ alignSelf: 'center', marginBottom: 8 }} />
                    <Text style={styles.sectionTitle}>Iniciar turno</Text>
                    <Text style={styles.hint}>Tienes una ambulancia asignada. Mientras tu turno esté activo, se reporta tu ubicación y te llegan las emergencias que le asignen a tu unidad.</Text>
                    <Text style={styles.scheduleText}>{formatSchedule(user)}</Text>
                    {shiftError ? (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>{shiftError}</Text>
                        </View>
                    ) : null}
                    <TouchableOpacity style={styles.primaryButton} onPress={handleStartShiftPress} disabled={busy}>
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Iniciar turno</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    // ── Estado 2: hay una alerta esperando acuse — pantalla completa a propósito, sin distracciones: es lo más
    // urgente que puede pasar en esta app. ─────────────────────────────────────────────────────────────────
    if (pendingAlert) {
        const em = pendingAlert.emergency
        return (
            <ScrollView style={styles.alertScroll} contentContainerStyle={styles.alertContent}>
                <View style={styles.alertBanner}>
                    <Ionicons name="warning" size={30} color="#fff" />
                    <Text style={styles.alertBannerText}>Nueva emergencia asignada</Text>
                </View>
                <CaseSummary em={em} />
                {/* No es un aceptar/rechazar — tu institución ya asignó la unidad; esto solo confirma que la viste. */}
                <Button label="Entendido — ir al mapa" tone="primary" icon={<Ionicons name="navigate" size={22} color="#fff" />} onPress={() => { acknowledgeAlert(); router.push('/mapa') }} />
            </ScrollView>
        )
    }

    // ── Estado 3: emergencia en curso — centro de la atención ──────────────────────────────────────────────
    if (acceptedEmergency) {
        const em = acceptedEmergency.emergency
        return (
            <ScrollView style={styles.hubScroll} contentContainerStyle={styles.hubContent}>
                <Header user={user} connected={connected} onLogout={handleLogoutPress} onPressProfile={() => router.push('/perfil')} />
                <StepTracker steps={PHASES} current={phaseOf(ambulanceStatusId)} />
                <CaseSummary em={em} />
                <Button label="Ir al mapa" tone="steel" icon={<Ionicons name="map" size={22} color="#fff" />} onPress={() => router.push('/mapa')} />
                <PatientsPanel emergencyId={acceptedEmergency.emergencyId} activeAmbulanceId={activeAmbulanceId} token={token} />
                <FailureReportSection
                    visible={failureModalVisible}
                    onOpen={() => setFailureModalVisible(true)}
                    onClose={() => setFailureModalVisible(false)}
                    note={failureNote}
                    onChangeNote={setFailureNote}
                    onSubmit={submitFailureReport}
                    submitting={submittingFailure}
                />
            </ScrollView>
        )
    }

    // ── Estado 4: en turno, sin nada asignado todavía ───────────────────
    const countdown = formatCountdown(scheduledEnd)
    return (
        <View style={styles.container}>
            <Header user={user} connected={connected} onLogout={handleLogoutPress} onPressProfile={() => router.push('/perfil')} />

            <View style={styles.unitCard}>
                <MaterialCommunityIcons name="ambulance" size={32} color="#2E7D32" />
                <View style={{ flex: 1 }}>
                    <Text style={styles.unitLabel}>Unidad asignada</Text>
                    <Text style={styles.unitNumber}>{unitNumber || `#${activeAmbulanceId}`}</Text>
                </View>
                <View style={styles.onShiftPill}>
                    <View style={styles.onShiftDot} />
                    <Text style={styles.onShiftPillText}>En turno</Text>
                </View>
            </View>

            {parseInt(ambulanceStatusId) === 5 ? (
                <View style={styles.outOfServiceBox}>
                    <Ionicons name="alert-circle" size={40} color="#C21F2D" />
                    <Text style={styles.outOfServiceText}>Tu unidad está "Fuera de servicio" — no puede recibir emergencias hasta que la actives.</Text>
                    <TouchableOpacity style={styles.makeAvailableButton} onPress={handleMakeAvailable} disabled={makingAvailable}>
                        {makingAvailable ? <ActivityIndicator color="#fff" /> : <Text style={styles.makeAvailableButtonText}>Hacer disponible</Text>}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.idleBox}>
                    <Radar><View style={styles.radarCore}><Ionicons name="radio-outline" size={30} color={colors.ok} /></View></Radar>
                    <Text style={styles.hint}>Esperando asignación de emergencia...</Text>
                    {countdown && (
                        <View style={styles.countdownPill}>
                            <Ionicons name="time-outline" size={14} color="#4A5360" />
                            <Text style={styles.countdownText}>{countdown}</Text>
                        </View>
                    )}
                </View>
            )}

            <FailureReportSection
                visible={failureModalVisible}
                onOpen={() => setFailureModalVisible(true)}
                onClose={() => setFailureModalVisible(false)}
                note={failureNote}
                onChangeNote={setFailureNote}
                onSubmit={submitFailureReport}
                submitting={submittingFailure}
            />

            <TouchableOpacity style={styles.endShiftButton} onPress={handleEndShiftPress} disabled={busy}>
                {busy ? <ActivityIndicator color="#C21F2D" /> : <Text style={styles.endShiftButtonText}>Terminar turno</Text>}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    alertScroll: { flex: 1, backgroundColor: colors.bg },
    alertContent: { padding: 16, paddingTop: 24, gap: 14, ...contentColumn },
    alertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16 },
    alertBannerText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    hubScroll: { flex: 1, backgroundColor: colors.bg },
    hubContent: { padding: 16, gap: 14, ...contentColumn },
    caseCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
    caseTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    caseType: { flex: 1, fontSize: 24, fontWeight: '800', color: colors.text },
    caseDesc: { fontSize: 16, color: colors.text, lineHeight: 22 },
    caseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    caseMeta: { fontSize: 15, color: colors.text2, flexShrink: 1 },
    callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.steel, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 14, minHeight: 36 },
    callBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    panelTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
    panelEmpty: { fontSize: 15, color: colors.text2, marginBottom: 10 },
    patientCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, gap: 4 },
    patientHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    patientName: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    patientMeta: { fontSize: 14, color: colors.text2 },
    patientActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    patientBtn: { flex: 1, minHeight: 48 },
    container: { flex: 1, backgroundColor: '#fff', padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    welcome: { fontSize: 18, fontWeight: '700', color: '#14181F' },
    logout: { color: '#C21F2D', fontSize: 13, fontWeight: '600' },
    connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    connectionDot: { width: 8, height: 8, borderRadius: 4 },
    connectionText: { fontSize: 13, color: '#5C6676', fontWeight: '600' },
    pushWarningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDF0D9', borderWidth: 1, borderColor: '#C99A2E', borderRadius: 8, padding: 10, marginBottom: 16 },
    pushWarningText: { flex: 1, fontSize: 13, color: '#8F5A00', fontWeight: '600' },
    card: { borderWidth: 1, borderColor: '#E3E8EE', borderRadius: 12, padding: 16, backgroundColor: '#F0F3F6' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#4A5360', textTransform: 'uppercase', marginTop: 4, marginBottom: 6, textAlign: 'center' },
    hint: { fontSize: 13, color: '#5C6676', marginBottom: 8, textAlign: 'center' },
    scheduleText: { fontSize: 13, color: '#2E7D32', fontWeight: '600', marginBottom: 16, textAlign: 'center' },
    errorBanner: { backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#C21F2D', borderRadius: 8, padding: 12, marginBottom: 12 },
    errorBannerText: { color: '#C21F2D', fontSize: 13, fontWeight: '600' },
    primaryButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    unitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E3E8EE', borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: '#F0F3F6' },
    unitLabel: { fontSize: 13, color: '#5C6676', textTransform: 'uppercase', fontWeight: '600' },
    unitNumber: { fontSize: 18, fontWeight: '700', color: '#14181F' },
    onShiftPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E3F5EA', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
    onShiftDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2E7D32' },
    onShiftPillText: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
    radarCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.okSoft, alignItems: 'center', justifyContent: 'center' },
    idleBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    outOfServiceBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 24 },
    outOfServiceText: { fontSize: 14, color: '#C21F2D', textAlign: 'center', fontWeight: '600' },
    makeAvailableButton: { backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minWidth: 180, alignItems: 'center' },
    makeAvailableButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EDEBE5', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12, marginTop: 6 },
    countdownText: { fontSize: 13, color: '#4A5360', fontWeight: '600' },
    endShiftButton: { borderWidth: 1, borderColor: '#C21F2D', borderRadius: 8, padding: 12, alignItems: 'center' },
    endShiftButtonText: { color: '#C21F2D', fontSize: 14, fontWeight: '600' },
    alertCard: { backgroundColor: '#FDECEE', borderWidth: 2, borderColor: '#C21F2D', borderRadius: 10, padding: 20, marginBottom: 16, alignItems: 'center', marginTop: 40 },
    alertTitle: { fontSize: 14, fontWeight: '700', color: '#C21F2D', marginTop: 6, marginBottom: 10, letterSpacing: 0.5 },
    alertType: { fontSize: 20, fontWeight: '700', color: '#14181F', marginBottom: 4, textAlign: 'center' },
    alertDesc: { fontSize: 13, color: '#4A5360', marginBottom: 6, textAlign: 'center' },
    alertMeta: { fontSize: 13, color: '#4A5360', textAlign: 'center' },
    acceptButton: { flexDirection: 'row', gap: 8, backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    acceptButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    inProgressCard: { borderWidth: 1, borderColor: '#E3E8EE', borderRadius: 10, padding: 16, marginBottom: 16, backgroundColor: '#F0F3F6', alignItems: 'center' },
    failureButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 4 },
    failureButtonText: { color: '#8F5A00', fontSize: 13, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#14181F', marginBottom: 6 },
    modalHint: { fontSize: 13, color: '#5C6676', marginBottom: 14 },
    modalInput: { borderWidth: 1, borderColor: '#CBD3DD', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
    modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
    modalCancelButtonText: { color: '#4A5360', fontSize: 14, fontWeight: '600' },
    modalSubmitButton: { backgroundColor: '#8F5A00', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, minWidth: 80, alignItems: 'center' },
    modalSubmitButtonDisabled: { backgroundColor: '#e0b89a' },
    modalSubmitButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

export default AlertaScreen
