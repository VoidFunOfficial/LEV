// Packs the LearnEV server, the built UI and its runtime npm packages for the mobile apps.
// Usage (after `npm run build`): node mobile/prepare-runtime.mjs <android|ios>
//   android: mobile/android/app/build/generated/learnev/assets/runtime.zip and runtime.id
//   ios:     mobile/build/runtime/, copied into the app bundle by the Xcode project
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const target = process.argv[2];
if (target !== 'android' && target !== 'ios') throw new Error('Usage: node mobile/prepare-runtime.mjs <android|ios>');
const mobile = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(mobile);
if (!existsSync(path.join(root, '.next/server/app/index.html'))) throw new Error('No production build. Run npm run build first.');
const work = path.join(mobile, 'build/runtime');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const external = ['@earendil-works/pi-ai', '@earendil-works/pi-coding-agent', 'proper-lockfile', 'zod', 'typebox'];

// Preserve npm's resolution (including nested package versions) and the SDK's dynamically read model data.
const copied = new Set();
function copyPackage(name, from, optional = false) {
  let dir = from;
  let pkg;
  for (;;) {
    pkg = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(pkg, 'package.json'))) break;
    if (dir === root) {
      if (optional) return;
      throw new Error('Missing npm package: ' + name + '. Run npm ci first.');
    }
    dir = path.dirname(dir);
  }
  if (copied.has(pkg)) return;
  copied.add(pkg);
  const manifest = JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8'));
  cpSync(pkg, path.join(work, path.relative(root, pkg)), { recursive: true, filter(file) {
    const rel = path.relative(pkg, file);
    return !rel.split(path.sep).some(p => ['node_modules', '.git', 'coverage', 'test', 'tests', '__tests__'].includes(p)) &&
      !/\.(map|d\.[cm]?ts|node)$/.test(rel);
  } });
  for (const dep of Object.keys(manifest.dependencies || {})) copyPackage(dep, pkg, dep in (manifest.optionalDependencies || {}));
  for (const dep of Object.keys(manifest.optionalDependencies || {})) copyPackage(dep, pkg, true);
  for (const dep of Object.keys(manifest.peerDependencies || {})) copyPackage(dep, pkg, manifest.peerDependenciesMeta?.[dep]?.optional === true);
}

await build({ absWorkingDir: root, entryPoints: ['mobile/runtime/server.mjs'], platform: 'node', format: 'esm',
  bundle: true, target: 'node24', outfile: path.join(work, 'server.mjs'), external, logLevel: 'warning' });
for (const name of external) copyPackage(name, root);
const copy = (source, name) => cpSync(path.join(root, source), path.join(work, name), { recursive: true });
copy('.next/server/app/index.html', 'www/index.html');
copy('.next/static', 'www/_next/static');
copy('src/app/icon.svg', 'www/icon.svg');
for (const name of ['system-prompt.txt', 'teaching-guide.md']) copy('src/openui/' + name, 'prompts/' + name);
copy('src/openui/LICENSE', 'notices/open-intelligent-ui.txt');
copy('mobile/notices', 'notices');
if (target === 'android') copy('mobile/android/build/notices/Android-NDK.txt', 'notices/Android-NDK.txt');
for (const id of ['workspace', 'tutor']) {
  copy(`agent/${id}/system.md`, `seed/${id}/system.md`);
  // The apps cannot render previews, so their presets leave render2img out.
  const profile = JSON.parse(readFileSync(path.join(root, `agent/${id}/agent.json`), 'utf8'));
  profile.tools = (profile.tools ?? []).filter(tool => tool !== 'render2img');
  writeFileSync(path.join(work, `seed/${id}/agent.json`), JSON.stringify(profile, null, 2) + '\n');
}
// Provider credentials and personal registry entries belong to the phone's settings.
writeFileSync(path.join(work, 'seed/models.json'), JSON.stringify({ providers: {} }, null, 2) + '\n');

if (target === 'android') {
  const generated = path.join(mobile, 'android/app/build/generated/learnev/assets');
  mkdirSync(generated, { recursive: true });
  const staged = path.join(mobile, 'build/runtime.zip');
  rmSync(staged, { force: true });
  execFileSync('zip', ['-q', '-1', '-r', staged, '.'], { cwd: work });
  const hash = createHash('sha256').update(readFileSync(staged)).digest('hex');
  const zip = path.join(generated, 'runtime.zip');
  renameSync(staged, zip);
  writeFileSync(path.join(generated, 'runtime.id'), hash + '\n');
  console.log(`Packaged ${copied.size} npm packages, the UI and two agent presets for Android (${Math.ceil(statSync(zip).size / 1048576)} MiB).`);
} else {
  console.log(`Packaged ${copied.size} npm packages, the UI and two agent presets for iOS in ${path.relative(root, work)}.`);
}
