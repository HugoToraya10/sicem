import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'

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

const AlertaScreen = () => {
    const { user, logout } = useAuth()
    const { activeAmbulanceId, loading: shiftLoading, busy, startShift, endShift } = useAmbulance()
    const { pendingAlert, acceptedEmergency, acceptAlert, rejectAlert } = useSocketAlerts()
    const router = useRouter()
    const [shiftError, setShiftError] = useState(null)

    const handleStartShift = () => {
        setShiftError(null)
        startShift(user.assignedAmbulanceId).catch((err) => {
            console.error('Error iniciando turno. ', err)
            setShiftError(err.message)
        })
    }

    const handleEndShift = () => {
        endShift().catch((err) => {
            console.error('Error terminando turno. ', err)
            Alert.alert('Error', err.message)
        })
    }

    // Si hay turno activo, hay que terminarlo ANTES de cerrar sesión — si no,
    // la unidad se queda marcada como "Disponible" en el mapa del despachador
    // aunque ya nadie la esté manejando. await explícito (en vez de encadenar
    // .then/.finally) para que quede clarísimo que esperamos a que el PATCH
    // de terminar-turno de verdad termine antes de borrar el token — no se
    // bloquea el logout si esto falla (el backend igual limpia turnos
    // abandonados tras unas horas), pero si tiene tiempo de completarse, se
    // completa antes de cerrar sesión.
    const handleLogout = async () => {
        if (activeAmbulanceId) {
            try {
                await endShift()
            } catch (err) {
                console.error('Error terminando turno al cerrar sesión. ', err)
            }
        }
        await logout()
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
                <View style={styles.header}>
                    <Text style={styles.welcome}>Hola, {user?.firstName || 'Paramédico'}</Text>
                    <TouchableOpacity onPress={handleLogout}><Text style={styles.logout}>Cerrar sesión</Text></TouchableOpacity>
                </View>
                <View style={styles.idleBox}>
                    <Text style={styles.hint}>Todavía no tienes ninguna ambulancia asignada. Pide a tu institución que te ligue a una unidad desde sicem-web o sicem-desktop antes de poder iniciar turno.</Text>
                </View>
            </View>
        )
    }

    // ── Estado 1: tiene ambulancia asignada pero no ha iniciado turno ───
    if (!activeAmbulanceId) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.welcome}>Hola, {user?.firstName || 'Paramédico'}</Text>
                    <TouchableOpacity onPress={handleLogout}><Text style={styles.logout}>Cerrar sesión</Text></TouchableOpacity>
                </View>
                <Text style={styles.sectionTitle}>Iniciar turno</Text>
                <Text style={styles.hint}>Tienes una ambulancia asignada. Mientras tu turno esté activo, se reporta tu ubicación y te llegan las emergencias que le asignen a tu unidad.</Text>
                <Text style={styles.scheduleText}>{formatSchedule(user)}</Text>
                {shiftError ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{shiftError}</Text>
                    </View>
                ) : null}
                <TouchableOpacity style={styles.primaryButton} onPress={handleStartShift} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Iniciar turno</Text>}
                </TouchableOpacity>
            </View>
        )
    }

    // ── Estado 2: hay una alerta esperando aceptar/rechazar ─────────────
    if (pendingAlert) {
        const em = pendingAlert.emergency
        return (
            <View style={styles.container}>
                <View style={styles.alertCard}>
                    <Text style={styles.alertTitle}>🚨 NUEVA EMERGENCIA ASIGNADA</Text>
                    <Text style={styles.alertType}>{em?.type_name || 'Emergencia'}</Text>
                    {em?.description ? <Text style={styles.alertDesc}>{em.description}</Text> : null}
                    {em?.reporter_name ? <Text style={styles.alertMeta}>Reportado por: {em.reporter_name} · {em.reporter_phone}</Text> : null}
                    {em?.num_patients ? <Text style={styles.alertMeta}>Pacientes: {em.num_patients}</Text> : null}
                </View>
                <TouchableOpacity style={styles.acceptButton} onPress={() => { acceptAlert(); router.push('/mapa') }}>
                    <Text style={styles.acceptButtonText}>✓ Aceptar y navegar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={rejectAlert}>
                    <Text style={styles.rejectButtonText}>✗ No puedo atender</Text>
                </TouchableOpacity>
            </View>
        )
    }

    // ── Estado 3: emergencia aceptada, en curso ─────────────────────────
    if (acceptedEmergency) {
        const em = acceptedEmergency.emergency
        return (
            <View style={styles.container}>
                <Text style={styles.sectionTitle}>En curso</Text>
                <View style={styles.inProgressCard}>
                    <Text style={styles.alertType}>{em?.type_name || 'Emergencia'}</Text>
                    {em?.description ? <Text style={styles.alertDesc}>{em.description}</Text> : null}
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/mapa')}>
                    <Text style={styles.primaryButtonText}>Ir al mapa</Text>
                </TouchableOpacity>
            </View>
        )
    }

    // ── Estado 4: en turno, sin nada asignado todavía ───────────────────
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.welcome}>Hola, {user?.firstName || 'Paramédico'}</Text>
                <TouchableOpacity onPress={handleLogout}><Text style={styles.logout}>Cerrar sesión</Text></TouchableOpacity>
            </View>
            <View style={styles.idleBox}>
                <Text style={styles.idleTitle}>🟢 En turno</Text>
                <Text style={styles.hint}>Esperando asignación de emergencia...</Text>
            </View>
            <TouchableOpacity style={styles.endShiftButton} onPress={handleEndShift} disabled={busy}>
                {busy ? <ActivityIndicator color="#C0272D" /> : <Text style={styles.endShiftButtonText}>Terminar turno</Text>}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    welcome: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
    logout: { color: '#C0272D', fontSize: 13, fontWeight: '600' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
    hint: { fontSize: 12, color: '#999', marginBottom: 8 },
    scheduleText: { fontSize: 13, color: '#2E7D32', fontWeight: '600', marginBottom: 16 },
    errorBanner: { backgroundColor: '#fde8e8', borderWidth: 1, borderColor: '#C0272D', borderRadius: 8, padding: 12, marginBottom: 12 },
    errorBannerText: { color: '#C0272D', fontSize: 13, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { borderWidth: 1, borderColor: '#2E7D32', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    chipSelected: { backgroundColor: '#2E7D32' },
    chipText: { color: '#2E7D32', fontSize: 13, fontWeight: '600' },
    chipTextSelected: { color: '#fff' },
    primaryButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    idleBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    idleTitle: { fontSize: 18, fontWeight: '700', color: '#2E7D32', marginBottom: 8 },
    endShiftButton: { borderWidth: 1, borderColor: '#C0272D', borderRadius: 8, padding: 12, alignItems: 'center' },
    endShiftButtonText: { color: '#C0272D', fontSize: 14, fontWeight: '600' },
    alertCard: { backgroundColor: '#fde8e8', borderWidth: 2, borderColor: '#C0272D', borderRadius: 10, padding: 16, marginBottom: 16 },
    alertTitle: { fontSize: 13, fontWeight: '700', color: '#C0272D', marginBottom: 6 },
    alertType: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 4 },
    alertDesc: { fontSize: 13, color: '#555', marginBottom: 6 },
    alertMeta: { fontSize: 12, color: '#555' },
    acceptButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 10 },
    acceptButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    rejectButton: { borderWidth: 1, borderColor: '#C0272D', borderRadius: 8, padding: 14, alignItems: 'center' },
    rejectButtonText: { color: '#C0272D', fontSize: 15, fontWeight: '700' },
    inProgressCard: { borderWidth: 1, borderColor: '#e4e4ec', borderRadius: 10, padding: 16, marginBottom: 16, backgroundColor: '#fafafa' },
})

export default AlertaScreen
