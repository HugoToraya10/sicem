// Reglas operativas con nombre: valores que son decisiones de operación, no de programación.
// Ajustarlos aquí cambia el comportamiento de todo el sistema web.

// Una emergencia activa sin movimiento por este tiempo se marca "Sin movimiento · revisar"
export const STALLED_THRESHOLD_MINUTES = 120

// Una falla de unidad reportada deja de ser noticia pasado este tiempo (o si ya se desasignó)
export const FAILURE_WINDOW_MS = 12 * 60 * 60 * 1000

// Cuántas unidades recomienda "Asignar la más cercana" desde el mapa
export const QUICK_ASSIGN_MAX_CANDIDATES = 3

// Tope de pacientes por ambulancia en una misma emergencia (2 cabe en la práctica: 1 en camilla +
// 1 ambulatorio; la NOM-034-SSA3-2013 no fija un máximo, solo exige cabida para 1 en camilla)
export const MAX_PATIENTS_PER_AMBULANCE = 5

// Eventos que conserva la bitácora del Dashboard en pantalla
export const ACTIVITY_LOG_MAX = 40

// Coincidencias que muestra la búsqueda de direcciones
export const ADDRESS_RESULTS_LIMIT = 5
