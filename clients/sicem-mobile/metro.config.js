const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Con unstable_enablePackageExports activo (default en versiones recientes
// de Metro), algunos paquetes pueden resolverse a un archivo interno
// distinto según qué "condition" de su campo "exports" se elija en cada
// punto del bundle — con React esto puede terminar cargando DOS copias
// separadas del módulo (cada una con su propio estado interno de hooks),
// lo cual solo se manifiesta como "Cannot read property 'useState' of
// null" en el bundle final de producción (nunca en desarrollo, donde
// Metro sirve todo desde un único proceso vivo). Se desactiva para forzar
// la resolución clásica basada en "main"/"browser", que es determinista.
config.resolver.unstable_enablePackageExports = false

module.exports = config
