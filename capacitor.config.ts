
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poelys.music',
  appName: 'Poelys',
  webDir: 'www',
  server: {
    url: 'https://poelys.vercel.app',
    cleartext: false
  }
};

export default config;
