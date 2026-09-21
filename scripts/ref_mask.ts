/**
 * Seeded reference masking for the published register.
 *
 * The private source carries the licensed market-intelligence register's own project reference
 * numbers. Those never reach the published tree. This module builds a deterministic map from each
 * real reference to a fictional one that looks nothing like the source style: a two-letter country
 * code taken from the real reference, then seven characters from an alphabet with no 0/O or 1/I.
 *
 * The map is a pure function of (REF_SEED, the sorted list of real references), so rebuilding it
 * from the same private source yields byte-identical output and the published data stays stable.
 */

/** The generator's PRNG. Exported here so the generator and the mask share one implementation. */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dedicated seed, kept separate from the demo-data seed so neither disturbs the other's stream. */
export const REF_SEED = 20260913;

/** No 0/O and no 1/I, so a reference can be read aloud or retyped without ambiguity. */
export const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REF_BODY_LENGTH = 7;

/** A published reference: two country letters, then seven alphabet characters. */
export const FICTIONAL_REF_RE = /^[A-Z]{2}[A-HJ-NP-Z2-9]{7}$/;
/** A real source reference, in the shape this repository must never publish. */
export const REAL_REF_RE = /\bPRJ[A-Z]{2}\d+\b/;
export const REAL_REF_RE_G = /\bPRJ[A-Z]{2}\d+\b/g;

export interface RefMask {
  /** real reference -> fictional reference */
  toFictional: Map<string, string>;
  /** fictional reference -> real reference */
  toReal: Map<string, string>;
}

export interface MaskableProject {
  ref: string;
  country?: string;
}

/** The two country letters: from the reference itself, else a country field, else XX. */
export function countryPrefix(project: MaskableProject): string {
  const inRef = /^PRJ([A-Z]{2})/.exec(project.ref);
  if (inRef) return inRef[1]!;
  const country = (project.country ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) return country;
  return 'XX';
}

/**
 * Build the real -> fictional map. References are visited in sorted order so the result depends
 * only on the seed and the set of references, never on the order they arrived in.
 */
export function buildRefMask(projects: readonly MaskableProject[]): RefMask {
  const prefixOf = new Map<string, string>();
  for (const p of projects) if (!prefixOf.has(p.ref)) prefixOf.set(p.ref, countryPrefix(p));

  const rnd = mulberry32(REF_SEED);
  const toFictional = new Map<string, string>();
  const toReal = new Map<string, string>();

  for (const real of [...prefixOf.keys()].sort()) {
    const prefix = prefixOf.get(real)!;
    let fictional = '';
    let attempts = 0;
    do {
      if (++attempts > 1000) throw new Error(`could not mint a unique reference for ${real}`);
      let body = '';
      for (let i = 0; i < REF_BODY_LENGTH; i++) body += REF_ALPHABET[Math.floor(rnd() * REF_ALPHABET.length)]!;
      fictional = prefix + body;
    } while (toReal.has(fictional));
    toFictional.set(real, fictional);
    toReal.set(fictional, real);
  }
  return { toFictional, toReal };
}

/** The private sidecar that lets this local copy restore the real references without any workbook. */
export interface RefMapFile {
  version: 1;
  refSeed: number;
  count: number;
  /** fictional -> real */
  map: Record<string, string>;
}

export function refMapFile(mask: RefMask): RefMapFile {
  return {
    version: 1,
    refSeed: REF_SEED,
    count: mask.toReal.size,
    map: Object.fromEntries([...mask.toReal.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}

/**
 * The source vendor's shorthand. It occurs inside imported free text (a stray test record in the
 * register says "posted to BNC"), so it is scrubbed from every imported string the generator
 * publishes and refused outright by the generator's write guard.
 */
export const VENDOR_RE = /\bBNC\b/gi;
export const VENDOR_NAME = 'the market register';
export const scrubVendor = (text: string) => text.replace(VENDOR_RE, VENDOR_NAME);
