// -----------------------------------------------------------------------------
// Minimal JSON HTTP client shared by the providers.
//
// - identifies the integration with a User-Agent, as both public APIs ask;
// - spaces the requests of one client (iRail allows 3 requests per second);
// - times out, so a slow API never blocks a poll forever;
// - takes `fetch` as a parameter: the tests inject a fake one and never touch
//   the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const USER_AGENT = `GladysBelgianMobility/${version} (+https://github.com/gboulvin/Gladys-BelgianMobility)`;

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} on ${new URL(url).host}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.minIntervalMs] minimum delay between two requests
 * @param {number} [options.timeoutMs]
 */
export function createHttpClient({
  fetch: fetchImpl = globalThis.fetch,
  minIntervalMs = 0,
  timeoutMs = 10_000,
} = {}) {
  let queue = Promise.resolve();
  let lastStart = 0;

  async function throttle() {
    const wait = lastStart + minIntervalMs - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastStart = Date.now();
  }

  return {
    /**
     * GET a URL and parse its JSON body. Rejects with an HttpError on a non-2xx
     * answer.
     */
    getJson(url) {
      const run = queue.then(async () => {
        await throttle();
        const response = await fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          throw new HttpError(response.status, url);
        }
        return response.json();
      });
      // One request at a time; a failure must not block the next ones.
      queue = run.catch(() => {});
      return run;
    },
  };
}
