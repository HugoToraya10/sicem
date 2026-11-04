import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, Pressable, Animated } from 'react-native'
import { colors, TOUCH } from '../constants/theme'

// Botón grande, pensado para usarse con guantes y en movimiento. tone: primary | ok | danger | neutral | ghost
export const Button = ({ label, onPress, tone = 'primary', loading = false, disabled = false, icon = null, style, compact = false }) => {
    const palette = {
        primary: { bg: colors.brand, fg: '#fff', border: colors.brand },
        ok: { bg: colors.ok, fg: '#fff', border: colors.ok },
        steel: { bg: colors.steel, fg: '#fff', border: colors.steel },
        danger: { bg: colors.surface, fg: colors.brand, border: colors.brand },
        neutral: { bg: colors.surface, fg: colors.text, border: colors.lineStrong },
        ghost: { bg: 'transparent', fg: colors.steel, border: 'transparent' },
    }[tone]
    const inactive = disabled || loading
    const scale = useRef(new Animated.Value(1)).current
    const press = (to) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
    const solid = tone === 'primary' || tone === 'ok' || tone === 'steel'
    return (
        <Animated.View style={[{ transform: [{ scale }] }, solid && !inactive && { shadowColor: palette.bg, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, styles.buttonWrap, style]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: inactive, busy: loading }}
                onPress={onPress}
                onPressIn={() => press(0.97)}
                onPressOut={() => press(1)}
                disabled={inactive}
                style={[styles.button, compact && { minHeight: TOUCH }, { backgroundColor: palette.bg, borderColor: palette.border }, inactive && styles.buttonInactive]}
            >
                {loading
                    ? <ActivityIndicator color={palette.fg} />
                    : <View style={styles.buttonRow}>{icon}<Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text></View>}
            </Pressable>
        </Animated.View>
    )
}

// Aparece con un ligero ascenso; el retraso escalona varias piezas seguidas.
export const Reveal = ({ children, delay = 0, style }) => {
    const v = useRef(new Animated.Value(0)).current
    useEffect(() => {
        Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start()
    }, [v, delay])
    return (
        <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
            {children}
        </Animated.View>
    )
}

// Etiqueta corta (estado, triage, dato clave)
export const Chip = ({ label, tone = 'neutral', color, textColor }) => {
    const palette = {
        neutral: { bg: colors.surface2, fg: colors.text2 },
        ok: { bg: colors.okSoft, fg: colors.ok },
        warn: { bg: colors.warnSoft, fg: colors.warn },
        brand: { bg: colors.brandSoft, fg: colors.brand },
        steel: { bg: colors.steelSoft, fg: colors.steel },
    }[tone]
    return (
        <View style={[styles.chip, { backgroundColor: color || palette.bg }]}>
            <Text style={[styles.chipText, { color: textColor || palette.fg }]}>{label}</Text>
        </View>
    )
}

// Texto de contraste legible sobre un color de triage (misma lógica que readableTextOn en web)
export const readableTextOn = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return '#fff'
    const n = parseInt(m[1], 16)
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum > 0.4 ? '#14181F' : '#fff'
}

export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
export const TRIAGE_COLORS = { 1: '#C62828', 2: '#E8710A', 3: '#D9A400', 4: '#2E7D32', 5: '#1E6FB8' }
export const TRIAGE_NAMES = { 1: 'Rojo', 2: 'Naranja', 3: 'Amarillo', 4: 'Verde', 5: 'Azul' }

export const TriageBadge = ({ level }) => {
    const n = Number(level) || ({ I: 1, II: 2, III: 3, IV: 4, V: 5 })[String(level).toUpperCase()]
    if (!n) return null
    const bg = TRIAGE_COLORS[n]
    return <Chip label={`Triage ${ROMAN[n]} · ${TRIAGE_NAMES[n]}`} color={bg} textColor={readableTextOn(bg)} />
}

// Campo con etiqueta SIEMPRE visible (el placeholder desaparece al escribir y en una emergencia no se puede adivinar qué era el campo)
export const Field = ({ label, unit, hint, error, style, inputStyle, ...props }) => (
    <View style={[styles.field, style]}>
        <Text style={styles.fieldLabel}>{label}{unit ? <Text style={styles.fieldUnit}> ({unit})</Text> : null}</Text>
        <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.text3}
            style={[styles.input, error && styles.inputError, props.multiline && styles.textarea, inputStyle]}
            {...props}
        />
        {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
)

