import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Code2, LayoutPanelTop, ListChecks } from "lucide-react";
import InteractiveAnswer from "@/ui/InteractiveAnswer";
import { answerParts } from "@/ui/answer-parts";
import type { Attachment } from "@/shared/types";

type InputActions = { setDraft(text: string): void; submit(): void };

/** The parts of the DSH `conversation.chat.markdown.fence` owner props this view reads. */
export type FenceViewProps = {
  lang: string;
  code: string;
  streaming: boolean;
  meta?: string;
  inputActions?: InputActions;
};

/** The parts of the DSH `tool.call.toolview` owner props this view reads. */
type ToolBlock = {
  args: { text(key: string): string | undefined };
  isError?: boolean;
  content?: readonly { type: string; text?: string }[];
  error?: { name?: string; code?: string; reason?: string };
};
export type ToolViewProps = {
  phase: "preparing" | "start" | "result";
  block: ToolBlock;
  callId: string;
};

const zh = () => (document.documentElement.lang || navigator.language).toLowerCase().startsWith("zh");
const say = (chinese: string, english: string) => (zh() ? chinese : english);

/** DSH marks its dark theme on <body>; the library's colors follow a data-theme attribute. */
function useHostTheme(): "light" | "dark" {
  const read = (): "light" | "dark" => (document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light");
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    setTheme(read());
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** FNV-1a, enough to key a view's saved state by its program. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * Composer message for @ToAssistant and form submits. The user bubble shows plain text,
 * so each attachment goes on its own line instead of in a Markdown fence.
 */
function message(text: string, attachments: Attachment[]) {
  const parts = [text.trim() || say("继续", "Continue")];
  for (const a of attachments) parts.push(`${a.name}: ${a.text.trim()}`);
  return parts.join("\n\n");
}

function Frame({ variant, icon, tag, title, status, source, initiallyOpen = true, children }: {
  variant: "fence" | "tool";
  icon: ReactNode;
  tag: string;
  title?: string;
  status?: string;
  source: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useHostTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const [showSource, setShowSource] = useState(false);
  return (
    <div className="lgoui-row" data-variant={variant}>
      <div className="lgoui-head">
        <button type="button" className="lgoui-btn lgoui-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          {icon}
          <span className="lgoui-tag">{tag}</span>
          {title && <span className="lgoui-title">{title}</span>}
        </button>
        {status && <span className="lgoui-status">{status}</span>}
        <span className="lgoui-actions">
          {source && (
            <button type="button" className="lgoui-btn" aria-expanded={showSource} onClick={() => setShowSource(!showSource)}>
              <Code2 size={13} aria-hidden />
              {showSource ? say("收起源码", "Hide source") : say("源码", "Source")}
            </button>
          )}
        </span>
      </div>
      {showSource && <pre className="lgoui-source">{source}</pre>}
      {open && (
        <div className="lgoui-root lgoui-body" data-theme={theme}>
          {children}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="view-loading" aria-label={say("正在生成", "Generating")}>
      <span />
      <span />
      <span />
    </div>
  );
}

/** A ```openui fence in an assistant reply, shown as the live view. */
export function OpenUIFenceView({ code, streaming, meta, inputActions }: FenceViewProps) {
  const send = inputActions
    ? (text: string, attachments: Attachment[] = []) => {
        inputActions.setDraft(message(text, attachments));
        // The draft store publishes the new text before the composer reads it for submission.
        setTimeout(() => inputActions.submit(), 0);
      }
    : undefined;
  return (
    <Frame
      variant="fence"
      icon={<LayoutPanelTop size={14} aria-hidden />}
      tag="OpenUI"
      title={meta?.trim() || undefined}
      status={streaming ? say("正在生成…", "Generating…") : undefined}
      source={code}
    >
      {code.trim() ? (
        <InteractiveAnswer source={code} streaming={streaming} turnId={streaming ? "dsh:streaming" : `dsh:${hash(code)}`} send={send} />
      ) : (
        <Loading />
      )}
    </Frame>
  );
}

function resultText(block: ToolBlock) {
  return (block.content ?? []).flatMap((part) => (part.type === "text" && part.text ? [part.text] : [])).join("\n");
}

/** The openui_check call row: a status line, with the program as a static preview when opened. */
export function OpenUICheckView({ phase, block }: ToolViewProps) {
  const raw = block.args.text("code") ?? "";
  const source = answerParts(raw, phase === "preparing").ui || (phase === "preparing" ? "" : raw);
  const text = phase === "result" ? resultText(block) : "";
  const failed = phase === "result" && block.isError === true;
  const problems = phase === "result" && !failed ? text.split("\n").filter((line) => line.startsWith("- ")).length : 0;
  const status =
    phase === "preparing" ? say("正在生成…", "Generating…")
    : phase === "start" ? say("检查中…", "Checking…")
    : failed ? say("检查失败", "Check failed")
    : problems ? say(`${problems} 个问题`, `${problems} problem${problems > 1 ? "s" : ""}`)
    : say("没有问题", "No problems");
  return (
    <Frame
      variant="tool"
      icon={<ListChecks size={14} aria-hidden />}
      tag={say("OpenUI 检查", "OpenUI check")}
      title={block.args.text("title")?.trim() || undefined}
      status={status}
      source={raw}
      initiallyOpen={false}
    >
      {failed ? (
        <div className="lgoui-error">{text || block.error?.reason || block.error?.code || say("工具调用失败。", "The tool call failed.")}</div>
      ) : source ? (
        <InteractiveAnswer source={source} streaming={phase === "preparing"} turnId="dsh:check" />
      ) : (
        <Loading />
      )}
    </Frame>
  );
}
