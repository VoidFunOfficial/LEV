#!/usr/bin/env node
// Checks OpenUI programs with LearnEV's parser, without a browser or the LearnEV repository.
// Usage: node check.mjs <file ...> [--json]    (use - to read standard input)
// A file may hold a bare program or a whole Markdown reply with an ```openui fence.
// Exit code: 0 no problems, 2 problems found, 1 an input could not be read.
import { readFile } from 'node:fs/promises'
import { validateProgram } from './validate.js'

const args = process.argv.slice(2)
const json = args.includes('--json')
const inputs = args.filter(a => a !== '--json')

if (!inputs.length || inputs.includes('-h') || inputs.includes('--help')) {
  console.log('Usage: node check.mjs <file ...> [--json]\n  -  read the program from standard input\nExit code: 0 no problems, 2 problems found, 1 an input could not be read.')
  process.exit(inputs.length ? 0 : 1)
}

async function stdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const results = []
for (const input of inputs) {
  try {
    const code = input === '-' ? await stdin() : await readFile(input, 'utf8')
    results.push({ input, ...validateProgram(code) })
  } catch (error) {
    results.push({ input, error: error instanceof Error ? error.message : String(error) })
  }
}

if (json) console.log(JSON.stringify(results, null, 2))
else
  for (const r of results) {
    const name = r.input === '-' ? 'stdin' : r.input
    if (r.error) console.log(`${name}  read failed: ${r.error}`)
    else if (!r.problems.length) console.log(`${name}  no problems (${r.statementCount} statements)`)
    else {
      console.log(`${name}  ${r.problems.length} problem${r.problems.length > 1 ? 's' : ''} (${r.statementCount} statements)`)
      for (const p of r.problems) console.log(`  - ${p}`)
    }
  }

process.exitCode = results.some(r => r.error) ? 1 : results.some(r => r.problems.length) ? 2 : 0
