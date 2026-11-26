// Kestrel Ridge — entry hand-in for the make.fun best-flight-game bounty.
//
// This program is the entrypoint of the repository. It takes the game and its
// screenshots from beside this file and assembles the submission payload in
// the output directory: a verbatim copy of game/ and screenshots/, plus a
// dossier.json built from them by the vendored make.fun library. It runs on
// Node 22 with the standard library only — nothing is installed first — so it
// only uses node:fs, node:path and node:url.
//
// The game itself is plain static files under game/ (index.html plus ES
// modules, a vendored Hairline figure under game/vendor/, no build step, no
// network request). Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, e.g.:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Directory holding this file, and the directory the grader reads.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy a directory tree when it exists; screenshots/ is optional in the
// repository but the gate requires 3–4 images, so it is present here.
function copyTree(name) {
  const source = join(repoRoot, name);
  if (!existsSync(source)) return;
  cpSync(source, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// The dossier is byte for byte what buildDossier writes from the copied
// files, with the gate's caps applied: the text budget for the judge's view,
// at most 4 screenshots of 256 KiB each, and the game/ size limits.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
