import { Modal } from "@/components/modal";
import { useEffect, useRef, useState } from "react";
import { cloudflareHint, detectAgent, normalizeProviderKey, providerName, type AgentKind } from "@/lib/agent";
import { clearSessionProviderKey, restoreSessionProviderKey, saveSessionProviderKey } from "@/lib/provider-key-storage";
import { modelsFor, supportsTask } from "@/lib/studio-models";
import { checkProvider, checkVideo, makeAudio, makeImage, shapePrompt, startVideo, type StudioKind } from "@/lib/studio";

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

function taskOf(kind: StudioKind) {
  return kind;
}

function limitLine(kind: AgentKind) {
  switch (kind) {
    case "openrouter":
      return "Free shaping only. OpenRouter usually allows 20 requests a minute and 50 a day until you buy credits.";
    case "groq":
      return "Free shaping only. Groq’s free plan is limited per model, often about 30 a minute and 1,000 a day.";
    case "gemini":
      return "Free shaping only. The free tier is rate-limited, and Google may use those prompts to improve its products.";
    case "cloudflare":
      return "Free stills and shaping. Workers AI includes about 10,000 neurons a day, reset at 00:00 UTC. This app allows 4 stills each 10 minutes.";
    case "anthropic":
      return "Claude shapes the prompt. Stills need xAI, OpenAI, or Cloudflare. Films need xAI. Voices need xAI or OpenAI.";
    case "openai":
      return "OpenAI can shape, make stills, and speak. Films need an xAI key. Charges apply.";
    case "xai":
      return "xAI can shape, make stills, films, and voices. Imagine 2.0 and Video 1.5 are the highest options. Charges apply.";
  }
}

function blockLine(kind: AgentKind, task: StudioKind) {
  if (supportsTask(kind, task)) return "";
  if (task === "video") return "Film needs an xAI key. This key can still shape the prompt.";
  if (task === "audio") return "A generated voice needs your own xAI or OpenAI key. Device Read needs no key. This key can still shape the words.";
  return "A still needs your own xAI key, OpenAI key, or Cloudflare token. This key can still shape the prompt.";
}

