import { z } from "zod";
import { isDayKey } from "@/lib/dates/dayKey";

/**
 * The shape of a request to `POST /api/extract`, and of what comes back.
 *
 * Shared by the browser and the server so the two can't drift, and validated on both
 * sides: the server doesn't trust the browser, and the browser doesn't trust a reply that
 * may have come through a proxy, a captive portal, or a stale service worker.
 */
export const MAX_DUMP_LENGTH = 4_000;
export const MAX_PROJECTS_SENT = 200;

export const extractRequestSchema = z.object({
  text: z.string().min(1),
  today: z.string().refine(isDayKey, { message: "not a real calendar day" }),
  accessCode: z.string(),
  /** Your projects, so Claude can join one instead of proposing a name you already use. */
  projects: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1), status: z.enum(["active", "archived"]) }))
    .max(MAX_PROJECTS_SENT),
});

export type ExtractRequest = z.infer<typeof extractRequestSchema>;

/** Every way the route can say no. The browser turns each one into a sentence. */
export type ExtractErrorCode =
  | "bad-request"
  | "too-long"
  | "not-configured"
  | "wrong-code"
  | "no-key"
  | "bad-reply"
  | "upstream";

export const extractErrorSchema = z.object({ error: z.string() });

export function describeExtractError(code: string): string {
  switch (code) {
    case "wrong-code":
      return "That access code isn't right, so Tipon sorted this with rules instead.";
    case "too-long":
      return `That dump is longer than ${MAX_DUMP_LENGTH} characters, so Tipon sorted it with rules instead.`;
    case "not-configured":
    case "no-key":
      return "Claude isn't set up on this copy of Tipon, so it sorted this with rules instead.";
    case "bad-reply":
      return "Claude's answer didn't make sense, so Tipon sorted this with rules instead.";
    case "offline":
      // Not a failure worth apologising for: the rules never needed a network.
      return "You're offline, so Tipon sorted this with its own rules.";
    default:
      return "Claude couldn't be reached, so Tipon sorted this with rules instead.";
  }
}
