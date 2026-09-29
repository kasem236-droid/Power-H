import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.powerh.app',
  appName: 'Power H',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#f8fafc',
  },
};

export default config;
