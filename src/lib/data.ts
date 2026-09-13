import { useEffect, useState } from 'react';
import { DataShapeError } from './validate';

export interface Loaded<T> {
  data?: T;
  error?: string;
}

/**
 * Fetches a JSON file from public/data and validates its shape before any
 * component sees it. The only I/O the app performs. A missing file, a
 * non-JSON response (for example a host's HTML fallback) or a file with the
 * wrong shape all produce a readable message instead of a blank page.
 */
export function useJson<T>(path: string, validate: (file: string, v: unknown) => void): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({});
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const t = setTimeout(() => alive && setState({}), 0);
    fetch(`${import.meta.env.BASE_URL}data/${path}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 404) throw new Error(`The data file data/${path} was not found (HTTP 404).`);
        if (!r.ok) throw new Error(`The server could not deliver data/${path} (HTTP ${r.status}). Try again in a moment.`);
        const text = await r.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`The data file data/${path} is not valid JSON.`);
        }
        validate(`data/${path}`, json);
        return json as T;
      })
      .then((data) => alive && setState({ data }))
      .catch((e: unknown) => {
        if (!alive || (e instanceof DOMException && e.name === 'AbortError')) return;
        setState({ error: e instanceof DataShapeError || e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [path, validate]);
  return state;
}
