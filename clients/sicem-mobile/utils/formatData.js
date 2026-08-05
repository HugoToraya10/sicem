export function toLowerCaseKeys(obj) {
    const entries = Object.entries(obj)
    const lowerEntries = entries.map(([key, value]) => [key.toLowerCase(), value])
    return Object.fromEntries(lowerEntries)
}
