import { useEffect } from "react";
import { usePrefs } from "@/lib/use-prefs";

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
};

/** Status-bar color follows the paper, including inside an installed app. */
export function ThemeColor() {
  const { prefs } = usePrefs();
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#f3efe4";
    document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
      node.setAttribute("content", color);
    });
  }, [prefs.theme]);
  return null;
}

/**
 * No-ops in the browser. Inside the store shell it matches the status bar,
 * hides the splash, and lets the Android back button walk the reader.
 */
export function NativeShell() {
  const { prefs } = usePrefs();
  useEffect(() => {
    const cap = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const night = prefs.theme === "night";
    void import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: night ? Style.Dark : Style.Light }))
      .catch(() => {});
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {});
  }, [prefs.theme]);

  useEffect(() => {
    const cap = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    let remove = () => {};
    let live = true;
    void import("@capacitor/app")
      .then(({ App }) => {
        if (!live) return;
        const handle = App.addListener("backButton", () => {
          if (window.history.length > 1) window.history.back();
          else void App.exitApp();
        });
        remove = () => {
          void handle.then((listener) => listener.remove());
        };
      })
      .catch(() => {});
    void import("@capacitor/keyboard")
      .then(({ Keyboard }) => Keyboard.setAccessoryBarVisible({ isVisible: false }))
      .catch(() => {});
    return () => {
      live = false;
      remove();
    };
  }, []);

  return null;
}
