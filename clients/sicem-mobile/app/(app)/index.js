import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, Linking } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'

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
    return 'Tu horario: ' + [...windows]
        .sort((a, b) => a.day - b.day)
        .map((w) => `${WEEKDAY_LABELS[parseInt(w.day)]} ${w.start}-${w.end}`)
        .join(', ')
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
        <View style={[styles.connectionDot, { backgroundColor: connected ? '#2E7D32' : '#C0272D' }]} />
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
            <Ionicons name="notifications-off-outline" size={16} color="#7a5c00" />
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
            <Ionicons name="warning-outline" size={16} color="#E65100" />
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

    // ── Estado 2: hay una alerta esperando aceptar/rechazar — pantalla
    // completa a propósito, sin distracciones, es lo más urgente que puede
    // pasar en esta app. ─────────────────────────────────────────────────
    if (pendingAlert) {
        const em = pendingAlert.emergency
        return (
            <View style={styles.container}>
                <View style={styles.alertCard}>
                    <Ionicons name="warning" size={32} color="#C0272D" />
                    <Text style={styles.alertTitle}>NUEVA EMERGENCIA ASIGNADA</Text>
                    <Text style={styles.alertType}>{em?.type_name || 'Emergencia'}</Text>
                    {em?.description ? <Text style={styles.alertDesc}>{em.description}</Text> : null}
                    {em?.reporter_name ? <Text style={styles.alertMeta}>Reportado por: {em.reporter_name} · {em.reporter_phone}</Text> : null}
                    {em?.num_patients ? <Text style={styles.alertMeta}>Pacientes: {em.num_patients}</Text> : null}
                </View>
                {/* No es un aceptar/rechazar — tu institución ya asignó la unidad,
                esto es solo confirmar que ya la viste antes de navegar. */}
                <TouchableOpacity style={styles.acceptButton} onPress={() => { acknowledgeAlert(); router.push('/mapa') }}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.acceptButtonText}>Entendido — ir al mapa</Text>
                </TouchableOpacity>
            </View>
        )
    }

    // ── Estado 3: emergencia aceptada, en curso ─────────────────────────
    if (acceptedEmergency) {
        const em = acceptedEmergency.emergency
        return (
            <View style={styles.container}>
                <Header user={user} connected={connected} onLogout={handleLogoutPress} onPressProfile={() => router.push('/perfil')} />
                <Text style={styles.sectionTitle}>En curso</Text>
                <View style={styles.inProgressCard}>
                    <Ionicons name="navigate-circle" size={28} color="#C0272D" />
                    <Text style={styles.alertType}>{em?.type_name || 'Emergencia'}</Text>
                    {em?.description ? <Text style={styles.alertDesc}>{em.description}</Text> : null}
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/mapa')}>
                    <Text style={styles.primaryButtonText}>Ir al mapa</Text>
                </TouchableOpacity>
                <FailureReportSection
                    visible={failureModalVisible}
                    onOpen={() => setFailureModalVisible(true)}
                    onClose={() => setFailureModalVisible(false)}
                    note={failureNote}
                    onChangeNote={setFailureNote}
                    onSubmit={submitFailureReport}
                    submitting={submittingFailure}
                />
            </View>
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
                    <Ionicons name="alert-circle" size={40} color="#C0272D" />
                    <Text style={styles.outOfServiceText}>Tu unidad está "Fuera de servicio" — no puede recibir emergencias hasta que la actives.</Text>
                    <TouchableOpacity style={styles.makeAvailableButton} onPress={handleMakeAvailable} disabled={makingAvailable}>
                        {makingAvailable ? <ActivityIndicator color="#fff" /> : <Text style={styles.makeAvailableButtonText}>Hacer disponible</Text>}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.idleBox}>
                    <Ionicons name="radio-outline" size={40} color="#2E7D32" />
                    <Text style={styles.hint}>Esperando asignación de emergencia...</Text>
                    {countdown && (
                        <View style={styles.countdownPill}>
                            <Ionicons name="time-outline" size={14} color="#555" />
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
                {busy ? <ActivityIndicator color="#C0272D" /> : <Text style={styles.endShiftButtonText}>Terminar turno</Text>}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    welcome: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
    logout: { color: '#C0272D', fontSize: 13, fontWeight: '600' },
    connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    connectionDot: { width: 8, height: 8, borderRadius: 4 },
    connectionText: { fontSize: 11, color: '#888', fontWeight: '600' },
    pushWarningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#e0a800', borderRadius: 8, padding: 10, marginBottom: 16 },
    pushWarningText: { flex: 1, fontSize: 11, color: '#7a5c00', fontWeight: '600' },
    card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, backgroundColor: '#fafafa' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 4, marginBottom: 6, textAlign: 'center' },
    hint: { fontSize: 12, color: '#999', marginBottom: 8, textAlign: 'center' },
    scheduleText: { fontSize: 13, color: '#2E7D32', fontWeight: '600', marginBottom: 16, textAlign: 'center' },
    errorBanner: { backgroundColor: '#fde8e8', borderWidth: 1, borderColor: '#C0272D', borderRadius: 8, padding: 12, marginBottom: 12 },
    errorBannerText: { color: '#C0272D', fontSize: 13, fontWeight: '600' },
    primaryButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    unitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: '#f7fdf8' },
    unitLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: '600' },
    unitNumber: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
    onShiftPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e8f5e9', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
    onShiftDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2E7D32' },
    onShiftPillText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },
    idleBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    outOfServiceBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 24 },
    outOfServiceText: { fontSize: 14, color: '#C0272D', textAlign: 'center', fontWeight: '600' },
    makeAvailableButton: { backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minWidth: 180, alignItems: 'center' },
    makeAvailableButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f0f0f0', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12, marginTop: 6 },
    countdownText: { fontSize: 12, color: '#555', fontWeight: '600' },
    endShiftButton: { borderWidth: 1, borderColor: '#C0272D', borderRadius: 8, padding: 12, alignItems: 'center' },
    endShiftButtonText: { color: '#C0272D', fontSize: 14, fontWeight: '600' },
    alertCard: { backgroundColor: '#fde8e8', borderWidth: 2, borderColor: '#C0272D', borderRadius: 10, padding: 20, marginBottom: 16, alignItems: 'center', marginTop: 40 },
    alertTitle: { fontSize: 14, fontWeight: '700', color: '#C0272D', marginTop: 6, marginBottom: 10, letterSpacing: 0.5 },
    alertType: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 4, textAlign: 'center' },
    alertDesc: { fontSize: 13, color: '#555', marginBottom: 6, textAlign: 'center' },
    alertMeta: { fontSize: 12, color: '#555', textAlign: 'center' },
    acceptButton: { flexDirection: 'row', gap: 8, backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    acceptButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    inProgressCard: { borderWidth: 1, borderColor: '#e4e4ec', borderRadius: 10, padding: 16, marginBottom: 16, backgroundColor: '#fafafa', alignItems: 'center' },
    failureButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 4 },
    failureButtonText: { color: '#E65100', fontSize: 13, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
    modalHint: { fontSize: 12, color: '#888', marginBottom: 14 },
    modalInput: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
    modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
    modalCancelButtonText: { color: '#666', fontSize: 14, fontWeight: '600' },
    modalSubmitButton: { backgroundColor: '#E65100', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, minWidth: 80, alignItems: 'center' },
    modalSubmitButtonDisabled: { backgroundColor: '#e0b89a' },
    modalSubmitButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

export default AlertaScreen
