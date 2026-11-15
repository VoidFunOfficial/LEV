// Must run before any OpenUI package loads: it keeps the devtools widget off the page.
import "@/openui/devtools";
import type { ComponentType } from "react";
import { OpenUICheckView, OpenUIFenceView } from "./view";

declare const __LEARNEV_OPENUI_CSS__: string;

/** The parts of the DSH client context this plugin uses. */
type ClientContext = {
  effect(execute: () => () => void, label?: string): void;
  slots: {
    inject(slot: string, register: () => unknown): void;
    register(entry: { name: string; key: string; id?: string }, component: ComponentType<never>): unknown;
  };
};

const TOOL_NAME = "openui_check";
const FENCE = "conversation.chat.markdown.fence";
// The fence languages LearnEV's own chat recognizes (src/ui/answer-parts.ts).
const LANGUAGES = ["openui", "openui-lang", "oui"];

export const name = "learnev-lev";
export const inject = ["slots"];

export function apply(ctx: ClientContext) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.owner = "@learnev/lev";
    style.textContent = __LEARNEV_OPENUI_CSS__;
    document.head.append(style);
    return () => style.remove();
  }, "learnev openui styles");
  for (const key of LANGUAGES)
    ctx.slots.inject(FENCE, () =>
      ctx.slots.register({ name: FENCE, key, id: "@learnev/lev/fence" }, OpenUIFenceView),
    );
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register({ name: "tool.call.toolview", key: TOOL_NAME }, OpenUICheckView),
  );
}
