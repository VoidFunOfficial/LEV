# LEV：技能和 DeepSeek Harness 插件

LEV 用 LearnEV（LearnEverything）的 OpenUI 语言做可以操作的界面：知识卡片、可拖动的公式演示、闪卡练习、小测验、计算器、图表、示意图和学习报告。

这个包分两部分，可以分开用：

| 部分 | 位置 | 用在哪里 | 作用 |
| --- | --- | --- | --- |
| `lev` 技能 | `skills/lev/` | 任何支持技能目录（`SKILL.md`）的智能体：Claude Code、Codex、Droid、DeepSeek Harness 等 | 写界面的流程、语法要点、版式建议、完整的语言参考和教学指南，以及检查程序的脚本 `scripts/check.mjs` |
| DeepSeek Harness 插件 | 整个包 | DeepSeek Harness（DSH） | 自带上面的技能；加一个 `openui_check` 检查工具；把助手回复里的 `` ```openui `` 代码块直接显示成实时界面，可以点击、拖动和输入 |

实时界面只在装了插件的 DSH 里有。其他环境里，智能体照样按技能写好并检查程序，交付的代码块显示成源码。

## 包里有什么

```text
lev/
├── package.json, index.js, cordis.patch.yml, locale/, icon.svg   DSH 插件
├── dist/client.js                     DSH 对话里的实时界面（LearnEV 的组件、样式和字体）
└── skills/lev/                        独立技能
    ├── SKILL.md
    ├── references/openui-language.md  OpenUI 语言完整参考
    ├── references/teaching-guide.md   教学类界面的设计指南
    └── scripts/check.mjs, validate.js 检查脚本（不依赖其他文件）
```

所有文件都在包里，不依赖 LearnEV 仓库，也不需要 `npm install`。

## 获取

发布的文件有两个：

| 文件 | 内容 | 用途 |
| --- | --- | --- |
| `learnev-lev-<版本>.tgz` | 整个包 | 安装到 DSH；解压后 `package/skills/lev` 就是技能目录 |
| `lev-skill-<版本>.zip` | 只有技能目录 | 安装到 Claude Code、Codex、Droid 等 |

在 LearnEV 仓库里自己生成：

```sh
npm install
npm run pack:lev
```

产物在仓库的 `dist/` 下：`dist/lev/`（解开的包）、`dist/learnev-lev-<版本>.tgz` 和 `dist/lev-skill-<版本>.zip`。只要目录、不要压缩包时运行 `npm run build:lev`。

## 要求

- DeepSeek Harness：0.2.2 或更新的桌面端或命令行。插件用 DSH 自带的运行时，不需要另装 Node.js。
- 其他智能体：检查脚本需要 Node.js 18 或更新版本（已在 Node.js 22 上测试）。没有 Node.js 时技能仍然能用，只是不能检查程序。
- 界面里的 `SearchImage`（维基百科图片）和 `Map`（OpenFreeMap 地图）需要能访问外网。

## 安装到 DeepSeek Harness

### 桌面端

1. 打开 DSH，在侧栏选择 **插件**，点 **添加插件**。
2. 输入 `.tgz` 文件的绝对路径，例如 `/Users/你/Downloads/learnev-lev-0.3.0.tgz`，或者解开的包目录的绝对路径，然后安装。
3. 重启 DSH。

### 命令行

```sh
# 从压缩包安装（复制一份到 profile 里）
dsh plugin --profile desktop add /绝对路径/learnev-lev-0.3.0.tgz

