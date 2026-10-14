// POST /api/play/runs body (PLAY-02~04). Shared by the /play client and the route.
import { z } from "zod";
import {
  MAX_BLANK_PROMPT_CHARS,
  MAX_VARIABLE_CHARS,
} from "@/lib/generation/input";

const ParamValue = z.union([z.string().max(20), z.number(), z.boolean()]);

export const RunCellSchema = z.object({
  model: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,40}$/),
  params: z.record(z.string().max(30), ParamValue).default({}),
  count: z.number().int().min(1).max(4).default(1),
});

export const RunRequestSchema = z
  .object({
    clientRequestId: z.guid(),
    mode: z.enum(["own", "free", "blank"]),
    recipeVersionId: z.guid().nullable().default(null),
    /** blank mode only */
    prompt: z.string().max(MAX_BLANK_PROMPT_CHARS).default(""),
    variables: z
      .record(z.string().min(1).max(30), z.string().max(MAX_VARIABLE_CHARS))
      .default({}),
    cells: z.array(RunCellSchema).min(1).max(3),
    referenceIds: z.array(z.guid()).max(4).default([]),
    faceConsent: z.boolean().default(false),
    /** From quote_play: the run is refused (409) if either no longer matches. */
    priceVersions: z.record(z.string(), z.number().int().positive()),
    expectedTotal: z.number().int().positive(),
  })
  .refine((r) => (r.mode === "blank") === (r.recipeVersionId === null), {
    path: ["recipeVersionId"],
  })
  .refine((r) => r.mode !== "blank" || r.prompt.trim().length > 0, {
    path: ["prompt"],
  });

export type RunRequest = z.infer<typeof RunRequestSchema>;

/** Error code → HTTP status for the route. */
export const RUN_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  INVALID_PARAMS: 400,
  INVALID_VARIABLES: 400,
  INVALID_REFERENCE: 400,
  FACE_CONSENT_REQUIRED: 400,
  AI_NOTICE_REQUIRED: 400,
  LOGIN_REQUIRED: 401,
  SIGNUP_INCOMPLETE: 403,
  ADULT_REQUIRED: 403,
  GENERATION_SUSPENDED: 403,
  DAILY_LIMIT: 403,
  INSUFFICIENT_CREDITS: 403,
  BUDGET_EXHAUSTED: 403,
  NOT_ENTITLED: 404,
  PRICE_CHANGED: 409,
  SAFETY_BLOCKED: 422,
  RATE_LIMITED: 429,
  MODERATION_UNAVAILABLE: 503,
  FAILED: 500,
};
