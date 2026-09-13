/**
 * The whole register in memory, loaded once per session: the rollup, every project
 * shard, and the three party files. Pages that need only the rollup (Overview, Data
 * basis) use useJson directly; everything else reads this. The promise is cached at
 * module level so navigating between pages never refetches, and a failed load is
 * cleared so "Try again" can actually try again.
 *
 * Every file is validated row by row at its own boundary (validate.ts), then the
 * cross-file references are checked once everything is in memory, before the
 * register cache is populated. A corrupt row never reaches a page.
 */
import { useEffect, useState } from 'react';
import type { Owner, Party, Project, Rollup } from '../../data/schema';
import { fetchJson } from './data';
import { validateOwners, validateParties, validateReferences, validateRollup, validateShard } from './validate';

export interface Register {
  rollup: Rollup;
  projects: Project[];
  byRef: Map<string, Project>;
  consultants: Party[];
  contractors: Party[];
  consultantById: Map<number, Party>;
  contractorById: Map<number, Party>;
  ownerById: Map<number, Owner>;
}

let cached: Promise<Register> | null = null;

async function load(): Promise<Register> {
  const rollup = await fetchJson<Rollup>('rollup.json', validateRollup);
  const V = rollup.verticals.length;
  const [shards, consultants, contractors, owners] = await Promise.all([
    Promise.all(rollup.shards.map((s) => fetchJson<{ projects: Project[] }>(s.file, (file, v) => validateShard(file, v, V)))),
    fetchJson<Party[]>('parties/consultants.json', (file, v) => validateParties(file, v, V)),
    fetchJson<Party[]>('parties/contractors.json', (file, v) => validateParties(file, v, V)),
    fetchJson<Owner[]>('parties/owners.json', validateOwners),
  ]);
  const projects = shards.flatMap((s) => s.projects);
  projects.sort((a, b) => a.ref.localeCompare(b.ref));
  validateReferences({ projects, consultants, contractors, owners, engineers: rollup.engineers, verticals: rollup.verticals });
  return {
    rollup,
    projects,
    byRef: new Map(projects.map((p) => [p.ref, p])),
    consultants,
    contractors,
    consultantById: new Map(consultants.map((c) => [c.id, c])),
    contractorById: new Map(contractors.map((c) => [c.id, c])),
    ownerById: new Map(owners.map((o) => [o.id, o])),
  };
}

export function loadRegister(): Promise<Register> {
  if (!cached) {
    cached = load().catch((e: unknown) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function useRegister(): { data?: Register; error?: string } {
  const [state, setState] = useState<{ data?: Register; error?: string }>({});
  useEffect(() => {
    let alive = true;
    loadRegister()
      .then((data) => alive && setState({ data }))
      .catch((e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
