/** Canonical public origin. The previous Vercel host stays live as an alias. */
export const SITE_ORIGIN = "https://injeel.news";

export const LEGACY_ORIGIN = "https://peshitta-parallel.vercel.app";

/** Hosts that serve this app. Credentialed auth must accept every one of them. */
export const SITE_ALIASES = [SITE_ORIGIN, "https://www.injeel.news", LEGACY_ORIGIN] as const;

export const SITE_NAME = "Injeel";

export const SITE_DESCRIPTION =
  "Injeel. The words of Y'shua, kept. The Peshitta New Testament in classical Syriac, read beside English, contemporary Greek, contemporary Hebrew, Arabic, French, Russian, and more.";
