import { useSyncExternalStore } from 'react';

type Resource = 'ubicaciones' | 'dispositivos' | 'sensores' | 'umbrales' |
  'mantenimientos' | 'alertas' | 'mediciones';
type Revisions = Partial<Record<Resource, string>>;

let revisions: Revisions = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function update(next: Revisions) {
  if (Object.keys(next).length === Object.keys(revisions).length &&
    Object.entries(next).every(([key, value]) => revisions[key as Resource] === value)) return;
  revisions = next;
  listeners.forEach((listener) => listener());
}

export function useSiteDataVersion(...resources: Resource[]): string {
  return useSyncExternalStore(
    subscribe,
    () => resources.map((key) => revisions[key] ?? '-').join(':'),
    () => resources.map(() => '-').join(':'),
  );
}

export function watchSiteData(): () => void {
  let running = true;
  let request: AbortController | undefined;
  const refresh = async () => {
    if (!running || request || document.visibilityState === 'hidden') return;
    const controller = new AbortController();
    request = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/cambios', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return;
      const next: Revisions = await response.json();
      if (running) update(next);
    } catch {
      // La próxima consulta reconcilia los cambios después de una desconexión.
    } finally {
      window.clearTimeout(timeout);
      request = undefined;
    }
  };

  void refresh();
  const timer = window.setInterval(refresh, 3500);
  document.addEventListener('visibilitychange', refresh);
  return () => {
    running = false;
    request?.abort();
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', refresh);
    update({});
  };
}
