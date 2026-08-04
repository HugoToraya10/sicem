const { withProjectBuildGradle } = require('@expo/config-plugins');

// expo-build-properties (la forma "oficial" de configurar esto) NO soporta
// ndkVersion en la versión instalada — el campo se ignora en silencio, sin
// error. Por eso este plugin a mano: mete "ext.ndkVersion" directo en
// android/build.gradle en cada prebuild, ANTES de que se aplique el plugin
// de React Native (que si no, pone su propio default). Fija la NDK a
// 26.1.10909125 porque la más nueva (27.x) tiene un bug conocido de
// enlazado de C++ con este React Native — ver services/emergencias... no,
// ver la conversación de configuración de sicem-mobile para el detalle.
const NDK_VERSION = '26.1.10909125';

const withNdkVersion = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy' && !config.modResults.contents.includes('ext.ndkVersion')) {
            config.modResults.contents = config.modResults.contents.replace(
                'apply plugin: "expo-root-project"',
                `ext.ndkVersion = "${NDK_VERSION}"\n\napply plugin: "expo-root-project"`
            );
        }
        return config;
    });
};

module.exports = withNdkVersion;
