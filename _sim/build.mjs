import esbuild from 'esbuild';
import path from 'node:path';

// Two bundles of the real estimator: "rules" (the network call to the AI is stubbed to fail, so the built-in
// rules engine does all the understanding) and "llm" (the real supabase client, so the live AI function is used).
const stub = {
  name: 'stub-supabase',
  setup(build) {
    build.onResolve({ filter: /(^|\/)supabase$/ }, (args) => {
      if (!args.importer.includes(path.join('src', 'lib'))) return;
      return { path: path.resolve('_sim/supabaseStub.ts') };
    });
  },
};
for (const mode of ['rules', 'llm']) {
  await esbuild.build({
    entryPoints: ['_sim/entry.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: `_sim/out/${mode}.mjs`,
    plugins: mode === 'rules' ? [stub] : [],
    logLevel: 'error',
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  });
}
console.log('built');
