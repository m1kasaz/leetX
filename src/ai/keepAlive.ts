/**
 * MV3 service workers are terminated after ~30s without extension activity.
 * Awaiting a fetch does not count as activity, so a buffered LLM stream can
 * outlive the worker and the port dies silently. Pinging any extension API
 * on an interval resets the idle timer and keeps the worker alive.
 */
export const KEEP_ALIVE_INTERVAL_MS = 20_000;

export function startKeepAlive(ping: () => void, intervalMs: number = KEEP_ALIVE_INTERVAL_MS): () => void {
  const timer = setInterval(ping, intervalMs);
  return () => clearInterval(timer);
}
