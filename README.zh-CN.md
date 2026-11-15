# LearnEV

[English](README.md) | 简体中文

LearnEV 是基于 React 和 Pi 的学习助手，适配桌面和手机浏览器。每个学习项目有独立的对话历史。回答支持流式文字和可交互的卡片、表单与图表。[Open Intelligent UI](https://github.com/thesysdev/open-intelligent-ui)

LearnEV 的交互界面也可以单独使用：LEV 技能让 Claude Code、Codex、Droid 等智能体用同一套 OpenUI 语言写出知识卡片、公式演示、小测验和学习报告。

## 安装和使用

推荐两种方式：想要完整的学习助手，用 LearnEV 应用；已经在用其他智能体，装 LEV 技能。

### 方式一：LearnEV 应用（推荐）

从 [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest) 下载对应平台的发布包，支持 Linux、macOS 和 Windows 的 x64 与 arm64。发布包已经构建好，只需要 Node.js 24。

```sh
tar -xzf learnev-<版本>-linux-x64.tar.gz && cd learnev-<版本>-linux-x64   # Windows 解压 .zip
cp .env.example .env.local   # 填写 OPENAI_API_KEY
npm start
```

打开 [LearnEV](http://127.0.0.1:3000)。服务只绑定本机回环地址。两个预置智能体默认使用 `openai/gpt-5.4-mini`，也可以启动后在「设置 → 模型服务」里换成其他服务。

从源码运行时：

```sh
git clone https://github.com/VoidFunOfficial/LEV.git && cd LEV
nvm use              # Node.js 24
npm ci
cp .env.example .env.local
npm run dev          # 换端口：npm run dev -- --port 3100
```

在服务器上部署时，一键安装脚本会完成依赖、`.env.local` 和生产构建，并做一次自检。Linux 上安装系统库和字体需要 root 或免密码 sudo。

```sh
OPENAI_API_KEY=sk-... bash install.sh
npm start
```

#### Android 和 iOS

手机应用在设备上完整运行同一套 LearnEV 服务和界面，内置 Node.js，不需要电脑。对话、智能体和密钥都保存在应用的私有存储里。首次打开后，在「设置 → 模型服务」里添加模型服务即可。

- **Android：**从 [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest) 安装 `learnev-<版本>-android.apk`（Android 9 及以上，arm64 或 x86_64）。在配置发布密钥库之前，APK 使用临时密钥签名，安装新版本时可能需要先卸载旧版本，旧版本的数据会随之删除。
- **iOS：**`learnev-<版本>-ios-unsigned.ipa`（iOS 16 及以上）没有签名，需要先自行签名再安装，例如用 AltStore 或 Sideloadly。配置签名密钥后，发布中还会提供已签名的 `learnev-<版本>-ios.ipa`。

### 方式二：LEV 技能

LEV 是一个自包含的技能目录，带完整的 OpenUI 语言参考和检查脚本，不需要本仓库，也不需要运行 LearnEV。

- **让智能体自己装（推荐）：**对 Claude Code、Codex、Droid 等智能体说：“按 https://github.com/VoidFunOfficial/LEV/blob/main/plugins/lev/INSTALL.md 安装 LEV”。它会选好技能目录、下载、安装并验证。
- **手动安装：**从 [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest) 下载 `lev-skill.zip`，解压到智能体的技能目录，例如 `~/.claude/skills`、`~/.codex/skills` 或 `~/.factory/skills`。
- **DeepSeek Harness：**安装插件 `learnev-lev.tgz`，插件自带技能，还会把回复里的 `openui` 代码块直接显示成可以操作的界面。

装好后新开一个会话，输入 `/lev`，或者直接说“用 OpenUI 做一个勾股定理演示”。各智能体的目录和插件的安装细节见 [LEV 安装说明](plugins/lev/package/README.md)。

## 项目和历史记录

点击对话页右上角的项目名，创建或切换学习项目。侧栏的「搜索本项目」可按标题、问题、回答和已发送的文本附件查找记录，点击摘录即可跳到原对话。旧版记录在升级后归入「默认项目」。

智能体在同一对话中沿用该对话的 Pi 历史，跨对话回顾时按需调用只读工具。两种项目工具均绑定发起本次对话的项目，检索范围为已完成、未归档的问答。

| 工具 | 用法 |
| --- | --- |
| `search_project_context` | 按关键词查找片段，省略关键词时返回最近记录。结果含对话标题、轮次标识和片段位置 |
| `read_project_context` | 按轮次标识和可选位置分段阅读原文 |

## 配置 Agent

侧栏「设置」打开独立设置页。「智能体」中可以添加或编辑名称、系统提示词、服务、模型、推理强度、回答形式和工具。编辑时可以直接配置当前服务或添加新服务，保存服务后继续编辑智能体。保存后即可在输入框中选择它。每个智能体占用 `agent/` 下的一个子目录，目录名可以随名称生成，也可以自行填写。

「设置 → 模型服务」集中列出智能体使用的模型服务和 Pi 内置服务。点击已有服务可以编辑地址或更换凭据，密钥留空会沿用现有凭据。接入自定义端点时，点「添加模型服务」，填写唯一的服务标识、接口协议、Base URL、模型 ID 和 API Key。模型 ID 可以每行一个，无鉴权的本地服务可将密钥留空。服务使用 Pi 的 `models.json` 格式。设置中输入的密钥通过 Pi 写入私有的 `.learnev/provider-auth/<服务标识>.json`，项目模型清单只包含服务定义。已有 Pi 供应商继续沿用原有的登录凭据或环境变量。

也可以直接修改配置文件，在侧栏「智能体」里刷新。下一次发送会读取最新配置。

| 文件 | 用途 |
| --- | --- |
| `agent/<id>/agent.json` | 名称、供应商、模型、推理强度、工具、输出形式和开场建议 |
| `agent/<id>/system.md` | 该 Agent 的系统提示词 |
| `agent/models.json` | 可选的 Pi 自定义供应商与兼容模型 |

`output` 可选 `auto`、`openui` 或 `markdown`。`auto` 让模型按任务选择普通文字或交互界面。`tools` 接受上表中的工具名称，空数组表示关闭项目检索。所有智能体都自带 `end` 工具。预置的「学习搭子」和「学习导师」均可检索本项目历史，前者按任务选择回答形式，后者默认生成交互式学习内容。

如需接入自有的 OpenAI 兼容服务，可在 `agent/models.json` 中声明该服务。将示例地址和模型名换成实际值，在 `.env.local` 设置 `LOCAL_MODEL_KEY`，然后把目标 Agent 的 `provider` 和 `model` 改为对应名称。[Pi 模型配置](https://pi.dev/docs/latest/models-configuration)

```json
{
  "providers": {
    "local": {
      "baseUrl": "http://127.0.0.1:8000/v1",
      "api": "openai-completions",
      "apiKey": "$LOCAL_MODEL_KEY",
      "models": [{ "id": "my-model" }]
    }
  }
}
```

## 对话与数据

- 每次提问会并发请求同一个模型。开场请求关闭推理，用一句话或两三条要点点明主旨。主请求从一开始就使用输入框选定的推理强度，未指定时沿用智能体设置。界面先显示开场，再接上主请求的思考、工具和正文。用户选择关闭推理时，直接衔接正文或工具。停止生成会取消两路请求。
- 如果模型声明无法关闭推理，或开场请求失败或超时，界面直接显示主回答。主回答完成后单独调用 `end`。如果第 16 个主模型步骤仍未成功结束，会保留已生成内容并提示错误。
- 正文和交互组件随片段到达而显示。生成结束后可以展开各段「思考过程」回看。OpenAI 和 Anthropic 兼容接口使用 SSE 事件流。
- 回答中的 OpenUI 程序可以直接输出，也可以放在 ```` ```openui ```` 代码块中，代码块后的文字照常显示。模型在引号外写了中文键名、`.字段`、全角标点或弯引号时，界面会先修正再显示。交互视图有问题时，下方会列出问题，并提供「源码」「复制」和「请助手修复」。
- 用输入框的 Agent 菜单切换角色。切换后会沿用当前对话的 Pi 历史。按 Enter 发送，Shift+Enter 换行。
- 点输入框旁的闪电按钮，拖动滑块调整当前对话主回答的思考强度。可选档位取决于模型，发送时随对话保存。点复位按钮可恢复智能体的默认强度。
- `⌘/Ctrl + I` 新建对话，`⌘/Ctrl + K` 搜索对话，`⌘/Ctrl + \` 折叠侧栏。已归档对话可在设置中恢复。
- Pi 上下文和聊天记录保存在 `.learnev/workspace.sqlite`。交互组件的绑定值和外观设置保存在当前浏览器。文本附件每条最多 4 个，每个最多 64 KB。

## 开发

```sh
npm test
npm run typecheck
npm run build
npm start
```

集成测试使用本机临时模型端点，经过真实 Pi SDK 验证工具调用、流式输出、上下文恢复和取消。上游组件的来源、版本和许可证在 `src/openui/`。

手机应用在 `mobile/`。`mobile/prepare-runtime.mjs` 打包服务、构建好的界面和运行所需的 npm 包；`mobile/smoke.mjs` 用桌面 Node.js 启动这份打包结果，并对本机测试模型跑完整的一轮对话。

```sh
npm run android:apk    # 需要 JDK 21、Android SDK 和 NDK 28.2.13676358 → mobile/android/app/build/outputs/apk/release/
npm run ios:build      # 需要 macOS 和 Xcode → dist/release/learnev-<版本>-ios-unsigned.ipa
sh mobile/ios/build.sh simulator   # 先运行 npm run ios:prepare：为 iOS 模拟器构建
```

LEV 的源码在 `plugins/lev/`。`npm run pack:lev` 在 `dist/` 下生成解开的包目录、DeepSeek Harness 用的 `.tgz` 和技能 `.zip`；只要目录时运行 `npm run build:lev`。

## 持续集成和发布

- `.github/workflows/ci.yml`：推送到 `main` 和每个 Pull Request 时，在 Linux、macOS 和 Windows 上运行测试、类型检查、生产构建和 LEV 构建，并启动服务做冒烟测试。Linux 和 macOS 用 `install.sh` 安装。
- CI 每次还会在手机运行时冒烟测试之后构建 Android APK 和未签名的 iOS IPA，并保存为工作流产物。
- `.github/workflows/release.yml`：推送与 `package.json` 版本一致的标签（例如 `v0.1.5`）时，在 linux-x64、linux-arm64、macos-arm64、macos-x64、windows-x64、windows-arm64 上分别构建发布包，解压后启动验证，再连同 LEV 的 `.tgz`、技能 `.zip`、Android APK 和 iOS IPA 发布到 GitHub Release。手动运行时只生成构建产物，不发布。
- 签名是可选的。Android 需要设置仓库 Secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS` 和 `ANDROID_KEY_PASSWORD`。iOS 需要 `IOS_CERTIFICATE_P12_BASE64`、`IOS_CERTIFICATE_PASSWORD`、`IOS_PROVISIONING_PROFILE_BASE64` 和 `IOS_TEAM_ID`；描述文件需要时，再设置仓库变量 `IOS_BUNDLE_ID`（默认 `app.learnev.ios`）和 `IOS_EXPORT_METHOD`（默认 `release-testing`，即 Ad Hoc）。

```sh
npm version patch      # 更新 package.json 并打标签
git push --follow-tags
```
