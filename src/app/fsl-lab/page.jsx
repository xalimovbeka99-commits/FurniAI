"use client";

/**
 * /fsl-lab — a minimal manual-testing page for POST /api/v1/furniture/generate.
 * Isolated like /cad-lab: nothing existing links here, nothing here is
 * imported elsewhere. Exists purely so the Furniture Generation API (FSL v1)
 * has somewhere to click and try, since the API itself has no UI of its own.
 *
 * Also exercises Pillar 1 (multi-channel input): a file-attach control sends
 * photos/PDFs as base64 `attachments`, and a mic button uses the browser's
 * SpeechRecognition API to fill the text field — voice never touches the
 * server, it just produces the same `message` string typing would.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const EXAMPLE =
  "Create a modern white wardrobe, 2400 mm wide, 2600 mm high and 600 mm deep, with four hinged doors, six drawers, internal shelves, hanging rails and LED lighting.";

const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_ATTACHMENTS = 5;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL looks like "data:image/png;base64,AAAA…" — keep only the payload.
      const commaIndex = reader.result.indexOf(",");
      resolve(reader.result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const STATUS_COLOR = {
  ready: "text-emerald-600",
  draft: "text-neutral-500",
  needs_clarification: "text-amber-600",
  partially_supported: "text-amber-600",
  invalid: "text-red-600",
};

function Field({ label, children }) {
  return (
    <label className="flex items-center gap-2 text-xs font-mono text-[#5C626E]">
      {children}
      {label}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="border border-[#EDE8DC] rounded-md bg-white p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-[#5C626E] mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export default function FslLabPage() {
  const [message, setMessage] = useState(EXAMPLE);
  const [target, setTarget] = useState("configurator");
  const [allowDefaults, setAllowDefaults] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Pillar 1 (multi-channel input): photos/drawings/PDFs alongside the
  // text message, and browser speech-to-text filling the text message —
  // both reuse this same request/response path, no server change for voice.
  const [attachments, setAttachments] = useState([]); // { id, name, mediaType, data (base64), previewUrl }
  const [attachError, setAttachError] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    // Browser capability detection is intentionally synchronized after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(!!SpeechRecognition);
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ");
      setMessage((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  };

  const addFiles = async (fileList) => {
    setAttachError(null);
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setAttachError(`A maximum of ${MAX_ATTACHMENTS} attachments is supported.`);
      return;
    }
    for (const file of files) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setAttachError(`${file.name}: unsupported type (${file.type || "unknown"}). Use JPEG, PNG, GIF, WEBP, or PDF.`);
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            mediaType: file.type,
            data,
            previewUrl: file.type === "application/pdf" ? null : URL.createObjectURL(file),
          },
        ]);
      } catch {
        setAttachError(`${file.name}: could not be read.`);
      }
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const submit = async (e) => {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/furniture/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          attachments: attachments.map((a) => ({ media_type: a.mediaType, data: a.data })),
          options: { target, allow_defaults: allowDefaults, include_explanation: true },
        }),
      });
      const body = await res.json();
      if (!res.ok && body.status === "error") {
        setError(body.errors?.[0]?.message || `Request failed (${res.status})`);
        setResult(body);
      } else {
        setResult(body);
      }
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const fsl = result?.data?.fsl;
  const interpretation = result?.data?.interpretation;
  const configurator = result?.data?.configurator;

  return (
    <div className="min-h-screen w-full bg-neutral-100">
      <header className="flex items-center justify-between border-b border-[#EDE8DC] bg-[#FAF9F5] px-5 py-2.5">
        <Link href="/" className="font-mono text-xs tracking-wider text-[#5C626E] hover:text-[#1C1E21] transition-colors">
          ← Back
        </Link>
        <div className="text-sm font-mono">
          <span className="font-bold">FSL Lab</span>
          <span className="text-[#5C626E]"> — Furniture Generation API (/api/v1/furniture/generate)</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-5xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Section title="Describe the furniture you want">
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full text-sm border border-[#EDE8DC] rounded px-2 py-1.5 pr-9 bg-white font-mono"
                  placeholder="Describe a wardrobe, kitchen, bookcase… or attach a photo/PDF below"
                />
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    title={listening ? "Stop voice input" : "Speak your request"}
                    className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-1 rounded border ${
                      listening ? "bg-red-600 text-white border-red-600 animate-pulse" : "bg-white text-[#5C626E] border-[#EDE8DC]"
                    }`}
                  >
                    🎙
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-2 py-1 rounded border border-[#EDE8DC] bg-white text-[#5C626E] hover:text-[#1C1E21]"
                  >
                    + Attach photo / PDF
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <span className="text-[10px] font-mono text-[#5C626E]">JPEG/PNG/GIF/WEBP/PDF, up to {MAX_ATTACHMENTS}</span>
                </div>
                {attachError && <p className="text-xs text-red-600 font-mono">{attachError}</p>}
                {attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-1.5 text-xs font-mono bg-white border border-[#EDE8DC] rounded px-1.5 py-1">
                        {a.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.previewUrl} alt={a.name} className="w-6 h-6 object-cover rounded" />
                        ) : (
                          <span className="w-6 h-6 flex items-center justify-center bg-neutral-100 rounded">PDF</span>
                        )}
                        <span className="max-w-[10ch] truncate">{a.name}</span>
                        <button type="button" onClick={() => removeAttachment(a.id)} className="text-[#5C626E] hover:text-red-600">
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Field label="concept">
                  <input type="radio" name="target" checked={target === "concept"} onChange={() => setTarget("concept")} />
                </Field>
                <Field label="configurator">
                  <input type="radio" name="target" checked={target === "configurator"} onChange={() => setTarget("configurator")} />
                </Field>
                <Field label="allow_defaults">
                  <input type="checkbox" checked={allowDefaults} onChange={(e) => setAllowDefaults(e.target.checked)} />
                </Field>
              </div>
              <button type="submit" disabled={loading} className="text-sm px-3 py-1.5 rounded bg-[#1C1E21] text-white disabled:opacity-40">
                {loading ? "Generating…" : "Generate FSL"}
              </button>
            </form>
          </Section>

          {interpretation && (
            <Section title="Interpretation">
              <p className="text-sm mb-2">{interpretation.summary}</p>
              {interpretation.explicit_requirements?.length > 0 && (
                <>
                  <div className="text-[10px] font-mono uppercase text-[#5C626E] mt-2">Explicit</div>
                  <ul className="text-xs font-mono list-disc pl-4">
                    {interpretation.explicit_requirements.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}
              {interpretation.defaults_applied?.length > 0 && (
                <>
                  <div className="text-[10px] font-mono uppercase text-[#5C626E] mt-2">Defaults applied</div>
                  <ul className="text-xs font-mono list-disc pl-4 text-amber-700">
                    {interpretation.defaults_applied.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}
              {interpretation.clarifications_required?.length > 0 && (
                <>
                  <div className="text-[10px] font-mono uppercase text-[#5C626E] mt-2">Clarifications needed</div>
                  <ul className="text-xs font-mono list-disc pl-4 text-red-600">
                    {interpretation.clarifications_required.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}
            </Section>
          )}

          {configurator && (
            <Section title="Configurator compatibility">
              <div className="text-sm font-mono">
                compatible: <span className={configurator.compatible ? "text-emerald-600" : "text-amber-600"}>{String(configurator.compatible)}</span>
              </div>
              {configurator.unsupported_fields?.length > 0 && (
                <ul className="text-xs font-mono list-disc pl-4 mt-1 text-amber-700">
                  {configurator.unsupported_fields.map((f, i) => <li key={i}>{f.message}</li>)}
                </ul>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-3">
          {error && (
            <Section title="Error">
              <p className="text-sm text-red-600 font-mono">{error}</p>
            </Section>
          )}
          {fsl && (
            <Section title={`FSL document — status: `}>
              <div className={`text-sm font-mono font-bold mb-2 ${STATUS_COLOR[fsl.status] || ""}`}>{fsl.status}</div>
              <pre className="font-mono text-[11px] whitespace-pre-wrap break-all max-h-[70vh] overflow-y-auto">{JSON.stringify(fsl, null, 2)}</pre>
            </Section>
          )}
          {!result && !loading && <p className="text-sm text-[#5C626E] font-mono px-1">No request sent yet.</p>}
        </div>
      </div>
    </div>
  );
}
