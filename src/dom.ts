// Helper mínimo para montar DOM sem framework.
type Child = Node | string | null | undefined | false;
type Props = { [key: string]: unknown };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    else if (key === 'class') el.className = String(value);
    else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Props)) {
        if (k.startsWith('--')) el.style.setProperty(k, String(v));
        else (el.style as unknown as Props)[k] = v;
      }
    }
    else if (key in el) (el as unknown as Props)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Debounce com `flush` (para o autosave não perder o último trecho ao sair da tela). */
export function debounced(fn: () => void, ms: number): { call(): void; flush(): void; cancel(): void } {
  let timer: number | undefined;
  return {
    call() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        fn();
      }, ms);
    },
    cancel() {
      window.clearTimeout(timer);
      timer = undefined;
    },
    flush() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      fn();
    },
  };
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Data local de hoje como YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
