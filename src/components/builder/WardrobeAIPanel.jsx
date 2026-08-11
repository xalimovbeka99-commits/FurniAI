"use client";

/**
 * WardrobeAIPanel — the minimal chat surface for the Wardrobe AI.
 * ----------------------------------------------------------------------
 * Additive only: mounted by builder/page.jsx as a floating overlay, closed
 * by default, never part of the existing three-column layout it sits above.
 * Talks only to useWardrobeAIStore (POST /api/wardrobe/chat) — no direct
 * geometry, no direct tool calls; the model shown here is exactly the model
 * FurnitureModel.jsx renders once wired in (see docs/IMPLEMENTATION_CHANGELOG.md).
 */
import { useState, useRef, useEffect } from "react";
import { useWardrobeAIStore } from "@/store/wardrobeAIStore";

export default function WardrobeAIPanel({ onClose }) {
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState([]); // [{role: "user"|"assistant", text}]
  const model = useWardrobeAIStore((s) => s.model);
  const isLoading = useWardrobeAIStore((s) => s.isLoading);
  const error = useWardrobeAIStore((s) => s.error);
  const sendMessage = useWardrobeAIStore((s) => s.sendMessage);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript, isLoading]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || isLoading) return;
    setTranscript((t) => [...t, { role: "user", text }]);
    setDraft("");
    const result = await sendMessage(text);
    if (result.ok) {
      setTranscript((t) => [...t, { role: "assistant", text: result.assistantMessage || "(no reply)" }]);
    } else {
      setTranscript((t) => [...t, { role: "assistant", text: `Error: ${result.error || "something went wrong"}` }]);
    }
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 flex w-[340px] max-h-[70vh] flex-col rounded-lg border border-[#EDE8DC] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#EDE8DC] px-3 py-2">
        <span className="font-mono text-xs tracking-wider text-[#5C626E]">
          Wardrobe AI {model ? `· rev ${model.revision}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#5C626E] hover:text-[#1C1E21]"
          aria-label="Close Wardrobe AI panel"
        >
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
        {transcript.length === 0 && (
          <p className="text-neutral-500 text-xs">
            Try: &ldquo;Create a 2400x2600x600 wardrobe with three sections&rdquo;
          </p>
        )}
        {transcript.map((entry, i) => (
          <div key={i} className={entry.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                "inline-block rounded px-2 py-1 " +
                (entry.role === "user" ? "bg-[#1C1E21] text-white" : "bg-neutral-100 text-neutral-800")
              }
            >
              {entry.text}
            </span>
          </div>
        ))}
        {isLoading && <p className="text-xs text-neutral-400">Thinking…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex gap-2 border-t border-[#EDE8DC] p-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Describe your wardrobe…"
          className="flex-1 rounded border border-[#EDE8DC] px-2 py-1 text-sm outline-none focus:border-[#00B4D8]"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !draft.trim()}
          className="rounded bg-[#1C1E21] px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
