# 安装 LEV 技能

本文件写给智能体（Claude Code、Codex、Droid 等）。用户让你“按这个文件安装 LEV”时，照下面的步骤把 `lev` 技能装进你自己读取技能的目录，验证后告诉用户结果。

LEV 用 LearnEV 的 OpenUI 语言做可以操作的界面：知识卡片、公式演示、闪卡、小测验、图表和学习报告。技能是一个自包含的目录，里面有说明、完整的语言参考和检查脚本，不依赖 LearnEV 仓库。

## 规则

- 只改技能目录：新建或替换 `<技能目录>/lev`，不动其他技能和用户的项目文件。
- 下载和构建都在临时目录里做，不要把仓库克隆进用户的项目。
- 本文件只安装技能。不要运行仓库里的 `install.sh`、`npm start` 或其他命令。
- 某一步失败时，把命令和错误原文告诉用户，不要换别的来源或猜测路径。

## 1. 确定技能目录

先确定你是哪个智能体。用户没说装到哪个项目时，装到“所有项目可用”的目录。

| 智能体 | 所有项目可用 | 只在某个项目里用 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills` | `<项目>/.claude/skills` |
| Codex | `~/.codex/skills` | `<项目>/.agents/skills` |
| Droid（Factory） | `~/.factory/skills` | `<项目>/.factory/skills` |
| 其他读取 `.agents/skills` 的智能体 | `~/.agents/skills` | `<项目>/.agents/skills` |

不在表里、也不确定自己读哪个目录时，先问用户。下文用 `SKILLS` 代表选定的目录（Windows 上 `~` 是 `$HOME`）。

## 2. 获取技能

优先下载发布的压缩包。需要 `curl` 和 `unzip`，Windows 上用 PowerShell。

```sh
SKILLS=~/.claude/skills            # 换成第 1 步选定的目录
tmp=$(mktemp -d)
curl -fL -o "$tmp/lev-skill.zip" https://github.com/VoidFunOfficial/LEV/releases/latest/download/lev-skill.zip
```

```powershell
$Skills = "$HOME\.claude\skills"    # 换成第 1 步选定的目录
$Tmp = Join-Path $env:TEMP "lev-$(Get-Random)"
New-Item -ItemType Directory -Path $Tmp | Out-Null
Invoke-WebRequest -Uri https://github.com/VoidFunOfficial/LEV/releases/latest/download/lev-skill.zip -OutFile "$Tmp\lev-skill.zip"
```

下载返回 404（仓库还没有发布版本），或者用户要求用最新源码时，从源码构建。需要 `git` 和 Node.js 24（至少 22.13）：

```sh
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/VoidFunOfficial/LEV.git "$tmp/LEV"
(cd "$tmp/LEV" && npm ci --no-audit --no-fund && npm run build:lev)
# 构建好的技能目录：$tmp/LEV/dist/lev/skills/lev
```

## 3. 安装

先删掉旧版本，再放入新版本。早期版本叫 `openui-view`，如果 `SKILLS` 里有这个目录，一并删掉，否则会出现两个同样的技能。

```sh
mkdir -p "$SKILLS"
rm -rf "$SKILLS/lev" "$SKILLS/openui-view"
unzip -q "$tmp/lev-skill.zip" -d "$SKILLS"          # 用压缩包
# cp -R "$tmp/LEV/dist/lev/skills/lev" "$SKILLS/"   # 或者用源码构建的目录
rm -rf "$tmp"
```

```powershell
New-Item -ItemType Directory -Force -Path $Skills | Out-Null
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$Skills\lev", "$Skills\openui-view"
Expand-Archive -Path "$Tmp\lev-skill.zip" -DestinationPath $Skills
Remove-Item -Recurse -Force $Tmp
```

装好后的结构：

```text
SKILLS/lev/
├── SKILL.md
├── references/openui-language.md
├── references/teaching-guide.md
└── scripts/check.mjs, scripts/validate.js
```

## 4. 验证

1. `SKILLS/lev/SKILL.md` 存在，开头的 frontmatter 里是 `name: lev`。
2. 运行检查脚本（需要 Node.js 18 或更新版本）：

   ```sh
   node "$SKILLS/lev/scripts/check.mjs" - <<'OUI'
   root = Col([Title("LEV 安装检查")])
   OUI
   ```

   应该输出 `stdin  no problems (1 statements)`，退出码为 0。没有 Node.js 时跳过这一步：技能照样能用，只是写界面时不能检查程序。告诉用户这一点。

## 5. 告诉用户

用一两句话说明：

- 技能装在哪个目录，验证是否通过。
- 新开一个会话后生效。可以输入 `/lev`，或者直接说“用 OpenUI 做一个勾股定理演示”。
- 这里的对话只能把界面显示成源码；装了 LEV 插件的 DeepSeek Harness 才能把回复里的 `openui` 代码块显示成可以操作的界面，插件的安装方法见 [安装说明](package/README.md)。

## DeepSeek Harness

用户要在 DeepSeek Harness（DSH）里用时，装插件，不要手动复制技能，插件自带技能。先移除旧插件（如果装过），再安装：

```sh
tmp=$(mktemp -d)
curl -fL -o "$tmp/learnev-lev.tgz" https://github.com/VoidFunOfficial/LEV/releases/latest/download/learnev-lev.tgz
dsh plugin --profile desktop remove @learnev/openui-view 2>/dev/null || true
dsh plugin --profile desktop add "$tmp/learnev-lev.tgz"
```

`desktop` 是桌面端的 profile，命令行用的 `web`、`tui`、`headless` 换成对应的名字。macOS 上 `dsh` 不在 PATH 里时，用 `"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"`。装完提醒用户重启 DSH。
