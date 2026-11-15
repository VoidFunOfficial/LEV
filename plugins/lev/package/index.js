/**
 * DeepSeek Harness bundle for LEV, LearnEV's OpenUI views. The Host half (this file)
 * serves the standalone skill in skills/lev and registers the `openui_check`
 * tool, which runs that skill's bundled checker. The browser half (dist/client.js)
 * shows each ```openui fence in an assistant reply as the live, interactive view;
 * replies stay visible when DSH folds a finished turn's tool calls.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'lev'
export const inject = ['skills', 'tools']

const SKILL_NAME = 'lev'
const PROVIDER = 'learnev-lev'
const TOOL_NAME = 'openui_check'
const BUNDLED_SKILL_RANK = 600
const MAX_CODE = 60_000
const MAX_TITLE = 80
const pluginDir = dirname(fileURLToPath(import.meta.url))
const skillDir = join(pluginDir, 'skills', SKILL_NAME)
const skillFile = join(skillDir, 'SKILL.md')
const references = join(skillDir, 'references')
const BUILD_HINT = 'the package is incomplete; rebuild it with `npm run build:lev` in the LearnEV repository or reinstall the release package, then restart DeepSeek Harness'

const REFERENCE_NOTE = '你在装了 LEV 插件的 DeepSeek Harness 里：界面在对话里实时显示，用 `openui_check` 工具检查。本技能 `references/` 下的两份文件已经附在下面，不用再读。'

/** Frontmatter `key: value` lines; the skill file keeps each value on one line. */
function parseSkill(raw, path) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (!match) throw new Error(`${path} has no YAML frontmatter`)
  const meta = {}
  for (const line of match[1].split(/\r?\n/u)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/u.exec(line)
    if (pair) meta[pair[1]] = pair[2].trim().replace(/^(["'])(.*)\1$/u, '$2')
  }
  if (meta.name !== SKILL_NAME) throw new Error(`${path} must declare name: ${SKILL_NAME}`)
  if (!meta.description) throw new Error(`${path} has no description`)
  return { description: meta.description, body: raw.slice(match[0].length).trim() }
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    statementCount: { type: 'integer' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['statementCount', 'problems'],
}

function summary(value) {
  if (!value.problems.length)
    return `The parser found no problems (${value.statementCount} statements). Now put this exact program in your reply inside a \`\`\`openui fence; the chat shows the fence as the interactive view.`
  return [
    `The parser found problems (${value.statementCount} statements); parts of the view would be wrong or missing.`,
    `Fix them and call ${TOOL_NAME} again with the complete program:`,
    ...value.problems.map(p => '- ' + p),
  ].join('\n')
}

function validateArgs(args) {
  const errors = []
  if (typeof args !== 'object' || args === null) return ['arguments must be an object']
  if (typeof args.code !== 'string' || !args.code.trim()) errors.push('code must be a non-empty OpenUI program')
  else if (args.code.length > MAX_CODE) errors.push(`code must be at most ${MAX_CODE} characters`)
  if (args.title !== undefined && (typeof args.title !== 'string' || args.title.length > MAX_TITLE))
    errors.push(`title must be a string of at most ${MAX_TITLE} characters`)
  return errors
}

export function apply(ctx) {
  let reported
  let validator

  const warnOnce = message => {
    if (reported === message) return
    reported = message
    ctx.logger.warn(`lev: ${message}`)
  }

  async function readSkill(signal) {
    try {
      const [raw, reference, guide] = await Promise.all([
        readFile(skillFile, { encoding: 'utf8', signal }),
        readFile(join(references, 'openui-language.md'), { encoding: 'utf8', signal }),
        readFile(join(references, 'teaching-guide.md'), { encoding: 'utf8', signal }),
      ])
      const skill = parseSkill(raw, skillFile)
      reported = undefined
      return { ...skill, reference: reference.trim(), guide: guide.trim() }
    } catch (error) {
      if (signal?.aborted) throw error
      warnOnce(`skill unavailable (${error?.code === 'ENOENT' ? BUILD_HINT : String(error)})`)
      return undefined
    }
  }

  function loadValidator() {
    validator ??= import(pathToFileURL(join(skillDir, 'scripts', 'validate.js')).href).then(
      module => module.validateProgram,
      error => {
        validator = undefined
        throw new Error(`the OpenUI validator is missing (${error.message}); ${BUILD_HINT}`)
      },
    )
    return validator
  }

  const summaryOf = description => ({
    name: SKILL_NAME,
    description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: skillDir },
    path: skillFile,
  })

  ctx.skills.registerProvider(control => ({
    name: PROVIDER,
    async list(options) {
      const skill = await readSkill(options?.signal)
      if (!skill) return { candidates: [], complete: true }
      return { candidates: [{ ...summaryOf(skill.description), rank: BUNDLED_SKILL_RANK, locator: skillFile }], complete: true }
    },
    async get(_candidate, options) {
      const skill = await readSkill(options?.signal)
      if (!skill) {
        control.invalidate()
        return undefined
      }
      const content = [
        REFERENCE_NOTE,
        skill.body,
        `## 附录 A：references/openui-language.md\n\n${skill.reference}`,
        `## 附录 B：references/teaching-guide.md\n\n${skill.guide}`,
      ].join('\n\n')
      return { ...summaryOf(skill.description), content }
    },
  }))

  ctx.tools.register({
    name: TOOL_NAME,
    description: 'Check an OpenUI program with LearnEV\'s parser before you show it. Returns the problems; fix them and call again with the complete program. When there are none, put the same program in your reply inside a ```openui fence: the chat shows that fence as an interactive view, the only way to show OpenUI in this chat. Load the lev skill before the first call.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        code: { type: 'string', description: 'The complete OpenUI program, starting with root =. No Markdown fences.' },
        title: { type: 'string', description: `Optional short title for this check, at most ${MAX_TITLE} characters.` },
      },
      required: ['code'],
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: summary(value) }],
    },
    async execute(args) {
      const errors = validateArgs(args)
      if (errors.length) throw new Error(`invalid arguments: ${errors.join('; ')}`)
      const validate = await loadValidator()
      return validate(args.code)
    },
    presentCall(args) {
      const title = typeof args?.title === 'string' ? args.title.trim() : ''
      return { card: 'generic', title: title ? `OpenUI check: ${title}` : 'OpenUI check', kind: 'execute' }
    },
  })
}
