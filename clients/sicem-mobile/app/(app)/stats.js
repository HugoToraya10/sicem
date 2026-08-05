import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'

const BAR_COLORS = ['#2E7D32', '#C0272D', '#1565C0', '#E65100', '#6A1B9A']

const StatsScreen = () => {
    const { token } = useAuth()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/mis-estadisticas`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        })
            .then((res) => res.json())
            .then(({ data }) => setStats(data))
            .catch((err) => console.error('Error recuperando mis estadísticas. ', err))
            .finally(() => setLoading(false))
    }, [token])

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator color="#1565C0" /></View>
    }

    const maxByType = Math.max(1, ...(stats?.byType || []).map((t) => t.total))
    const maxByWeek = Math.max(1, ...(stats?.byWeek || []).map((w) => w.total))

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Mis estadísticas</Text>
            <Text style={styles.hint}>Mes actual — cuenta las emergencias asignadas a tu unidad mientras estabas de turno.</Text>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: '#e8f5e9' }]}>
                    <Text style={[styles.summaryNumber, { color: '#2E7D32' }]}>{stats?.totalThisMonth ?? 0}</Text>
                    <Text style={styles.summaryLabel}>Atenciones mes</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#e3f2fd' }]}>
                    <Text style={[styles.summaryNumber, { color: '#1565C0' }]}>
                        {stats?.avgResponseMinutes ? Number(stats.avgResponseMinutes).toFixed(1) : '—'}
                    </Text>
                    <Text style={styles.summaryLabel}>Min. promedio</Text>
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: '#fde8e8' }]}>
                    <Text style={[styles.summaryNumber, { color: '#C0272D' }]}>{stats?.patientsThisMonth ?? 0}</Text>
                    <Text style={styles.summaryLabel}>Pacientes mes</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#fff3e0' }]}>
                    <Text style={[styles.summaryNumber, { color: '#E65100' }]}>{stats?.notesThisMonth ?? 0}</Text>
                    <Text style={styles.summaryLabel}>Notas registradas</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#ede7f6' }]}>
                    <Text style={[styles.summaryNumber, { color: '#6A1B9A' }]}>
                        {stats?.shiftMinutesThisMonth ? (stats.shiftMinutesThisMonth / 60).toFixed(1) : '0'}
                    </Text>
                    <Text style={styles.summaryLabel}>Horas de turno</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Emergencias por tipo</Text>
            {(!stats?.byType || stats.byType.length === 0) ? (
                <Text style={styles.hint}>Sin datos este mes todavía.</Text>
            ) : (
                <View style={styles.barsRow}>
                    {stats.byType.map((t, i) => (
                        <View key={t.name} style={styles.barColumn}>
                            <View style={[styles.bar, { height: 20 + (t.total / maxByType) * 60, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                            <Text style={styles.barLabel}>{t.name}</Text>
                            <Text style={styles.barValue}>{t.total}</Text>
                        </View>
                    ))}
                </View>
            )}

            <Text style={styles.sectionTitle}>Atenciones por semana</Text>
            {(!stats?.byWeek || stats.byWeek.length === 0) ? (
                <Text style={styles.hint}>Sin datos este mes todavía.</Text>
            ) : (
                <View style={styles.barsRow}>
                    {stats.byWeek.map((w) => (
                        <View key={w.week_of_month} style={styles.barColumn}>
                            <View style={[styles.bar, { height: 20 + (w.total / maxByWeek) * 60, backgroundColor: '#2E7D32' }]} />
                            <Text style={styles.barLabel}>S{w.week_of_month}</Text>
                            <Text style={styles.barValue}>{w.total}</Text>
                        </View>
                    ))}
                </View>
            )}

            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            {(!stats?.recentActivity || stats.recentActivity.length === 0) ? (
                <Text style={styles.hint}>Sin actividad registrada todavía.</Text>
            ) : (
                stats.recentActivity.map((a) => (
                    <View key={a.emergency_id} style={styles.activityRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activityType}>{a.type_name || 'Emergencia'}</Text>
                            <Text style={styles.activityDesc}>{a.description || 'Sin descripción'}</Text>
                        </View>
                        <Text style={styles.activityDate}>
                            {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ''}
                        </Text>
                    </View>
                ))
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
    hint: { fontSize: 12, color: '#999', marginBottom: 12 },
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    summaryCard: { flex: 1, borderRadius: 8, padding: 14, alignItems: 'center' },
    summaryNumber: { fontSize: 26, fontWeight: '700' },
    summaryLabel: { fontSize: 10, color: '#666', marginTop: 2 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 14, marginBottom: 10 },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 110 },
    barColumn: { alignItems: 'center', flex: 1 },
    bar: { width: '100%', borderRadius: 3, maxWidth: 40 },
    barLabel: { fontSize: 9, color: '#888', marginTop: 4, textAlign: 'center' },
    barValue: { fontSize: 10, fontWeight: '700', color: '#333' },
    activityRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: '#e4e4ec', borderRadius: 8, padding: 10, marginBottom: 8,
    },
    activityType: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
    activityDesc: { fontSize: 11, color: '#666', marginTop: 2 },
    activityDate: { fontSize: 10, color: '#999', marginLeft: 8 },
})

export default StatsScreen