# 或者链接到目录：重新构建后重启 DSH 就是新版本，适合开发
dsh plugin --profile desktop add link:/绝对路径/lev
```

`desktop` 是桌面端用的 profile。命令行的 `web`、`tui`、`headless` 等 profile 用同样的命令，把 `desktop` 换成对应的名字。macOS 上 `dsh` 不在 PATH 里时，用 `"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"`。装完重启 DSH。

### 检查是否装好

新开一个会话，输入“用 OpenUI 做一个可以拖动的勾股定理演示”。智能体会加载 `lev` 技能，调用 `openui_check`，然后在回复里显示一个可以拖动的界面。也可以输入 `/lev` 直接调用技能。

### 更新和卸载

- 更新：先卸载，再安装新的 `.tgz`。用 `link:` 安装的，重新构建后重启 DSH 即可。
- 卸载：在 **插件** 页面移除，或运行 `dsh plugin --profile desktop remove @learnev/lev`。卸载后技能、工具和界面一并移除。

## 安装到其他智能体

想让智能体自己装时，把 [INSTALL.md](../INSTALL.md) 交给它：“按这个文件安装 LEV”。手动安装按下面的步骤。

把 `lev` 技能目录放进智能体读取技能的目录，目录名保持 `lev`。下面的命令都假设 zip 在当前目录；从仓库安装时把 `unzip …` 换成 `cp -R dist/lev/skills/lev <目标目录>/`。

| 智能体 | 所有项目可用 | 只在某个项目里用 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/` | `<项目>/.claude/skills/` |
| Codex | `~/.codex/skills/` | `<项目>/.agents/skills/` |
| Droid（Factory） | `~/.factory/skills/` | `<项目>/.factory/skills/` 或 `<项目>/.agents/skills/` |
| 其他读取 `.agents/skills` 的智能体 | `~/.agents/skills/` | `<项目>/.agents/skills/` |

### Claude Code

```sh
mkdir -p ~/.claude/skills
unzip lev-skill-0.3.0.zip -d ~/.claude/skills
```

### Codex

```sh
mkdir -p ~/.codex/skills
unzip lev-skill-0.3.0.zip -d ~/.codex/skills
```

### Droid

```sh
mkdir -p ~/.factory/skills
unzip lev-skill-0.3.0.zip -d ~/.factory/skills
```

### 通用 `.agents/skills`

```sh
mkdir -p .agents/skills          # 项目里；所有项目可用时改成 ~/.agents/skills
unzip lev-skill-0.3.0.zip -d .agents/skills
```

Windows PowerShell 用 `Expand-Archive lev-skill-0.3.0.zip -DestinationPath $HOME\.claude\skills`，目标目录按上表替换。

装好后的目录应该是 `<目标目录>/lev/SKILL.md`。新开一个会话让智能体加载技能，再让它“用 OpenUI 做一个勾股定理演示”：它会读参考文件，用 `scripts/check.mjs` 检查程序，回复里给出 `` ```openui `` 代码块。这些环境的对话框不能运行插件，代码块显示成源码；要看到界面，在装了插件的 DSH 里让智能体显示这段程序。

手动试检查脚本：

```sh
node ~/.claude/skills/lev/scripts/check.mjs - <<'OUI'
root = Col([Title("你好")])
OUI
# stdin  no problems (1 statements)
```

退出码 0 表示没有问题，2 表示有问题（逐条列出），1 表示读不到输入；加 `--json` 输出 JSON。

### 更新和卸载

更新时删除旧的 `lev` 目录，再解压新版本。卸载就删除这个目录。

## 说明

- DSH 里，代码块语言名后面的文字是界面标题：`` ```openui 勾股定理 ``。`openui-lang` 和 `oui` 也能识别。
- DSH 在一轮回答结束后会折叠工具调用，所以界面放在回复里，检查结果在折叠的工具调用里，展开能看到程序的静态预览。
- 界面里请助手回答的按钮会在同一个对话里发出新消息，末尾附上一行 `交互状态.json: {...}`。界面状态按程序内容保存在浏览器本地，两个完全相同的程序共用一份状态。
- 没有装插件的 DSH 会把 `openui` 代码块显示成普通代码。

## 开发

源码在 LearnEV 仓库的 `plugins/lev/`：

| 路径 | 内容 |
| --- | --- |
| `skill/` | 技能的 `SKILL.md` 和 `scripts/check.mjs`；构建时加上参考文件和 `validate.js` |
| `package/` | DSH 插件的清单、宿主入口 `index.js`、本地化文案和本说明 |
| `src/client.tsx`、`src/view.tsx` | 实时界面：注册到 `conversation.chat.markdown.fence`（`openui` 等语言）和 `tool.call.toolview`（检查行），内部用 LearnEV 的 `InteractiveAnswer` |
| `src/validate.ts` | 检查器，和 LearnEV 的解析器、问题描述一致 |
| `src/api-shim.ts`、`src/map-worker.ts` | 浏览器里代替 LearnEV 服务端接口（维基百科图片、路线），以及地图的 worker |
| `build.mjs` | 用 esbuild 生成整个包；`--pack` 再生成 `.tgz` 和 `.zip` |

仓库里 `src/openui` 或 `src/ui` 更新后重新构建。检查类型：`npx tsc --noEmit -p plugins/lev/tsconfig.json`。
