import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gamenxo.tenisclash',
  appName: 'Nxo Games',
  webDir: 'dist',
  android: {
    backgroundColor: '#000000',
    // multijugador LAN: la app (https://localhost) se conecta por ws:// a la IP del PC. Solo para pruebas en red
    // local; con el backend en Render (https/wss) se puede volver a false. (Manifest: usesCleartextTraffic)
    allowMixedContent: true,
  },
};

export default config;
