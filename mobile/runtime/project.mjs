import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const digest = text => createHash('sha256').update(text).digest('hex');
async function replaceFile(file, contents) {
  await writeFile(file + '.learnev-new', contents);
  await rename(file + '.learnev-new', file);
}

async function upgradePresets(agents, seed) {
  for (const id of ['workspace', 'tutor']) {
    const file = path.join(agents, id, 'agent.json');
    const prompt = path.join(agents, id, 'system.md');
    if (!existsSync(file) || !existsSync(prompt)) continue;
    const before = await readFile(file, 'utf8');
    let profile;
    try { profile = JSON.parse(before); } catch { continue; }
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) continue;
    const preset = JSON.parse(await readFile(path.join(seed, id, 'agent.json'), 'utf8'));
    const existingPrompt = (await readFile(prompt, 'utf8')).trim();
    // Replace only fields from the shipped presets. Model choices and custom prompts survive updates.
    if (id === 'workspace') {
      if (profile.name === '工作区助手') profile.name = preset.name;
      if (profile.description === '阅读和修改项目文件，解释代码，制作交互式工具。') profile.description = preset.description;
      if (digest(JSON.stringify(profile.starters ?? [])) === '29a87d5f9164c91498b50e1a538eefd2ce87b75e290827d6c97097c5801a1c88')
        profile.starters = preset.starters;
      if (JSON.stringify(profile.tools) === '["read","ls","find","grep","edit","write"]') profile.tools = preset.tools;
      if (digest(existingPrompt) === 'b17d457038e20867f1f41499067b5a362fc4d84a51a478a37d1fd66f5c409862')
        await replaceFile(prompt, await readFile(path.join(seed, id, 'system.md'), 'utf8'));
    } else if (JSON.stringify({ ...profile, tools: preset.tools }) === JSON.stringify(preset) &&
               Array.isArray(profile.tools) && !profile.tools.length &&
               existingPrompt === (await readFile(path.join(seed, id, 'system.md'), 'utf8')).trim()) {
      profile.tools = preset.tools;
    }
    if (JSON.stringify(profile) !== JSON.stringify(JSON.parse(before)))
      await replaceFile(file, JSON.stringify(profile, null, 2) + '\n');
  }
}

/** Seeds agent/ in the working directory on first launch. Later launches keep the user's agents. */
export async function initializeProject(seed) {
  const dir = process.cwd();
  // The marker keeps the name earlier Android releases wrote, so their installs are not reseeded.
  const marker = path.join(dir, '.learngpt-projects-v1');
  if (existsSync(marker)) return;
  const agents = path.join(dir, 'agent');
  await mkdir(agents, { recursive: true });
  await cp(seed, agents, { recursive: true, force: false });
  if (existsSync(path.join(dir, '.learnev-initialized'))) await upgradePresets(agents, seed);
  await writeFile(marker, '1');
}
