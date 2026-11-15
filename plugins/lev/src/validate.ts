// Host-side check of an OpenUI program: LearnEV's parser, schema and problem wording,
// without a browser. Runtime crashes (a wrong argument type) only show up in the view itself.
import { createParser, type LibraryJSONSchema } from "@openuidev/lang-core";
import { answerParts, repairProgram } from "../../../src/ui/answer-parts.ts";
import { renderProblems } from "../../../src/server/render/openui-image.ts";

/** The component schema, inlined by build.mjs from the live component library. */
declare const __OPENUI_SCHEMA__: LibraryJSONSchema;

const parser = createParser(__OPENUI_SCHEMA__, "Col");

export type Validation = { statementCount: number; problems: string[] };

/** LearnEV's fence matcher takes no info string after the language; DSH shows it as the view's title. */
const titledFence = /^(\s*```\s*(?:openui(?:-lang)?|oui))[ \t]+\S.*$/gim;

export function validateProgram(code: string): Validation {
  const ui = answerParts(code.replace(titledFence, "$1"), false).ui;
  const program = repairProgram(ui || code);
  let meta;
  try {
    meta = parser.parse(program.code).meta;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    meta = { incomplete: false, unresolved: [], orphaned: [], statementCount: 0, errors: [{ message }] };
  }
  const seen = new Set<string>();
  const errors = meta.errors.filter((e: { message: string; severity?: string }) => {
    if (e.severity === "warning" || seen.has(e.message)) return false;
    seen.add(e.message);
    return true;
  });
  return {
    statementCount: meta.statementCount,
    problems: renderProblems({
      hasProgram: /^\s*root\s*=/m.test(program.code),
      statementCount: meta.statementCount,
      incomplete: meta.incomplete,
      unresolved: meta.unresolved,
      orphaned: meta.orphaned,
      stray: program.stray,
      errors,
    }),
  };
}
