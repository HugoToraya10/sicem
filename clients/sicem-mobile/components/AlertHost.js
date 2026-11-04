import { useEffect, useRef, useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { registerAlertHost } from '../utils/alert'
import { colors, TOUCH } from '../constants/theme'

// Diálogos de la app (confirmaciones y avisos): una tarjeta centrada, botones grandes para dedos con guantes,
// el botón principal a la derecha o abajo, y el destructivo en rojo.
const AlertHost = () => {
    const [queue, setQueue] = useState([])
    const current = queue[0]
    const fade = useRef(new Animated.Value(0)).current

    useEffect(() => registerAlertHost((a) => setQueue((q) => [...q, a])), [])
    useEffect(() => {
        if (current) { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start() }
    }, [current, fade])

    if (!current) return null

    const close = (button) => {
        setQueue((q) => q.slice(1))
        // El onPress corre después de cerrar, como hace el Alert nativo.
        if (button?.onPress) setTimeout(() => button.onPress(), 0)
    }
    const cancelButton = current.buttons.find((b) => b.style === 'cancel')
    const stacked = current.buttons.length > 2 || current.buttons.some((b) => (b.text || '').length > 16)

    return (
        <Modal transparent animationType="none" visible onRequestClose={() => { if (current.cancelable || cancelButton) close(cancelButton) }} statusBarTranslucent>
            <Animated.View style={[styles.backdrop, { opacity: fade }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (current.cancelable && cancelButton) close(cancelButton) }} accessibilityLabel="Cerrar" />
                <Animated.View style={[styles.card, { transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]} accessibilityViewIsModal>
                    {!!current.title && <Text style={styles.title} accessibilityRole="header">{current.title}</Text>}
                    {!!current.message && <Text style={styles.message}>{current.message}</Text>}
                    <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
                        {(stacked ? [...current.buttons].reverse() : current.buttons).map((b, i) => {
                            const destructive = b.style === 'destructive'
                            const isCancel = b.style === 'cancel'
                            return (
                                <Pressable
                                    key={`${b.text}-${i}`}
                                    accessibilityRole="button"
                                    onPress={() => close(b)}
                                    style={({ pressed }) => [
                                        styles.button,
                                        stacked ? styles.buttonFull : styles.buttonHalf,
                                        isCancel ? styles.buttonNeutral : destructive ? styles.buttonDanger : styles.buttonPrimary,
                                        pressed && { opacity: 0.85 },
                                    ]}
                                >
                                    <Text style={[styles.buttonText, isCancel && { color: colors.text }]}>{b.text}</Text>
                                </Pressable>
                            )
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(11,13,18,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: colors.line, shadowColor: '#101828', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
    message: { fontSize: 16, lineHeight: 23, color: colors.text2, marginBottom: 20 },
    buttons: { flexDirection: 'row', gap: 10 },
    buttonsStacked: { flexDirection: 'column' },
    button: { minHeight: TOUCH, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
    buttonHalf: { flex: 1 },
    buttonFull: { alignSelf: 'stretch' },
    buttonPrimary: { backgroundColor: colors.steel },
    buttonDanger: { backgroundColor: colors.brand },
    buttonNeutral: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.lineStrong },
    buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})

export default AlertHost
