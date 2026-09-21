/**
 * Availability of the EvidenceOne service, as seen by this widget — pure state
 * logic behind the maintenance screen (the root component owns the I/O).
 */

export interface AvailabilityState {
  /** Last answer from GET /status — kept through failed checks. */
  maintenance: boolean;
  /** Consecutive checks that got no usable answer. */
  failedChecks: number;
}

export const INITIAL_AVAILABILITY: AvailabilityState = { maintenance: false, failedChecks: 0 };

export type StatusCheckResult = { ok: true; maintenance: boolean } | { ok: false };

/** One failed check may be a dropped request; two in a row mean the service is down. */
const UNREACHABLE_AFTER_FAILED_CHECKS = 2;

const CHECK_INTERVAL_MS = 15_000;
/** A first failed check is confirmed (or dismissed) quickly. */
const CONFIRM_FAILURE_MS = 3_000;

/** One status check outcome → next state. */
export function nextAvailability(prev: AvailabilityState, result: StatusCheckResult): AvailabilityState {
  if (result.ok) return { maintenance: result.maintenance, failedChecks: 0 };
  return { maintenance: prev.maintenance, failedChecks: prev.failedChecks + 1 };
}

/** A blocked request just revealed the maintenance, ahead of the next check. */
export function markMaintenanceReported(prev: AvailabilityState): AvailabilityState {
  return { ...prev, maintenance: true };
}

/**
 * True while the maintenance screen must be up: the server announced it, or the
 * service cannot be reached. The second only counts while the browser is online —
 * a doctor without a connection must not be told the product is down.
 */
export function isUnavailable(state: AvailabilityState, isOnline: boolean): boolean {
  return state.maintenance || (isOnline && state.failedChecks >= UNREACHABLE_AFTER_FAILED_CHECKS);
}

/** How long to wait before the next status check (the server caches its state for 5s). */
export function nextCheckDelayMs(state: AvailabilityState): number {
  return state.failedChecks === 1 ? CONFIRM_FAILURE_MS : CHECK_INTERVAL_MS;
}
