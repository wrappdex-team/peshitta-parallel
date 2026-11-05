import { useEffect, useState } from "react";
import { AGENT_STORE, detectAgent } from "@/lib/agent";
import { checkVideo, makeAudio, makeImage, shapePrompt, startVideo, type StudioKind } from "@/lib/studio";

const AGENT_KEY = AGENT_STORE;
const STUDIO_KEY = "injeel-studio";
const STYLES = ["Manuscript gold", "Quiet watercolor", "Night and lamp", "Eastern icon light", "Open landscape"];
const VOICES = ["ara", "rex", "eve", "leo", "luna", "orion", "aurora", "atlas", "iris", "helios"];
const TONGUES = [
  "English", "Spanish", "Spanish (Mexico)", "Chinese", "French", "German", "Japanese", "Korean",
  "Arabic", "Hindi", "Portuguese", "Russian", "Italian", "Turkish", "Vietnamese", "Bengali",
  "Indonesian", "Syriac", "Sureth", "Swahili", "Amharic", "Greek", "Latin", "Hebrew", "Dutch",
  "Polish", "Swedish", "Ukrainian", "Persian", "Urdu", "Thai", "Tamil", "Malayalam",
];

type Props = {
  open: boolean;
  passage: string;
  onClose: () => void;
};

export function Studio({ open, passage, onClose }: Props) {
  const [kind, setKind] = useState<StudioKind>("image");
  const [style, setStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [audio, setAudio] = useState("");
  const [agent, setAgent] = useState("");
  const [draft, setDraft] = useState("");
  const [tongue, setTongue] = useState("English");
  const [customTongue, setCustomTongue] = useState("");
  const [voice, setVoice] = useState("ara");
  const [customVoice, setCustomVoice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(AGENT_KEY) || "";
    setAgent(saved);
    setDraft("");
    try {
      const prefs = JSON.parse(localStorage.getItem(STUDIO_KEY) || "{}") as Partial<{
        kind: StudioKind;
        style: string;
        tongue: string;
        voice: string;
      }>;
      if (prefs.kind) setKind(prefs.kind);
      if (typeof prefs.style === "string") setStyle(prefs.style);
      if (prefs.tongue) setTongue(prefs.tongue);
      if (prefs.voice) setVoice(prefs.voice);
    } catch {
      /* keep defaults */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    localStorage.setItem(STUDIO_KEY, JSON.stringify({ kind, style, tongue, voice }));
  }, [open, kind, style, tongue, voice]);

  useEffect(() => {
    if (!open) return;
    setPrompt("");
    setImage("");
    setVideo("");
    setAudio("");
    setStatus("");
  }, [open, passage]);

  if (!open) return null;

  const language = customTongue.trim() || tongue;
  const voiceId = customVoice.trim() || voice;
  const connected = detectAgent(agent);

  function saveAgent() {
    const next = draft.trim();
    if (next && !detectAgent(next)) {
      setStatus("That key was not recognized. Use an xAI key (xai-), an OpenAI key (sk-), or a Claude key (sk-ant-).");
      return;
    }
    if (next) localStorage.setItem(AGENT_KEY, next);
    else localStorage.removeItem(AGENT_KEY);
    setAgent(next);
    setDraft("");
    setStatus(next ? "Your agent is connected. Studio calls use it." : "Disconnected. The site agent will be used.");
  }

  async function shape() {
    setBusy(true);
    setStatus("Shaping a prompt from the passage…");
    try {
      const result = await shapePrompt({ data: { text: passage, style, kind, language, agentKey: agent } });
      setBusy(false);
      if (!result.ok) return setStatus(result.error);
      setPrompt(result.prompt);
      setStatus("You can change the prompt before making it.");
    } catch {
      setBusy(false);
      setStatus("The prompt could not be shaped.");
    }
  }

  async function make() {
    setBusy(true);
    setImage("");
    setVideo("");
    setAudio("");
    try {
      if (kind === "image") {
        setStatus("Making the still…");
        const result = await makeImage({ data: { prompt: prompt || passage, agentKey: agent } });
        setBusy(false);
        if (!result.ok) return setStatus(result.error);
        setImage(result.src);
        setStatus("Still is ready.");
        return;
      }
      if (kind === "audio") {
        setStatus(`Translating into ${language} and making the voice…`);
        const result = await makeAudio({ data: { text: prompt || passage, voice: voiceId, language, agentKey: agent } });
        setBusy(false);
        if (!result.ok) return setStatus(result.error);
        setAudio(result.src);
        setStatus("Voice is ready.");
        return;
      }
      setStatus("Starting a short film…");
      const started = await startVideo({ data: { prompt: prompt || passage, agentKey: agent } });
      if (!started.ok) {
        setBusy(false);
        setStatus(started.error);
        return;
      }
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const checked = await checkVideo({ data: { requestId: started.requestId, agentKey: agent } });
        if (!checked.ok) {
          setBusy(false);
          setStatus(checked.error);
          return;
        }
        if (checked.status === "done") {
          setVideo(checked.src);
          setBusy(false);
          setStatus("Film is ready.");
          return;
        }
        setStatus("The film is still being made…");
      }
      setBusy(false);
      setStatus("The film is taking longer than expected. Try again in a moment.");
    } catch {
      setBusy(false);
      setStatus("That call did not finish. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim sm:items-center" onClick={onClose}>
      <section
        className="max-h-sheet w-full max-w-xl overflow-y-auto border border-line bg-paper p-5 pb-safe"
        onClick={(event) => event.stopPropagation()}
        aria-label="Studio"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-gold">STUDIO</p>
            <h2 className="font-serif text-2xl">From these words</h2>
          </div>
          <button type="button" className="min-h-11 px-2 text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-3 border-l-2 border-gold pl-3 text-sm leading-relaxed text-muted">{passage || "Highlight a line on the page, then open the studio."}</p>

        <div className="mt-4 border border-line p-3">
          <p className="text-xs tracking-widest text-gold">{connected ? "YOUR AGENT" : "CONNECT YOUR AGENT"}</p>
          <p className="mt-1 text-sm text-muted">
            {connected ? `Connected to ${connected.kind === "xai" ? "xAI" : connected.kind === "openai" ? "OpenAI" : "Claude"}. The key stays on this device.` : "Paste an xAI, OpenAI, or Claude key. The reader and the studio will use it. The key stays on this device."}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={connected ? "Replace key" : "xai-… or sk-…"}
              className="min-h-11 flex-1 border border-line bg-raised px-3 text-ink"
              autoComplete="off"
            />
            <button type="button" disabled={!draft.trim()} className="min-h-11 bg-garnet px-3 text-paper disabled:opacity-40" onClick={saveAgent}>
              Save
            </button>
            {connected && (
              <button
                type="button"
                className="min-h-11 px-2 text-garnet"
                onClick={() => {
                  localStorage.removeItem(AGENT_KEY);
                  setAgent("");
                  setStatus("Disconnected.");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {(["image", "video", "audio"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
              className={`min-h-11 px-3 ${kind === item ? "bg-garnet text-paper" : "border border-line"}`}
            >
              {item === "image" ? "Still" : item === "video" ? "Film" : "Voice"}
            </button>
          ))}
        </div>

        {kind === "audio" && (
          <div className="mt-3 grid gap-2">
            <label className="text-sm text-muted">
              Tongue
              <select value={tongue} onChange={(event) => setTongue(event.target.value)} className="mt-1 w-full border border-line bg-raised px-3 py-2 text-ink">
                {TONGUES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <input
              value={customTongue}
              onChange={(event) => setCustomTongue(event.target.value)}
              placeholder="Or type any language"
              className="min-h-11 border border-line bg-raised px-3 text-ink"
            />
            <label className="text-sm text-muted">
              Voice
              <select value={voice} onChange={(event) => setVoice(event.target.value)} className="mt-1 w-full border border-line bg-raised px-3 py-2 text-ink">
                {VOICES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={customVoice}
              onChange={(event) => setCustomVoice(event.target.value)}
              placeholder="Optional: your own voice ID from the xAI console"
              className="min-h-11 border border-line bg-raised px-3 text-ink"
            />
            <p className="text-xs text-muted">
              Built-in voices speak the main languages well. Other tongues are translated, then spoken as the model can. A celebrity voice is not available; use a voice you own.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {STYLES.map((item) => (
            <button key={item} type="button" className="min-h-11 border border-line px-2 text-sm text-muted" onClick={() => setStyle(item)}>
              {item}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm text-muted">
          Your style or idea
          <input
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            placeholder="A quiet lamp, gold edge, no faces"
            className="mt-1 w-full border border-line bg-raised px-3 py-2 text-ink"
          />
        </label>
        <label className="mt-3 block text-sm text-muted">
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            placeholder="Leave this empty and the studio will shape one from the passage."
            className="mt-1 w-full border border-line bg-raised px-3 py-2 text-ink"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !passage} onClick={shape} className="min-h-11 border border-garnet px-4 text-garnet disabled:opacity-40">
            Shape the prompt
          </button>
          <button type="button" disabled={busy || !passage} onClick={make} className="min-h-11 bg-garnet px-4 text-paper disabled:opacity-40">
            Make {kind === "image" ? "the still" : kind === "video" ? "the film" : "the voice"}
          </button>
        </div>
        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
        {image && (
          <div className="mt-4">
            <img src={image} alt="Studio still from the passage" className="w-full border border-line" />
            <a href={image} download="injeel-still.png" className="mt-2 inline-flex min-h-11 items-center text-garnet">
              Save the still
            </a>
          </div>
        )}
        {video && (
          <div className="mt-4">
            <video src={video} controls className="w-full border border-line" />
            <a href={video} download="injeel-film.mp4" className="mt-2 inline-flex min-h-11 items-center text-garnet">
              Save the film
            </a>
          </div>
        )}
        {audio && (
          <div className="mt-4">
            <audio src={audio} controls className="w-full" />
            <a href={audio} download="injeel-voice.mp3" className="mt-2 inline-flex min-h-11 items-center text-garnet">
              Save the voice
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
