import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { colors, contentColumn } from '../../constants/theme'
import { Reveal } from '../../components/ui'

const rawMonth = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

const Tile = ({ value, label, color, bg }) => (
    <View style={[styles.tile, { backgroundColor: bg }]} accessible accessibilityLabel={`${label}: ${value}`}>
        <Text style={[styles.tileValue, { color }]}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
    </View>
)

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
        return <View style={styles.centered}><ActivityIndicator color={colors.steel} /></View>
    }

    const byType = stats?.byType || []
    const byWeek = stats?.byWeek || []
    const maxByType = Math.max(1, ...byType.map((t) => t.total))
    const maxByWeek = Math.max(1, ...byWeek.map((w) => w.total))
    const hours = stats?.shiftMinutesThisMonth ? (stats.shiftMinutesThisMonth / 60).toFixed(1) : '0'
    const avg = Number(stats?.avgResponseMinutes) > 0 ? Number(stats.avgResponseMinutes).toFixed(1) : '—'

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Mis estadísticas</Text>
            <Text style={styles.hint}>{monthName} · emergencias asignadas a tu unidad mientras estabas de turno.</Text>

            <Reveal delay={0}><View style={styles.hero}>
                <Text style={styles.heroValue}>{stats?.totalThisMonth ?? 0}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.heroLabel}>Atenciones este mes</Text>
                    <Text style={styles.heroSub}>Tiempo promedio de respuesta: {avg === '—' ? 'sin datos' : `${avg} min`}</Text>
                </View>
            </View></Reveal>

            <Reveal delay={80}><View style={styles.tiles}>
                <Tile value={stats?.patientsThisMonth ?? 0} label="Pacientes" color={colors.brand} bg={colors.brandSoft} />
                <Tile value={stats?.notesThisMonth ?? 0} label="Notas" color={colors.warn} bg={colors.warnSoft} />
                <Tile value={hours} label="Horas de turno" color={colors.steel} bg={colors.steelSoft} />
            </View></Reveal>

            <Reveal delay={160}><View style={styles.card}>
                <Text style={styles.cardTitle}>Emergencias por tipo</Text>
                {byType.length === 0 ? (
                    <Text style={styles.empty}>Sin datos este mes todavía.</Text>
                ) : byType.map((t) => (
                    <View key={t.name} style={styles.hRow}>
                        <Text style={styles.hLabel} numberOfLines={1}>{t.name}</Text>
                        <View style={styles.hTrack}>
                            <View style={[styles.hFill, { width: `${Math.max(6, (t.total / maxByType) * 100)}%` }]} />
                        </View>
                        <Text style={styles.hValue}>{t.total}</Text>
                    </View>
                ))}
            </View></Reveal>

            <Reveal delay={240}><View style={styles.card}>
                <Text style={styles.cardTitle}>Atenciones por semana</Text>
                {byWeek.length === 0 ? (
                    <Text style={styles.empty}>Sin datos este mes todavía.</Text>
                ) : (
                    <View style={styles.barsRow}>
                        {byWeek.map((w) => (
                            <View key={w.week_of_month} style={styles.barColumn}>
                                <Text style={styles.barValue}>{w.total}</Text>
                                <View style={[styles.bar, { height: 14 + (w.total / maxByWeek) * 70 }]} />
                                <Text style={styles.barLabel}>Sem {w.week_of_month}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View></Reveal>

            <Reveal delay={320}><View style={styles.card}>
                <Text style={styles.cardTitle}>Actividad reciente</Text>
                {(!stats?.recentActivity || stats.recentActivity.length === 0) ? (
                    <Text style={styles.empty}>Sin actividad registrada todavía.</Text>
                ) : stats.recentActivity.map((a, i) => (
                    <View key={a.emergency_id} style={[styles.activityRow, i > 0 && styles.activityBorder]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activityType}>{a.type_name || 'Emergencia'}</Text>
                            <Text style={styles.activityDesc} numberOfLines={2}>{a.description || 'Sin descripción'}</Text>
                        </View>
                        <Text style={styles.activityDate}>
                            {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''}
                        </Text>
                    </View>
                ))}
            </View></Reveal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, gap: 14, ...contentColumn },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, color: colors.text3, marginTop: -8 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    heroValue: { fontSize: 48, fontWeight: '700', color: colors.ok, minWidth: 64 },
    heroLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
    heroSub: { fontSize: 13, color: colors.text2, marginTop: 2 },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
    tileValue: { fontSize: 26, fontWeight: '700' },
    tileLabel: { fontSize: 13, color: colors.text2, marginTop: 2, textAlign: 'center' },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
    empty: { fontSize: 13, color: colors.text3 },
    hRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    hLabel: { width: 110, fontSize: 13, color: colors.text2 },
    hTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    hFill: { height: '100%', backgroundColor: colors.steel },
    hValue: { width: 28, textAlign: 'right', fontSize: 14, fontWeight: '700', color: colors.text },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 130 },
    barColumn: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
    bar: { width: '100%', maxWidth: 44, borderRadius: 4, backgroundColor: colors.ok },
    barLabel: { fontSize: 13, color: colors.text3, marginTop: 4 },
    barValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 3 },
    activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
    activityBorder: { borderTopWidth: 1, borderTopColor: colors.line },
    activityType: { fontSize: 14, fontWeight: '700', color: colors.text },
    activityDesc: { fontSize: 13, color: colors.text2, marginTop: 2 },
    activityDate: { fontSize: 13, color: colors.text3 },
})

export default StatsScreen
