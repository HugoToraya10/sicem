// La BD manda las fechas en ISO ("2002-06-06T05:00:00.000Z"), pero <input type="date"> y MySQL
// esperan "yyyy-MM-dd". Se normaliza a la fecha local.
export const toDateInput = (value) => {
  if (!value) return ''
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const formatDate = (value) => {
  const iso = toDateInput(value)
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { dateStyle: 'long' })
}

export const todayInput = () => toDateInput(new Date())

// Edad en años cumplidos (null si no hay fecha válida)
export const age = (value) => {
  const iso = toDateInput(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  let years = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years -= 1
  return years >= 0 ? years : null
}
