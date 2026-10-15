// Provider adapter contract (generation-pipeline skill). Adapters map provider wire formats to these
// shapes; provider response objects never leave src/lib/generation (hidden-content rule 4).

export type ProviderName = "fal" | "mock";
export type MediaKind = "image" | "video";

export interface SubmitRequest {
  endpoint: string;
  input: Record<string, unknown>;
  /** Our webhook URL with the cell id and the per-cell token. */
  webhookUrl: string;
}

/**
 * Why a submit did not go through. `rate_limited` / `transient` (a definite 5xx) are retried;
 * `unknown` (timeout / network) may already be queued at the provider, so it is never resubmitted.
 */
export type SubmitFailure =
  | "rate_limited"
  | "transient"
  | "unknown"
  | "safety_blocked"
  | "invalid_input";

export class ProviderSubmitError extends Error {
  constructor(readonly failure: SubmitFailure) {
    super(`provider submit: ${failure}`);
  }
}

/** A finished (or still running) generation, provider-neutral. */
export type ProviderOutcome =
  | { state: "pending" }
  | { state: "succeeded"; outputs: string[] }
  | { state: "safety_blocked" }
  | { state: "failed"; code: string };

export interface WebhookEvent {
  requestId: string;
  outcome: ProviderOutcome;
}

export interface ProviderAdapter {
  name: ProviderName;
  submit(req: SubmitRequest): Promise<{ requestId: string }>;
  /** Signature over the raw body; false on any mismatch or replay window miss. */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseEvent(rawBody: string): WebhookEvent | null;
  /** Look the job up (sweeper, deadline passed or webhook lost). */
  poll(endpoint: string, requestId: string): Promise<ProviderOutcome>;
  cancel(endpoint: string, requestId: string): Promise<void>;
  /** Download one output; the adapter decides which URLs it trusts. */
  fetchOutput(
    url: string,
    maxBytes: number,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
