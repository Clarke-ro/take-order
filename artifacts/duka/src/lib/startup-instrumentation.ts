// Temporary startup instrumentation for diagnosing reload flash (Step 1)
// Will be removed after diagnostics and fixes are verified.

if (typeof window !== 'undefined') {
  const startTime = performance.now();
  const events: Array<{ time: number; type: string; details: any }> = [];
  (window as any).__RELOAD_EVENTS__ = events;

  const logEvent = (type: string, details: any) => {
    const time = Math.round(performance.now() - startTime);
    const entry = { time, type, details };
    events.push(entry);
    try {
      console.log(`[INSTRUMENT ${time}ms] [${type}]`, JSON.stringify(details));
    } catch {
      console.log(`[INSTRUMENT ${time}ms] [${type}]`, details);
    }
  };

  // a) Wrap history.pushState and history.replaceState
  const origPushState = history.pushState.bind(history);
  history.pushState = function(state, unused, url) {
    const trace = new Error().stack;
    logEvent('history.pushState', { url: String(url), state, trace });
    return origPushState(state, unused, url);
  };

  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = function(state, unused, url) {
    const trace = new Error().stack;
    logEvent('history.replaceState', { url: String(url), state, trace });
    return origReplaceState(state, unused, url);
  };

  // d) Wrap fetch to record API responses and 401s
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    try {
      const res = await origFetch(...args);
      logEvent('fetch', { url, status: res.status });
      return res;
    } catch (err: any) {
      logEvent('fetch_error', { url, error: err?.message });
      throw err;
    }
  };

  // c) MutationObserver for data-route
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const el = node as HTMLElement;
            const route = el.getAttribute('data-route') || el.querySelector?.('[data-route]')?.getAttribute('data-route');
            if (route) {
              logEvent('dom.route_mounted', { route });
            }
          }
        });
      }
    }
  });

  const attachObserver = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      // Check already present data-route
      const existing = document.querySelector('[data-route]');
      if (existing) {
        logEvent('dom.route_initial', { route: existing.getAttribute('data-route') });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachObserver);
  } else {
    attachObserver();
  }

  // Export helper for guard decisions
  (window as any).__logGuardDecision__ = (guardName: string, details: any) => {
    logEvent('guard_decision', { guard: guardName, ...details });
  };
}

export {};
