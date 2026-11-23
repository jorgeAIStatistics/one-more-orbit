import type { CapacitorConfig } from '@capacitor/cli';

// The App Store build. Everything the game needs is copied from dist/ into the app: nothing is loaded from the web.
const config: CapacitorConfig = {
  appId: 'com.jorgeaistatistics.onemoreorbit', // the bundle ID: must match the one registered in App Store Connect
  appName: 'One More Orbit',
  webDir: 'dist',
  backgroundColor: '#05060f',
  ios: {
    contentInset: 'never', // the game handles the notch and home bar itself (CSS safe areas)
    backgroundColor: '#05060f',
    scrollEnabled: false,
    allowsLinkPreview: false
  }
};

export default config;
