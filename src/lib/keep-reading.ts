/** Keeps a reading session awake, and offers a corner card over other apps. */

export type ReadingCard = {
  text: string;
  place: string;
};

export type ReadingHold = {
  release: () => void;
  corner: () => Promise<void>;
  caption: (card: ReadingCard) => void;
};

type Controls = {
  onPause: () => void;
  onPlay: () => void;
  onBack: () => void;
};

type CornerVideo = HTMLVideoElement & { autoPictureInPicture?: boolean };

const TITLE = "Injeel-Goodnews";

export function holdReading(controls: Controls): ReadingHold {
  let done = false;
  let sentinel: WakeLockSentinel | null = null;
  let video: CornerVideo | null = null;
  let audio: AudioContext | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let caption = "Reading";
  let place = "";

  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, 480, 270);
    ctx.fillStyle = "#f3efe4";
    ctx.fillRect(0, 0, 480, 270);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#7a2e38";
    ctx.font = "600 26px Palatino, serif";
    ctx.fillText(TITLE, 240, 46);
    ctx.fillStyle = "#8d6b32";
    ctx.font = "600 20px Palatino, serif";
    if (place) ctx.fillText(place, 240, 80);
    ctx.fillStyle = "#1c1612";
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
    let y = place ? 122 : 108;
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
      session.metadata = new MediaMetadata({ title: TITLE, artist: place || "Reading" });
    } catch {
      // The lock screen can keep the previous title.
    }
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
    element.autoplay = true;
    element.autoPictureInPicture = true;
    element.setAttribute("playsinline", "");
    element.style.cssText = "position:fixed;width:2px;height:2px;opacity:0.02;pointer-events:none;left:0;bottom:0";
    document.body.appendChild(element);
    video = element;
    void element.play().catch(() => {});
  }

  async function corner() {
    if (done) return;
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

  async function screen() {
    if (done || !navigator.wakeLock?.request) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
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
      session.setActionHandler("pause", () => controls.onPause());
      session.setActionHandler("play", () => controls.onPlay());
      session.setActionHandler("seekbackward", () => controls.onBack());
    } catch {
      // The lock-screen controls are optional.
    }
  }

  function onVisibility() {
    if (done) return;
    if (document.visibilityState === "hidden") void corner();
    else void screen();
  }

  void screen();
  media();
  ensureCorner();
  document.addEventListener("visibilitychange", onVisibility);

  return {
    caption(card: ReadingCard) {
      caption = card.text.trim() || "Reading";
      place = card.place.trim();
      paint();
      label();
    },
    corner,
    release() {
      if (done) return;
      done = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
      try {
        if (navigator.mediaSession) {
          navigator.mediaSession.playbackState = "none";
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
        }
      } catch {
        // Already cleared.
      }
      const host = document as Document & { pictureInPictureElement?: Element | null };
      if (video && host.pictureInPictureElement === video) void document.exitPictureInPicture?.().catch(() => {});
      video?.pause();
      video?.remove();
      video = null;
      ctx = null;
      void audio?.close().catch(() => {});
      audio = null;
    },
  };
}
