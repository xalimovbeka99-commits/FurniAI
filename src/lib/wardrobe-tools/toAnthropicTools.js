/**
 * toAnthropicTools — maps the provider-neutral WARDROBE_TOOLS registry to
 * Anthropic's { name, description, input_schema } tool format. If a second
 * provider is ever added, it gets its own equally small mapping file here —
 * nothing about tools.js or the kernel changes.
 */
import { WARDROBE_TOOLS } from "./tools.js";

export function toAnthropicTools() {
  return WARDROBE_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}
