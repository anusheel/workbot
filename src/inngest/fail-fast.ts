import { APICallError } from "@ai-sdk/provider";
import { NonRetriableError } from "inngest";

/**
 * A failure no retry can fix, such as a document the provider rejects as
 * malformed, ends the run at once and goes to the dead letters; anything
 * else is thrown for the engine to retry with backoff.
 */
export function failFast(error: unknown): never {
  if (APICallError.isInstance(error) && !error.isRetryable)
    throw new NonRetriableError(error.message, { cause: error });
  throw error;
}
