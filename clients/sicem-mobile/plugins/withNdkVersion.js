const { withProjectBuildGradle } = require('@expo/config-plugins');

// expo-build-properties (la forma "oficial" de configurar esto) NO soporta
// ndkVersion en la versión instalada — el campo se ignora en silencio, sin
// error. Por eso este plugin a mano: mete "ext.ndkVersion" directo en
// android/build.gradle en cada prebuild, ANTES de que se aplique el plugin
// de React Native (que si no, pone su propio default). Fija la NDK a
// 26.1.10909125 porque la más nueva (27.x) rompe el LINK contra el AAR
// prebuilt de react-android-0.81.5 (símbolos como "operator new"/std::bad_alloc
// no resueltos — mezcla de toolchains de libc++ entre el AAR y el código
// nuevo). Confirmado a mano probando ambas versiones al armar el APK release.
//
// Con 26.1 aparece un problema DISTINTO al compilar (no al enlazar): un
// header interno de React Native (graphicsConversions.h, dentro del AAR)
// usa std::format, que el libc++ de esta NDK no trae completo. El fix vive
// FUERA de este repo — hay que editar a mano el header ya extraído en:
//   ~/.gradle/caches/<version>/transforms/<hash>/transformed/
//     react-android-0.81.5-release/prefab/modules/reactnative/include/
//     react/renderer/core/graphicsConversions.h
// cambiando `std::format("{}%", dimension.value)` por
// `std::to_string(dimension.value) + "%"`. Si algún día se limpia el caché
// de Gradle (o se compila en otra máquina) hay que volver a aplicar este
// parche antes de correr `assembleRelease`.
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
