import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.71d8fb34d8b1410c92451ae533ed56ca',
  appName: 'alert-buddy-express',
  webDir: 'dist',
  server: {
    url: 'https://71d8fb34-d8b1-410c-9245-1ae533ed56ca.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
