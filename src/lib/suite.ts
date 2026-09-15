// Where the three sibling demos live. This is the ONLY place in this repository that knows,
// because the address of a deployment is an operational fact, not code, and it was previously
// written out three times across three repositories with nothing keeping the copies equal.
//
// The default is the Vercel copy, which answers from any network. The node-ss copies answer
// only on the tailnet, so a masthead pointing there is a dead link for anyone off it, which is
// exactly the failure this file turns into a build flag instead of a source edit:
//
//   VITE_SUITE_MIS=https://node-ss.tail640a1e.ts.net:926/ \
//   VITE_SUITE_WMS=https://node-ss.tail640a1e.ts.net:927/ \
//   VITE_SUITE_PIS=https://node-ss.tail640a1e.ts.net:928/ bun run build
//
// Vite inlines these at build time, so a rebuild is required after changing one; nothing reads
// them at runtime.
const env = import.meta.env as Record<string, string | undefined>

export const SUITE = {
  mis: env.VITE_SUITE_MIS ?? 'https://kinetics-mis-demo.vercel.app/',
  wms: env.VITE_SUITE_WMS ?? 'https://kinetics-wms-demo.vercel.app/',
  pis: env.VITE_SUITE_PIS ?? 'https://kinetics-pis-demo.vercel.app/',
} as const
