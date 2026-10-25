// Extrait dans deploy/node_modules les seules deps runtime du serveur bundlé (cible Docker : linux/x64/musl par défaut).
// Usage : node scripts/prepare-runtime-deps.mjs [--platform win32] [--arch x64] [--libc glibc]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdout } from 'node:process';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'deploy', 'node_modules');

const { values: target } = parseArgs({
  options: {
    platform: { type: 'string', default: 'linux' },
    arch: { type: 'string', default: 'x64' },
    libc: { type: 'string', default: 'musl' },
  },
});

// Liste partagée avec server/tsup.config.ts (modules laissés hors du bundle)
const externals = JSON.parse(readFileSync(join(root, 'server', 'runtime-externals.json'), 'utf8'));

// Paquets jamais require au runtime : headers C++ (node-gyp) et télémétrie postinstall
const BUILD_ONLY = new Set(['node-addon-api', '@scarf/scarf']);

// Résolution Node standard : server/node_modules puis node_modules racine
const searchDirs = [join(root, 'server', 'node_modules'), join(root, 'node_modules')];

function findPackage(name) {
  const dir = searchDirs.map((d) => join(d, name)).find((d) => existsSync(join(d, 'package.json')));
  if (dir === undefined) throw new Error(`Paquet introuvable : ${name}`);
  return dir;
}

// Parcours récursif des `dependencies` et des peers non optionnels (swagger-ui-express require express)
const packages = new Map();
function collect(name) {
  if (packages.has(name) || BUILD_ONLY.has(name)) return;
  const dir = findPackage(name);
  packages.set(name, dir);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const peers = Object.keys(pkg.peerDependencies ?? {}).filter(
    (peer) => pkg.peerDependenciesMeta?.[peer]?.optional !== true,
  );
  for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...peers]) collect(dep);
}
externals.forEach(collect);

rmSync(join(root, 'deploy'), { recursive: true, force: true });
for (const [name, dir] of packages) {
  const dest = join(outDir, name);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(dir, dest, { recursive: true });
}

function remove(rel) {
  rmSync(join(outDir, rel), { recursive: true, force: true });
}

function walkMaps(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMaps(full);
    else if (entry.name.endsWith('.map')) rmSync(full);
  }
}

// Sources de compilation inutiles avec les prebuilds
['better-sqlite3/deps', 'better-sqlite3/src', 'bcrypt/src', 'bcrypt/test', 'bcrypt/examples'].forEach(remove);
walkMaps(outDir);

// better-sqlite3 (lib/binding.js) : prebuilds/<linuxmusl|platform>-<arch>.node
const sqliteKey = `${target.platform === 'linux' && target.libc === 'musl' ? 'linuxmusl' : target.platform}-${target.arch}.node`;
const sqlitePrebuilds = join(outDir, 'better-sqlite3', 'prebuilds');
for (const file of readdirSync(sqlitePrebuilds)) {
  if (file !== sqliteKey) rmSync(join(sqlitePrebuilds, file));
}

// bcrypt (node-gyp-build) : prebuilds/<platform>-<arch>/bcrypt[.<libc>].node
const bcryptPrebuilds = join(outDir, 'bcrypt', 'prebuilds');
for (const dir of readdirSync(bcryptPrebuilds)) {
  const full = join(bcryptPrebuilds, dir);
  if (dir === `${target.platform}-${target.arch}`) {
    for (const file of readdirSync(full)) {
      const libcTag = /\.(glibc|musl)\.node$/.exec(file)?.[1];
      if (libcTag !== undefined && libcTag !== target.libc) rmSync(join(full, file));
    }
  } else {
    rmSync(full, { recursive: true, force: true });
  }
}

// Vérifie que les binaires attendus sont bien présents
if (!existsSync(join(sqlitePrebuilds, sqliteKey))) throw new Error(`Prebuild better-sqlite3 absent : ${sqliteKey}`);
if (readdirSync(join(bcryptPrebuilds)).length === 0) throw new Error('Prebuild bcrypt absent');

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

const natives = [];
(function findNodeFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findNodeFiles(full);
    else if (entry.name.endsWith('.node')) natives.push(full.slice(outDir.length + 1));
  }
})(outDir);

stdout.write(`Paquets : ${[...packages.keys()].join(', ')}\n`);
stdout.write(`Binaires : ${natives.join(', ')}\n`);
stdout.write(`Cible : ${target.platform}-${target.arch}-${target.libc}\n`);
stdout.write(`Taille deploy/node_modules : ${(dirSize(outDir) / 1024 / 1024).toFixed(1)} Mo\n`);
