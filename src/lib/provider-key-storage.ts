import { AGENT_STORE } from "@/lib/agent";

function removeLegacyKey(): string {
  try {
    // Never read or silently migrate the old persistent credential.
    localStorage.removeItem(AGENT_STORE);
    return "";
  } catch {
    return "Your browser blocked removal of an old device-saved provider key. It was not read or copied.";
  }
}

function notices(...messages: string[]) {
  return messages.filter(Boolean).join(" ");
}

export function restoreSessionProviderKey() {
  const legacy = removeLegacyKey();
  try {
    return { key: sessionStorage.getItem(AGENT_STORE) || "", notice: legacy };
  } catch {
    return {
      key: "",
      notice: notices(
        legacy,
        "Session storage is unavailable. Studio is disconnected; reading still works.",
      ),
    };
  }
}

export function saveSessionProviderKey(key: string) {
  const legacy = removeLegacyKey();
  try {
    sessionStorage.setItem(AGENT_STORE, key);
    return { ok: true, notice: legacy };
  } catch {
    let removal = "";
    try {
      sessionStorage.removeItem(AGENT_STORE);
    } catch {
      removal =
        "Your browser also blocked removal of a previous session key; it may return after refresh.";
    }
    return {
      ok: false,
      notice: notices(
        legacy,
        "The key could not be saved for this tab. Studio is disconnected; reading still works.",
        removal,
      ),
    };
  }
}

export function clearSessionProviderKey() {
  const legacy = removeLegacyKey();
  try {
    sessionStorage.removeItem(AGENT_STORE);
    return { ok: true, notice: legacy };
  } catch {
    return {
      ok: false,
      notice: notices(
        legacy,
        "Studio is disconnected, but your browser blocked removal of the session key; it may return after refresh.",
      ),
    };
  }
}
