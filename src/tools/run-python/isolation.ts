// Whether Run Python's page is cross-origin isolated, and what to do if not (ADR-0009).
// Pure: the browser's facts come in as arguments, so Vitest can test every case.
// `isolate()` is the thin browser side that gathers the facts and acts on the decision.

export type IsolationFacts = {
  /** `crossOriginIsolated`: the one truth. */
  isolated: boolean;
  /** `navigator.serviceWorker` exists (it needs a secure context). */
  hasServiceWorkerApi: boolean;
  /** A service worker controls this page already. */
  controlled: boolean;
  /** This tab already reloaded once for isolation (or the flag can't be read). */
  reloadedBefore: boolean;
};

export type Isolation = 'isolated' | 'register-and-reload' | 'unavailable';

export function decideIsolation(facts: IsolationFacts): Isolation {
  if (facts.isolated) return 'isolated';
  if (!facts.hasServiceWorkerApi) return 'unavailable';
  // One reload only: if isolation still has not started, it will not.
  if (facts.reloadedBefore) return 'unavailable';
  return 'register-and-reload';
}

/** The tab's session storage flag that stops a second reload. */
export const reloadFlag = 'run-python-isolation-reloaded';

/** How long to wait for the service worker to start before settling as unavailable. */
const readyTimeout = 5_000;

/**
 * Makes the page isolated if it can. Resolves to 'isolated' or 'unavailable'; on a first
 * visit it registers the service worker, reloads the page and never resolves.
 */
export async function isolate(serviceWorkerUrl: string): Promise<'isolated' | 'unavailable'> {
  let reloadedBefore = true; // Blocked storage: never risk a reload loop.
  try {
    reloadedBefore = sessionStorage.getItem(reloadFlag) !== null;
  } catch {
    // Keep true.
  }
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
  const decision = decideIsolation({
    isolated: globalThis.crossOriginIsolated === true,
    hasServiceWorkerApi: sw !== undefined,
    controlled: sw?.controller != null,
    reloadedBefore,
  });
  if (decision === 'isolated') {
    try {
      sessionStorage.removeItem(reloadFlag);
    } catch {
      // Nothing to clear.
    }
    return 'isolated';
  }
  if (decision === 'unavailable' || !sw) return 'unavailable';
  try {
    await sw.register(serviceWorkerUrl);
    // `ready` never settles where service workers are blocked, so give up after a while.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out')), readyTimeout),
    );
    await Promise.race([sw.ready, timeout]);
    sessionStorage.setItem(reloadFlag, '1');
  } catch {
    return 'unavailable';
  }
  location.reload();
  return new Promise(() => {});
}
