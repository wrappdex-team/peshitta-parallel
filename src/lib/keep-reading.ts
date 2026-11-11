/** Keeps a reading session awake, and offers a corner card over other apps. */

export type ReadingCard = {
  text: string;
  place: string;
  /** A line spoken by Y'shua. Drawn in red and marked. */
  red?: boolean;
};

export type ReadingHold = {
  release: () => void;
  corner: () => Promise<void>;
  caption: (card: ReadingCard) => void;
};

type Controls = {
  onPause: () => void;
  onPlay: () => void;
};

type CornerVideo = HTMLVideoElement & { autoPictureInPicture?: boolean };

const TITLE = "Injeel-Goodnews";

export function holdReading(controls: Controls): ReadingHold {
  let done = false;
  let sentinel: WakeLockSentinel | null = null;
  let video: CornerVideo | null = null;
  let bed: HTMLAudioElement | null = null;
  let bedUrl = "";
  let audio: AudioContext | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseWait: number | null = null;
  let wakeTimer: number | null = null;
  let pinned = false;
  let caption = "Reading";
  let place = "";
  let red = false;

  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, 480, 270);
    ctx.fillStyle = "#f3efe4";
    ctx.fillRect(0, 0, 480, 270);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#7a2e38";
    ctx.font = "600 26px Palatino, serif";
    ctx.fillText(TITLE, 240, 42);
    let y = 74;
    if (red) {
      ctx.fillStyle = "#9b2335";
      ctx.font = "600 18px Palatino, serif";
      ctx.fillText("Words of Y'shua", 240, y);
      y = 102;
    }
    if (place) {
      ctx.fillStyle = "#8d6b32";
      ctx.font = "600 20px Palatino, serif";
      ctx.fillText(place, 240, y);
      y += 36;
    }
    ctx.fillStyle = red ? "#9b2335" : "#1c1612";
    ctx.font = "22px Palatino, serif";
    const words = caption.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 420 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    for (const row of lines) {
      if (y > 250) break;
      ctx.fillText(row, 240, y);
      y += 30;
    }
    ctx.textAlign = "left";
  }

  function label() {
    const session = navigator.mediaSession;
    if (!session || typeof MediaMetadata !== "function") return;
    try {
      session.metadata = new MediaMetadata({
        title: TITLE,
        artist: red ? `Words of Y'shua · ${place || "Reading"}` : place || "Reading",
      });
    } catch {
      // The lock screen can keep the previous title.
    }
  }

  function quietWav() {
    const rate = 8000;
    const n = rate;
    const bytes = new Uint8Array(44 + n * 2);
    const view = new DataView(bytes.buffer);
    const mark = (at: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i);
    };
    mark(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    mark(8, "WAVE");
    mark(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    mark(36, "data");
    view.setUint32(40, n * 2, true);
    // A low tone, not a silent file. Android drops silent audio when the screen locks.
    for (let i = 0; i < n; i += 1) {
      const sample = Math.sin((2 * Math.PI * 35 * i) / rate);
      view.setInt16(44 + i * 2, Math.round(sample * 900), true);
    }
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  }

  function ensureBed() {
    if (bed || done || typeof document?.createElement !== "function") return;
    try {
      bedUrl = quietWav();
      const element = document.createElement("audio");
      element.src = bedUrl;
      element.loop = true;
      element.preload = "auto";
      element.setAttribute("playsinline", "");
      // Quiet while the page is open. Louder only after the screen locks, so the phone keeps the session.
      element.volume = 0.02;
      element.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
      let lastBed = 0;
      element.addEventListener("pause", () => {
        // Opening the phone pauses this session by itself. Put it back unless the reader was released.
        if (done || !bed) return;
        const now = Date.now();
        if (now - lastBed < 1000) return;
        lastBed = now;
        void bed.play().catch(() => {});
      });
      document.body.appendChild(element);
      bed = element;
      void element.play().catch(() => {});
    } catch {
      bed = null;
    }
  }

  function holdSession() {
    if (!bed || done) return;
    bed.volume = document.visibilityState === "hidden" ? 0.35 : 0.02;
    void bed.play().catch(() => {});
  }

  function ensureCorner() {
    if (video || done) return;
    if (typeof document?.createElement !== "function" || typeof HTMLCanvasElement === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 270;
    ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") return;
    paint();
    const stream = canvas.captureStream(2);
    try {
      const Context = window.AudioContext;
      if (Context) {
        audio = new Context();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        gain.gain.value = 0.0001;
        const dest = audio.createMediaStreamDestination();
        osc.frequency.value = 220;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
        void audio.resume();
      }
    } catch {
      // The corner card can still show without a silent audio track.
    }
    const element = document.createElement("video") as CornerVideo;
    element.srcObject = stream;
    element.playsInline = true;
    element.muted = false;
    element.autoplay = true;
    element.autoPictureInPicture = true;
    element.setAttribute("playsinline", "");
    element.setAttribute("webkit-playsinline", "");
    element.style.cssText = "position:fixed;width:2px;height:2px;opacity:0.02;pointer-events:none;left:0;bottom:0";
    document.body.appendChild(element);
    video = element;
    void element.play().catch(() => {});
  }

  async function corner() {
    if (done) return;
    // Asked from the tap, before any wait, so the phone accepts the screen lock.
    pinned = true;
    void screen();
    arm();
    ensureCorner();
    if (!video) return;
    try {
      await video.play();
    } catch {
      // A later tap on Corner can start it.
    }
    const host = document as Document & { pictureInPictureEnabled?: boolean; pictureInPictureElement?: Element | null };
    if (!host.pictureInPictureEnabled || host.pictureInPictureElement) return;
    try {
      await video.requestPictureInPicture();
    } catch {
      // This browser will not float a card over other apps.
    }
  }

  function arm() {
    if (wakeTimer !== null || typeof window.setInterval !== "function") return;
    wakeTimer = window.setInterval(() => {
      if (done || !pinned) return;
      if (document.visibilityState === "visible" && !sentinel) void screen();
      if (video?.paused) void video.play().catch(() => {});
    }, 15000);
  }

  async function screen() {
    if (done || sentinel || !navigator.wakeLock?.request) return;
    if (document.visibilityState === "hidden") return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (done) {
        void lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      lock.addEventListener("release", () => {
        if (sentinel === lock) sentinel = null;
        // The phone drops the lock on its own. Take it back while Corner is on.
        if (!done && pinned && document.visibilityState === "visible") {
          window.setTimeout(() => {
            if (!done && pinned && !sentinel) void screen();
          }, 1000);
        }
      });
    } catch {
      sentinel = null;
    }
  }

  function media() {
    const session = navigator.mediaSession;
    if (!session) return;
    try {
      label();
      session.playbackState = "playing";
      // The phone sends a pause action when the screen opens. Wait, and drop it if the page is back.
      session.setActionHandler("pause", () => {
        if (pauseWait !== null) return;
        pauseWait = window.setTimeout(() => {
          pauseWait = null;
          if (done || document.visibilityState === "visible") return;
          controls.onPause();
        }, 500);
      });
      session.setActionHandler("play", () => {
        if (pauseWait !== null) {
          window.clearTimeout(pauseWait);
          pauseWait = null;
        }
        controls.onPlay();
      });
    } catch {
      // The lock-screen controls are optional.
    }
  }

  function onVisibility() {
    if (done) return;
    if (document.visibilityState === "visible" && pauseWait !== null) {
      window.clearTimeout(pauseWait);
      pauseWait = null;
    }
    holdSession();
    if (document.visibilityState === "visible") void screen();
  }

  void screen();
  media();
  ensureBed();
  document.addEventListener("visibilitychange", onVisibility);

  return {
    caption(card: ReadingCard) {
      caption = card.text.trim() || "Reading";
      place = card.place.trim();
      red = card.red === true;
      paint();
      label();
    },
    corner,
    release() {
      if (done) return;
      done = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (pauseWait !== null) window.clearTimeout(pauseWait);
      pauseWait = null;
      if (wakeTimer !== null) window.clearInterval(wakeTimer);
      wakeTimer = null;
      pinned = false;
      void sentinel?.release().catch(() => {});
      sentinel = null;
      try {
        if (navigator.mediaSession) {
          navigator.mediaSession.playbackState = "none";
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
        }
      } catch {
        // Already cleared.
      }
      const host = document as Document & { pictureInPictureElement?: Element | null };
      if (video && host.pictureInPictureElement === video) void document.exitPictureInPicture?.().catch(() => {});
      video?.pause();
      video?.remove();
      video = null;
      bed?.pause();
      bed?.remove();
      bed = null;
      if (bedUrl) URL.revokeObjectURL(bedUrl);
      bedUrl = "";
      ctx = null;
      void audio?.close().catch(() => {});
      audio = null;
    },
  };
}
