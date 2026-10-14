// Prompt rendering and provider input. Pure functions (Vitest): the rendered prompt only ever goes
// to start_run and the provider, never to the client or logs.

export const MAX_VARIABLE_CHARS = 500;
export const MAX_BLANK_PROMPT_CHARS = 4000;
export const MAX_RENDERED_CHARS = 8000;

const TOKEN = /\[([^[\]\n]{1,30})\]/g;

export type VariableError = {
  name: string;
  code: "EMPTY" | "TOO_LONG" | "UNKNOWN";
};

/** Every declared [변수] needs a value; values are capped; undeclared names are refused. */
export function checkVariables(
  declared: string[],
  values: Record<string, string>,
): VariableError[] {
  const errors: VariableError[] = [];
  for (const name of declared) {
    const v = values[name];
    if (typeof v !== "string" || !v.trim())
      errors.push({ name, code: "EMPTY" });
    else if (v.length > MAX_VARIABLE_CHARS)
      errors.push({ name, code: "TOO_LONG" });
  }
  for (const name of Object.keys(values))
    if (!declared.includes(name)) errors.push({ name, code: "UNKNOWN" });
  return errors;
}

/** Replace each declared [name] with its value. Values cannot introduce new tokens (one pass). */
export function renderPrompt(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(TOKEN, (whole, raw: string) => {
    const name = raw.trim();
    return Object.hasOwn(values, name) ? values[name].trim() : whole;
  });
}

/** gpt-image sizes are stored as "WxH" in models.params; fal wants {width, height}. */
function sizeOf(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(v);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : v;
}

/** fal input for one cell: one output per cell, params as stored (validated by quote_cell). */
export function buildInput(args: {
  kind: "image" | "video";
  prompt: string;
  params: Record<string, unknown>;
  refParam: string | null;
  refUrls: string[];
}): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt: args.prompt };
  for (const [k, v] of Object.entries(args.params))
    input[k] = k === "image_size" ? sizeOf(v) : v;
  if (args.kind === "image") input.num_images = 1;
  if (args.refParam && args.refUrls.length > 0)
    input[args.refParam] = args.refParam.endsWith("_urls")
      ? args.refUrls
      : args.refUrls[0];
  return input;
}
