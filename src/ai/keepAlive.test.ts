import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startKeepAlive } from './keepAlive';

describe('startKeepAlive', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pings on every interval until stopped', () => {
    const ping = vi.fn();
    const stop = startKeepAlive(ping, 20_000);
    vi.advanceTimersByTime(60_000);
    expect(ping).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(ping).toHaveBeenCalledTimes(3);
  });
});
