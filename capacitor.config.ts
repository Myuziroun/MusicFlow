import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musiclistener.musicflow',
  appName: 'MusicFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    Filesystem: {
      // Configure file permissions and storage roots
    }
  }
};

export default config;
