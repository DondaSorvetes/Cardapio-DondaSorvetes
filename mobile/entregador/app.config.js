/**
 * Completa o app.json: o número de build (Android versionCode / iOS buildNumber)
 * sai da versão, então basta subir "version" no app.json para publicar.
 * 1.2.3 → 10203. Precisa sempre aumentar, senão o Android recusa a atualização.
 */
module.exports = ({ config }) => {
  const [major, minor, patch] = String(config.version).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const build = major * 10000 + minor * 100 + patch;
  return {
    ...config,
    android: { ...config.android, versionCode: build },
    ios: { ...config.ios, buildNumber: String(build) },
  };
};
