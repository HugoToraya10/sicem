// El nivel de triage puede llegar como número (1) o ya en romano ("I"): se normaliza a número.
export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
export const triageNumber = (level) => Number(level) || ({ I: 1, II: 2, III: 3, IV: 4, V: 5 })[String(level).toUpperCase()] || null
export const triageRoman = (level) => ROMAN[triageNumber(level)] || (level ? String(level) : '')
