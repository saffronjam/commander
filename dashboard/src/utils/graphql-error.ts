import type { CombinedError } from 'urql';
import type { ConnectivityReason } from 'src/apiTypes';
import { connectivityReasonFromEnum } from './session-offline';

/**
 * A server failure, reduced to what the UI needs.
 *
 * urql wraps every failure in a `CombinedError` whose `message` is prefixed with
 * `[GraphQL] ` or `[Network] ` and carries the server's raw error, so reading
 * `.message` puts plumbing in front of the user. Read the parts instead and let
 * the caller choose the wording.
 */
export interface GraphQLFailure {
  code?: string;
  reason?: ConnectivityReason;
  /** The server's technical cause. For the console, not for the user. */
  detail?: string;
  /** Human-readable text, never carrying urql's `[GraphQL]`/`[Network]` prefix. */
  message: string;
}

/** Reads the first GraphQL error off an unknown thrown value. */
export function graphQLFailure(err: unknown, fallback: string): GraphQLFailure {
  const combined = err as CombinedError | undefined;

  const first = combined?.graphQLErrors?.[0];
  if (first) {
    const extensions = first.extensions ?? {};
    return {
      code: typeof extensions.code === 'string' ? extensions.code : undefined,
      reason:
        typeof extensions.reason === 'string'
          ? connectivityReasonFromEnum(extensions.reason)
          : undefined,
      detail: typeof extensions.detail === 'string' ? extensions.detail : undefined,
      message: first.message || fallback,
    };
  }

  // The request never reached the dashboard's own API, which is a different
  // problem from anything the server could have told us about.
  if (combined?.networkError) {
    return {
      detail: combined.networkError.message,
      message: 'Could not reach the dashboard server. Check your connection and try again.',
    };
  }

  if (err instanceof Error && err.message) {
    return { message: err.message };
  }
  return { message: fallback };
}
