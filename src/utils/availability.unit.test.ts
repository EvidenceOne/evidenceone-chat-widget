import { describe, expect, it } from 'vitest';
import {
  INITIAL_AVAILABILITY,
  isUnavailable,
  markMaintenanceReported,
  nextAvailability,
  nextCheckDelayMs,
} from './availability';

const failTimes = (times: number) => {
  let state = nextAvailability(INITIAL_AVAILABILITY, { ok: true, maintenance: false });
  for (let i = 0; i < times; i++) state = nextAvailability(state, { ok: false });
  return state;
};

describe('nextAvailability', () => {
  it('takes what the server answered', () => {
    expect(nextAvailability(INITIAL_AVAILABILITY, { ok: true, maintenance: true })).toEqual({
      maintenance: true,
      failedChecks: 0,
    });
  });

  it('keeps the last known answer through failed checks, counting the failures', () => {
    expect(failTimes(2)).toEqual({ maintenance: false, failedChecks: 2 });
  });

  it('forgets the failures once the server answers again', () => {
    expect(nextAvailability(failTimes(3), { ok: true, maintenance: false })).toEqual(INITIAL_AVAILABILITY);
  });
});

describe('isUnavailable', () => {
  it('is false while operating', () => {
    expect(isUnavailable(INITIAL_AVAILABILITY, true)).toBe(false);
  });

  it('follows the maintenance the server announced, online or not', () => {
    const state = nextAvailability(INITIAL_AVAILABILITY, { ok: true, maintenance: true });

    expect(isUnavailable(state, true)).toBe(true);
    expect(isUnavailable(state, false)).toBe(true);
  });

  it('ignores a single failed check — one dropped request is not an outage', () => {
    expect(isUnavailable(failTimes(1), true)).toBe(false);
  });

  it('treats two consecutive failed checks as the service being down', () => {
    expect(isUnavailable(failTimes(2), true)).toBe(true);
  });

  it('never blames the service while the browser itself is offline', () => {
    expect(isUnavailable(failTimes(5), false)).toBe(false);
  });
});

describe('markMaintenanceReported', () => {
  it('turns maintenance on when a blocked request reveals it ahead of the next check', () => {
    expect(isUnavailable(markMaintenanceReported(INITIAL_AVAILABILITY), true)).toBe(true);
  });
});

describe('nextCheckDelayMs', () => {
  it('checks every 15 seconds', () => {
    expect(nextCheckDelayMs(INITIAL_AVAILABILITY)).toBe(15_000);
    expect(nextCheckDelayMs(failTimes(2))).toBe(15_000);
  });

  it('confirms a first failure quickly', () => {
    expect(nextCheckDelayMs(failTimes(1))).toBe(3_000);
  });
});
