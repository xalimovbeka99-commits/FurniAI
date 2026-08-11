/**
 * wardrobeAIStore — session state for the Wardrobe AI (Milestones 8/10).
 * ---------------------------------------------------------------------
 * Deliberately separate from furnitureStore.js, not a replacement for it:
 * the manual structure/appearance panels keep working exactly as before,
 * untouched (see docs/WARDROBE_AI_BASELINE.md). `model` here is the
 * canonical WardrobeModel (src/lib/wardrobe-model/schema.js), not a
 * FurnitureConfig — FurnitureModel.jsx picks whichever one is active.
 *
 * Persistence is this browser session only (see docs/KNOWN_LIMITATIONS.md
 * for why: no auth/database requirement in Phase 1's Definition of Done).
 * `revisions` is a plain append-only snapshot list — enough to support a
 * future "undo" without building the undo UI itself yet, per the spec.
 */
import { create } from "zustand";

export const useWardrobeAIStore = create((set, get) => ({
  model: null,
  revisions: [],
  conversation: [],
  isLoading: false,
  error: null,
  lastAssistantMessage: null,

  async sendMessage(message) {
    set({ isLoading: true, error: null });
    let response;
    try {
      response = await fetch("/api/wardrobe/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model: get().model, conversation: get().conversation }),
      });
    } catch {
      set({ isLoading: false, error: "Could not reach the Wardrobe AI — check your connection." });
      return { ok: false };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      set({ isLoading: false, error: "The Wardrobe AI returned an unreadable response." });
      return { ok: false };
    }

    if (!response.ok || !data.ok) {
      set({ isLoading: false, error: data.error || "The Wardrobe AI could not complete that request." });
      return { ok: false, error: data.error, code: data.code };
    }

    set((s) => ({
      model: data.model,
      conversation: data.conversation || [],
      isLoading: false,
      error: null,
      lastAssistantMessage: data.assistantMessage || null,
      revisions: data.model
        ? [...s.revisions, { revision: data.revision, model: data.model, at: new Date().toISOString() }]
        : s.revisions,
    }));
    return { ok: true, assistantMessage: data.assistantMessage, toolCalls: data.toolCalls };
  },

  reset() {
    set({ model: null, revisions: [], conversation: [], isLoading: false, error: null, lastAssistantMessage: null });
  },
}));