// Elección entre pocas opciones: un toque, sin teclado
export const ChoiceChips = ({ options, value, onChange, getColor }) => (
    <View style={styles.choiceRow}>
        {options.map((opt) => {
            const selected = String(value) === String(opt.value)
            const bg = selected ? (getColor ? getColor(opt) : colors.steel) : colors.surface
            return (
                <TouchableOpacity
                    key={String(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.85}
                    onPress={() => onChange(selected ? '' : opt.value)}
                    style={[styles.choice, { backgroundColor: bg, borderColor: selected ? bg : colors.lineStrong }]}
                >
                    <Text style={[styles.choiceText, { color: selected ? readableTextOn(bg) : colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
            )
        })}
    </View>
)

export const SectionTitle = ({ children }) => <Text style={styles.sectionTitle}>{children}</Text>

export const Notice = ({ tone = 'info', children }) => {
    const palette = {
        info: { bg: colors.steelSoft, fg: colors.steel },
        ok: { bg: colors.okSoft, fg: colors.ok },
        warn: { bg: colors.warnSoft, fg: colors.warn },
        error: { bg: colors.brandSoft, fg: colors.brand },
    }[tone]
    return (
        <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
            <Text style={[styles.noticeText, { color: palette.fg }]}>{children}</Text>
        </View>
    )
}

// Pasos de la atención: dónde estoy y qué sigue
export const StepTracker = ({ steps, current }) => (
    <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`Paso ${current + 1} de ${steps.length}: ${steps[current]}`}>
        {steps.map((label, i) => (
            <View key={label} style={styles.step}>
                <View style={[styles.stepBar, i <= current && styles.stepBarOn, i === current && styles.stepBarNow]} />
                <Text style={[styles.stepLabel, i === current && styles.stepLabelNow]} numberOfLines={1}>{label}</Text>
            </View>
        ))}
    </View>
)

const styles = StyleSheet.create({
    buttonWrap: { borderRadius: 12 },
    button: { minHeight: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    buttonInactive: { opacity: 0.55 },
    buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttonText: { fontSize: 17, fontWeight: '700' },
    chip: { alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
    chipText: { fontSize: 13, fontWeight: '700' },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text2, marginBottom: 5 },
    fieldUnit: { fontWeight: '400', color: colors.text3 },
    fieldHint: { fontSize: 13, color: colors.text3, marginTop: 4 },
    fieldError: { fontSize: 13, color: colors.brand, fontWeight: '600', marginTop: 4 },
    input: { minHeight: TOUCH, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.text },
    inputError: { borderColor: colors.brand },
    textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { minHeight: 44, minWidth: 56, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
    choiceText: { fontSize: 15, fontWeight: '700' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
    notice: { borderRadius: 8, padding: 12, marginBottom: 12 },
    noticeText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    steps: { flexDirection: 'row', gap: 6 },
    step: { flex: 1 },
    stepBar: { height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 5 },
    stepBarOn: { backgroundColor: colors.steel },
    stepBarNow: { backgroundColor: colors.brand },
    stepLabel: { fontSize: 12, color: colors.text3, fontWeight: '600' },
    stepLabelNow: { color: colors.text, fontWeight: '800' },
})

// Anillos que se expanden desde un punto: "escuchando", sin ruido ni textos.
export const Radar = ({ children, color = colors.ok, size = 120 }) => {
    const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
    useEffect(() => {
        const loops = rings.map((v, i) => Animated.loop(Animated.sequence([
            Animated.delay(i * 800),
            Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true }),
        ])))
        loops.forEach((l) => l.start())
        return () => loops.forEach((l) => l.stop())
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {rings.map((v, i) => (
                <Animated.View key={i} pointerEvents="none" style={{
                    position: 'absolute', width: size * 0.5, height: size * 0.5, borderRadius: size, borderWidth: 2, borderColor: color,
                    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                }} />
            ))}
            {children}
        </View>
    )
}
