import { useEffect, useState } from 'react';
import { DataShapeError } from './validate';

export interface Loaded<T> {
  data?: T;
  error?: string;
}

/**
 * Fetches one JSON file from public/data and validates its shape before any
 * component sees it. A missing file, a non-JSON response (for example a host's
 * HTML fallback) or a file with the wrong shape all produce a readable message.
 */
export async function fetchJson<T>(path: string, validate: (file: string, v: unknown) => void, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { signal });
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
}

/** The hook form of fetchJson for pages that read one file. */
export function useJson<T>(path: string, validate: (file: string, v: unknown) => void): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({});
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    fetchJson<T>(path, validate, controller.signal)
      .then((data) => alive && setState({ data }))
      .catch((e: unknown) => {
        if (!alive || (e instanceof DOMException && e.name === 'AbortError')) return;
        setState({ error: e instanceof DataShapeError || e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [path, validate]);
  return state;
}
