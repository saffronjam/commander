import {
  ConnectionStateConnecting,
  ConnectionStateOffline,
  ConnectionStateOnline,
  ConnectionStateSaveMismatch,
  ConnectivityReasonBadResponse,
  ConnectivityReasonNone,
  ConnectivityReasonNoResponse,
  type ConnectionState,
  type ConnectivityReason,
} from 'src/apiTypes';

/** GraphQL enums are SCREAMING_SNAKE while the domain types are lowercase. */
export function connectionStateFromEnum(state: unknown): ConnectionState {
  switch (state) {
    case 'ONLINE':
      return ConnectionStateOnline;
    case 'OFFLINE':
      return ConnectionStateOffline;
    case 'SAVE_MISMATCH':
      return ConnectionStateSaveMismatch;
    default:
      return ConnectionStateConnecting;
  }
}

/**
 * GraphQL enums are SCREAMING_SNAKE while the domain types are lowercase, so
 * every path that reads a session off the wire has to convert.
 */
export function connectivityReasonFromEnum(reason: unknown): ConnectivityReason {
  switch (reason) {
    case 'NO_RESPONSE':
      return ConnectivityReasonNoResponse;
    case 'BAD_RESPONSE':
      return ConnectivityReasonBadResponse;
    default:
      return ConnectivityReasonNone;
  }
}

export interface OfflineCopy {
  /** Heading for the full-screen overlay. */
  title: string;
  /** Supporting line under the heading. */
  detail: string;
  /** One-liner for the bottom status bar. */
  bar: string;
}

/**
 * Wording for an unreachable session, keyed on why the backend could not reach it.
 *
 * A bad response means something answered at that address but it was not the mod,
 * which is a different problem from FRM simply not running: the port is wrong, or
 * a reverse proxy, HTTPS, or an auth gate is sitting in front of it.
 */
export function offlineCopy(reason: ConnectivityReason | undefined): OfflineCopy {
  if (reason === ConnectivityReasonBadResponse) {
    return {
      title: 'Could not reach FRM',
      detail:
        'Something answered at this address, but it was not Ficsit Remote Monitoring. Check the port, and any reverse proxy or HTTPS in front of it.',
      bar: 'Could not reach FRM. Something answered at this address, but it was not FRM.',
    };
  }

  return {
    title: 'Session is offline',
    detail: 'Ensure that FRM is running and is reachable at this address.',
    bar: 'Session is offline. Ensure that FRM is running and is reachable.',
  };
}

/**
 * Wording for a session whose server has a different save loaded.
 *
 * Deliberately separate from offlineCopy: the server is reachable here, and the
 * fix is to load a save rather than to check the network.
 */
export function saveMismatchCopy(pinned: string, observed: string | undefined): OfflineCopy {
  const running = observed ? `"${observed}"` : 'a different save';
  return {
    title: 'A different save is loaded',
    detail: `This session is pinned to "${pinned}", but the server is running ${running}. Load "${pinned}" to resume, or add a session for the other save.`,
    bar: `A different save is loaded. This session is pinned to "${pinned}"; the server is running ${running}.`,
  };
}

/**
 * Wording for a failed connection attempt in the add-session form.
 *
 * Separate from offlineCopy because there is no session yet: the operator is
 * still typing an address, so the copy names what to check rather than what is
 * down.
 */
export function probeFailureCopy(reason: ConnectivityReason | undefined): string {
  if (reason === ConnectivityReasonBadResponse) {
    return 'Something answered at this address, but it was not Ficsit Remote Monitoring. Check the port, and any reverse proxy or HTTPS in front of it.';
  }
  return 'Nothing answered at this address. Check that FRM is running and that the address and port are right.';
}