function FreePaths() {
  return (
    <div className="mt-2 grid gap-3 text-sm leading-relaxed text-muted">
      <p>
        <span className="text-ink">OpenRouter — shape, free.</span> Make a key at{" "}
        <a className="text-garnet underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>
        {" "}and paste the sk-or- key. The free router picks a $0 model (
        <a className="text-garnet underline" href="https://openrouter.ai/models?max_price=0" target="_blank" rel="noreferrer">see the list</a>
        ). Usual cap: 20 a minute and 50 a day, until you buy credits.
      </p>
      <p>
        <span className="text-ink">Groq — shape, free.</span> Make a gsk_ key at{" "}
        <a className="text-garnet underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>
        . Fast. Each model has its own free-plan limit, often about 30 a minute and 1,000 a day.
      </p>
      <p>
        <span className="text-ink">Gemini — shape, free.</span> Make a key at{" "}
        <a className="text-garnet underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>
        . New keys start with AQ. Older keys start with AIza. Free tier only. Google may use those prompts to improve its products.
      </p>
      <p>
        <span className="text-ink">Cloudflare — shape and stills, free.</span> Copy the 32-character Account ID from the Workers AI page. Create a token at{" "}
        <a className="text-garnet underline" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">API tokens</a>
        {" "}with Workers AI permission. The token starts with cfut_ or cfat_. Paste the token here, and the account id in the account field. Choose Still. The model is FLUX.1 schnell. About 10,000 neurons a day, reset at 00:00 UTC, and this app allows 4 stills each 10 minutes.
      </p>
      <p>Device Read speaks the passage with no key. Films, and the highest stills, need a paid xAI or OpenAI key.</p>
    </div>
  );
}

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
  const [accountDraft, setAccountDraft] = useState("");
  const [keyNotice, setKeyNotice] = useState("");
  const [tongue, setTongue] = useState("English");
  const [customTongue, setCustomTongue] = useState("");
  const [voice, setVoice] = useState("ara");
  const [customVoice, setCustomVoice] = useState("");
  const [shapeModel, setShapeModel] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const passageActivity = useRef({ active: false });

  useEffect(() => {
    const activity = { active: true };
    passageActivity.current = activity;
    return () => { activity.active = false; };
  }, [passage]);

  useEffect(() => {
    const restored = restoreSessionProviderKey();
    setDraft("");
    if (!open) {
      setAgent("");
      setKeyNotice("");
      return;
    }
    setAgent(restored.key);
    setKeyNotice(restored.notice);
    try {
      const prefs = JSON.parse(localStorage.getItem(STUDIO_KEY) || "{}") as Partial<{
        kind: StudioKind;
        style: string;
        tongue: string;
        voice: string;
        shapeModel: string;
        makeModel: string;
      }>;
      if (prefs.kind) setKind(prefs.kind);
      if (typeof prefs.style === "string") setStyle(prefs.style);
      if (prefs.tongue) setTongue(prefs.tongue);
      if (prefs.voice) setVoice(prefs.voice);
      if (typeof prefs.shapeModel === "string") setShapeModel(prefs.shapeModel);
      if (typeof prefs.makeModel === "string") setMakeModel(prefs.makeModel);
    } catch {
      /* keep defaults */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(STUDIO_KEY, JSON.stringify({ kind, style, tongue, voice, shapeModel, makeModel }));
    } catch {
      /* Nonsecret preferences are optional when browser storage is denied. */
    }
  }, [open, kind, style, tongue, voice, shapeModel, makeModel]);

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
  const shapeChoices = connected ? modelsFor(connected.kind, "shape") : [];
  const makeChoices = connected ? modelsFor(connected.kind, taskOf(kind)) : [];
  const shapeId = shapeChoices.some((model) => model.id === shapeModel) ? shapeModel : shapeChoices[0]?.id ?? "";
  const makeId = makeChoices.some((model) => model.id === makeModel) ? makeModel : makeChoices[0]?.id ?? "";
  const shapeNote = shapeChoices.find((model) => model.id === shapeId)?.note ?? "";
  const makeNote = makeChoices.find((model) => model.id === makeId)?.note ?? "";
  const canMake = connected ? supportsTask(connected.kind, taskOf(kind)) : false;
  const prepared = normalizeProviderKey(draft, accountDraft);
  const preview = prepared ? detectAgent(prepared) : null;
  const cfHint = cloudflareHint(draft);

  async function saveAgent() {
    const next = prepared;
    if (next && cfHint === "global") {
      setStatus("That is a Cloudflare global key. Create an API token instead. It starts with cfut_ or cfat_.");
      return;
    }
    if (next && cfHint === "token" && !preview) {
      setStatus("That Cloudflare token is the right shape. Add the 32-character account id from the Workers AI page, then save.");
      return;
    }
    if (next && !preview) {
      setStatus("That key was not recognized. Free keys look like sk-or-v1-…, gsk_…, AQ.…, or cfut_… with the Cloudflare account id.");
      return;
    }
    const saved = next ? saveSessionProviderKey(next) : clearSessionProviderKey();
    setAgent(saved.ok ? next : "");
    setKeyNotice(saved.notice);
    if (!saved.ok || !next) {
      setStatus("Disconnected. Add your own provider key to use Studio.");
      return;
    }
    setDraft("");
    setAccountDraft("");
    setStatus("Checking that key with the provider…");
    try {
      const checked = await checkProvider({ data: { agentKey: next } });
      setStatus(checked.ok ? `${checked.detail} Saved for this tab.` : checked.error);
    } catch {
      setStatus("Provider key saved for this tab. Studio requests use your key.");
    }
  }

  // A completed request belongs to the passage it started from, even A → B → A.
  // Do not cancel/resubmit provider work or release busy early on navigation.
  function passageUpdates() {
    const activity = passageActivity.current;
    return (update: () => void) => { if (activity.active) update(); };
  }

  async function shape() {
    if (!connected) return setStatus("Add your own provider key to use Studio.");
    const publish = passageUpdates();
    setBusy(true);
    setStatus("Shaping a prompt from the passage…");
    try {
      const result = await shapePrompt({ data: { text: passage, style, kind, language, agentKey: agent, model: shapeId } });
      publish(() => {
        if (!result.ok) return setStatus(result.error);
        setPrompt(result.prompt);
        setStatus("You can change the prompt before making it.");
      });
    } catch {
      publish(() => setStatus("The prompt could not be shaped."));
    } finally {
      if (passageActivity.current.active) setBusy(false);
    }
  }

  async function make() {
    if (!connected) return setStatus("Add your own provider key to use Studio.");
    if (!canMake) return setStatus(blockLine(connected.kind, kind) || "This key cannot make that.");
    const publish = passageUpdates();
    setBusy(true);
    setImage("");
    setVideo("");
    setAudio("");
    try {
      if (kind === "image") {
        setStatus("Making the still…");
        const result = await makeImage({ data: { prompt: prompt || passage, agentKey: agent, model: makeId } });
        publish(() => {
          if (!result.ok) return setStatus(result.error);
          setImage(result.src);
          setStatus("Still is ready.");
        });
        return;
      }
      if (kind === "audio") {
        setStatus(`Translating into ${language} and making the voice…`);
        const result = await makeAudio({ data: { text: prompt || passage, voice: voiceId, language, agentKey: agent, model: makeId } });
        publish(() => {
          if (!result.ok) return setStatus(result.error);
          setAudio(result.src);
          setStatus("Voice is ready.");
        });
        return;
      }
      setStatus("Starting a short film…");
      const started = await startVideo({ data: { prompt: prompt || passage, agentKey: agent, model: makeId } });
      if (!started.ok) {
        publish(() => setStatus(started.error));
        return;
      }
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const checked = await checkVideo({ data: { requestId: started.requestId, agentKey: agent } });
        if (!checked.ok) {
          publish(() => setStatus(checked.error));
          return;
        }
        if (checked.status === "done") {
          publish(() => {
            setVideo(checked.src);
            setStatus("Film is ready.");
          });
          return;
        }
        publish(() => setStatus("The film is still being made…"));
      }
      publish(() => setStatus("Status checking stopped after 24 checks. The provider may still finish this film. Check your provider before starting another; Make starts a new request."));
    } catch {
      publish(() => setStatus("That call did not finish. Your provider may still process it. Check your provider before making another request."));
    } finally {
      // The original operation still owns busy after a passage change.
      // Only skip this update if this Studio instance has been unmounted.
      if (passageActivity.current.active) setBusy(false);
    }
  }

  return (
    <Modal label="Studio" className="fixed inset-0 z-40 flex items-end justify-center bg-scrim sm:items-center" onClose={onClose}>
      <section
        className="max-h-sheet w-full max-w-xl overflow-y-auto border border-line bg-paper p-5 pb-safe"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-gold">STUDIO · PREMIUM</p>
            <h2 className="font-serif text-2xl">From these words</h2>
          </div>
          <button type="button" className="min-h-11 px-2 text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-3 border-l-2 border-gold pl-3 text-sm leading-relaxed text-muted">{passage || "Highlight a line on the page, then open the studio."}</p>

        <div className="mt-4 border border-line p-3">
          <p className="text-xs tracking-widest text-gold">{connected ? "YOUR PROVIDER KEY" : "YOUR PROVIDER KEY REQUIRED"}</p>
          <p className="mt-1 text-sm text-muted">
            {connected
              ? `${providerName(connected.kind)} key saved for this tab.`
              : "Studio requires your own provider key. Free shaping: OpenRouter, Groq, or Gemini. Free stills: Cloudflare, within its daily limit. Paid studios: xAI, OpenAI, and Claude."}
          </p>
          {connected && <p className="mt-1 text-sm text-muted">{limitLine(connected.kind)}</p>}
          {keyNotice && <p role="status" className="mt-2 text-xs text-garnet">{keyNotice}</p>}
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={connected ? "Replace key" : "sk-or-v1-…, gsk_…, AQ.…, cfut_…"}
              className="min-h-11 flex-1 border border-line bg-raised px-3 text-ink"
              autoComplete="off"
            />
            <button type="button" aria-label="Save provider key for this tab" disabled={!draft.trim()} className="min-h-11 bg-garnet px-3 text-paper disabled:opacity-40" onClick={saveAgent}>
              Save
            </button>
            {connected && (
              <button
                type="button"
                className="min-h-11 px-2 text-garnet"
                onClick={() => {
                  const cleared = clearSessionProviderKey();
                  setAgent("");
                  setDraft("");
                  setAccountDraft("");
                  setKeyNotice(cleared.notice);
                  setStatus(cleared.ok ? "Session provider key removed. Reading and device Read still work." : "Provider key disconnected. Check the storage warning above.");
                }}
              >
                Clear
              </button>
            )}
          </div>
          {(cfHint === "token" || cfHint === "global") && (
            <label className="mt-2 block text-sm text-muted">
              Cloudflare account id
              <input
                value={accountDraft}
                onChange={(event) => setAccountDraft(event.target.value)}
                placeholder="32-character id from Workers AI"
                className="mt-1 w-full min-h-11 border border-line bg-raised px-3 text-ink"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
          {draft.trim().length >= 8 && (
            <p className="mt-2 text-xs text-muted">
              {preview
                ? `Recognized as ${providerName(preview.kind)}.`
                : cfHint === "global"
                  ? "That is a global key. Use a cfut_ or cfat_ token."
                  : cfHint === "token"
                    ? "Cloudflare token. Add the account id."
                    : "Not recognized yet."}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Uses tab-session storage instead of the app's persistent key storage. Refresh normally keeps it; browser restore or tab duplication may preserve or copy session data. This is not secure erasure or XSS protection.
          </p>
          <p className="mt-1 text-xs text-muted">
            Old device-saved keys are removed when storage access permits, never copied; re-enter your key if needed. Keys are sent through this server to your provider for requested Studio work. Provider charges apply on paid keys. Free tiers have their own limits. Reading and device Read need no key.
          </p>
          {connected ? (
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer text-xs tracking-widest text-gold">FREE PATHS, WITH LIMITS</summary>
              <FreePaths />
            </details>
          ) : (
            <div className="mt-3">
              <p className="text-xs tracking-widest text-gold">FREE PATHS, WITH LIMITS</p>
              <FreePaths />
            </div>
          )}
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
        {connected && !canMake && <p className="mt-2 text-sm text-muted">{blockLine(connected.kind, kind)}</p>}

        {shapeChoices.length > 0 && (
          <label className="mt-3 block text-sm text-muted">
            Model for shaping
            <select value={shapeId} onChange={(event) => setShapeModel(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-raised px-3 text-ink">
              {shapeChoices.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}{model.free ? " · free, limited" : ""}
                </option>
              ))}
            </select>
            {shapeNote && <span className="mt-1 block text-xs">{shapeNote}</span>}
          </label>
        )}

        {makeChoices.length > 0 && (
          <label className="mt-3 block text-sm text-muted">
            Model for {kind === "image" ? "the still" : kind === "video" ? "the film" : "the voice"}
            <select value={makeId} onChange={(event) => setMakeModel(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-raised px-3 text-ink">
              {makeChoices.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}{model.free ? " · free, limited" : ""}
                </option>
              ))}
            </select>
            {makeNote && <span className="mt-1 block text-xs">{makeNote}</span>}
          </label>
        )}

        {kind === "audio" && (
          <div className="mt-3 grid gap-2">
            <label className="text-sm text-muted">
              Tongue
              <select value={tongue} onChange={(event) => setTongue(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-raised px-3 text-ink">
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
              <select value={voice} onChange={(event) => setVoice(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-raised px-3 text-ink">
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
            <button
              key={item}
              type="button"
              aria-pressed={style === item}
              className={`min-h-11 border px-2 text-sm ${style === item ? "border-garnet bg-garnet text-paper" : "border-line text-muted"}`}
              onClick={() => setStyle(style === item ? "" : item)}
            >
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
          <button
            type="button"
            disabled={busy || !passage || !connected}
            onClick={shape}
            className={`min-h-11 px-4 disabled:opacity-40 ${connected && !canMake ? "bg-garnet text-paper" : "border border-garnet text-garnet"}`}
          >
            Shape the prompt
          </button>
          <button
            type="button"
            disabled={busy || !passage || !connected || !canMake}
            onClick={make}
            className={`min-h-11 px-4 disabled:opacity-40 ${connected && !canMake ? "border border-garnet text-garnet" : "bg-garnet text-paper"}`}
          >
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
    </Modal>
  );
}
