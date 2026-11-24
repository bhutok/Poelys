import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.khisbul.poelys',
  appName: 'Poelys',
  webDir: 'out',
  server: {
    url: 'https://poelys.vercel.app',
    cleartext: false
  }
};

export default config;
