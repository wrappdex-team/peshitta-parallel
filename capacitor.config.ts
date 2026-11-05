import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Store shells open the published site so the voice, which lives on the server,
 * keeps working. Set CAPACITOR_SERVER_URL to that address before a store build.
 * Without it, the native project shows the offline page in native/www.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.posteklabs.injeel",
  appName: "Injeel",
  webDir: "native/www",
  backgroundColor: "#f3efe4",
  android: {
    backgroundColor: "#f3efe4",
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: "#f3efe4",
    contentInset: "automatic",
  },
  server: serverUrl
    ? { url: serverUrl, cleartext: false, androidScheme: "https" }
    : { androidScheme: "https" },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#f3efe4",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#f3efe4",
    },
  },
};

export default config;
