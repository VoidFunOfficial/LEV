# LearnEV

English | [简体中文](README.zh-CN.md)

LearnEV is a learning assistant built on React and Pi that works in desktop and mobile browsers. Each learning project keeps its own chat history. Answers stream as text and as interactive cards, forms and charts. [Open Intelligent UI](https://github.com/thesysdev/open-intelligent-ui)

LearnEV's interactive views also work on their own: the LEV skill lets agents such as Claude Code, Codex and Droid write knowledge cards, formula demos, quizzes and study reports in the same OpenUI language.

## Install and use

There are two recommended ways: use the LearnEV app for the full learning assistant, or install the LEV skill in the agent you already use.

### Option 1: the LearnEV app (recommended)

Download the package for your platform from [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest). Packages are available for Linux, macOS and Windows on x64 and arm64. They are prebuilt and only need Node.js 24.

```sh
tar -xzf learnev-<version>-linux-x64.tar.gz && cd learnev-<version>-linux-x64   # on Windows, extract the .zip
cp .env.example .env.local   # set OPENAI_API_KEY
npm start
```

Open [LearnEV](http://127.0.0.1:3000). The server only listens on the loopback address. The two built-in agents use `openai/gpt-5.4-mini` by default; you can switch to another service under Settings → Model services.

To run from source:

```sh
git clone https://github.com/VoidFunOfficial/LEV.git && cd LEV
nvm use              # Node.js 24
npm ci
cp .env.example .env.local
npm run dev          # another port: npm run dev -- --port 3100
```

To deploy on a server, the setup script installs dependencies, creates `.env.local`, builds for production and runs a self-check. On Linux, installing system libraries and fonts needs root or passwordless sudo.

```sh
OPENAI_API_KEY=sk-... bash install.sh
npm start
```

#### On Android and iOS

The phone apps run the same LearnEV server and UI entirely on the device, with Node.js built in; no computer is needed. Chats, agents and keys stay in the app's private storage. Add a model service under Settings → Model services after the first launch.

- **Android:** install `learnev-<version>-android.apk` from [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest) (Android 9 or later, arm64 or x86_64). Until a release keystore is configured, the APK is signed with a temporary key, so a newer build may need uninstalling the old one first, which deletes its data.
- **iOS:** `learnev-<version>-ios-unsigned.ipa` (iOS 16 or later) is not signed. Sign it yourself before installing, for example with AltStore or Sideloadly. Once signing secrets are configured, releases also include a signed `learnev-<version>-ios.ipa`.

### Option 2: the LEV skill

LEV is a self-contained skill folder with the full OpenUI language reference and a checker script. It needs neither this repository nor a running LearnEV.

- **Let your agent install it (recommended):** tell Claude Code, Codex, Droid or a similar agent: "Install LEV by following https://github.com/VoidFunOfficial/LEV/blob/main/plugins/lev/INSTALL.md". It picks the skill folder, downloads, installs and verifies the skill.
- **Install it by hand:** download `lev-skill.zip` from [GitHub Releases](https://github.com/VoidFunOfficial/LEV/releases/latest) and unzip it into your agent's skill folder, for example `~/.claude/skills`, `~/.codex/skills` or `~/.factory/skills`.
- **DeepSeek Harness:** install the `learnev-lev.tgz` plugin. It includes the skill and shows `openui` code blocks in replies as live, interactive views.

After installing, start a new session and type `/lev`, or just ask "Make an interactive Pythagorean theorem demo with OpenUI". Folder locations for each agent and plugin details are in the [LEV install guide](plugins/lev/package/README.md) (Chinese).

## Projects and history

Click the project name at the top right of the chat to create or switch learning projects. "Search this project" in the sidebar finds records by title, question, answer and sent text attachments; click an excerpt to jump to the original chat. Records from older versions are placed in the "Default project" after upgrading.

Within a chat, the agent keeps that chat's Pi history. To look back across chats it calls read-only tools as needed. Both project tools are bound to the project the chat started in and search completed, unarchived answers.

| Tool | Use |
| --- | --- |
| `search_project_context` | Finds excerpts by keyword; without a keyword it returns the latest records. Results include the chat title, turn ID and excerpt position |
| `read_project_context` | Reads the original text in sections by turn ID and optional position |

## Configure agents

Settings in the sidebar opens a separate settings page. Under Agents you can add or edit an agent's name, system prompt, service, model, reasoning effort, answer format and tools. While editing you can configure the current service or add a new one, then keep editing the agent after saving the service. Saved agents appear in the composer's agent menu. Each agent lives in its own folder under `agent/`; the folder name can follow the agent name or be set by hand.

Settings → Model services lists the model services the agents use and Pi's built-in services. Click a service to edit its address or replace its credentials; leaving the key empty keeps the current one. To connect a custom endpoint, click "Add model service" and fill in a unique service ID, API protocol, Base URL, model IDs and API key. Model IDs can be one per line, and local services without authentication can leave the key empty. Services use Pi's `models.json` format. Keys entered in Settings are written by Pi to the private `.learnev/provider-auth/<service ID>.json`; the project's model list only contains service definitions. Existing Pi providers keep their login credentials or environment variables.

You can also edit the configuration files directly and refresh under Agents in the sidebar. The next message reads the latest configuration.

| File | Purpose |
| --- | --- |
| `agent/<id>/agent.json` | Name, provider, model, reasoning effort, tools, answer format and starter suggestions |
| `agent/<id>/system.md` | The agent's system prompt |
| `agent/models.json` | Optional custom Pi providers and compatible models |

`output` is `auto`, `openui` or `markdown`. `auto` lets the model choose plain text or an interactive view for each task. `tools` takes tool names from the table above; an empty array turns off project search. Every agent has the `end` tool. The two built-in agents, 学习搭子 (study buddy) and 学习导师 (tutor), can both search the project's history; the first picks the answer format per task, the second produces interactive learning content by default.

To use your own OpenAI-compatible service, declare it in `agent/models.json`. Replace the example address and model name with real values, set `LOCAL_MODEL_KEY` in `.env.local`, then change the agent's `provider` and `model` to match. [Pi model configuration](https://pi.dev/docs/latest/models-configuration)

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

## Chats and data

- Each question sends two concurrent requests to the same model. The opening request has reasoning turned off and states the main idea in a sentence or two or three bullet points. The main request uses the reasoning effort chosen in the composer from the start, or the agent's setting when none is chosen. The view shows the opening first, then continues with the main request's reasoning, tools and text. When the user turns reasoning off, it goes straight to the text or tools. Stopping cancels both requests.
- If the model cannot turn reasoning off, or the opening request fails or times out, the view shows the main answer directly. After the main answer the model calls `end` on its own. If the 16th main model step still has not ended successfully, the content so far is kept and an error is shown.
- Text and interactive components appear as chunks arrive. After generation you can expand each "Thinking" section to review it. OpenAI- and Anthropic-compatible APIs use SSE streams.
- An OpenUI program in an answer can be output directly or inside an ```` ```openui ```` block; text after the block displays as usual. When the model writes Chinese keys, `.fields`, full-width punctuation or curly quotes outside string quotes, the view repairs them before displaying. When an interactive view has problems, they are listed below it with Source, Copy and Ask the assistant to fix.
- Switch roles with the agent menu in the composer; the chat's Pi history carries over. Enter sends, Shift+Enter adds a new line.
- Click the lightning button next to the composer and drag the slider to set the reasoning effort for this chat's main answer. The available levels depend on the model and are saved with the chat. The reset button restores the agent's default.
- `⌘/Ctrl + I` starts a new chat, `⌘/Ctrl + K` searches chats, `⌘/Ctrl + \` collapses the sidebar. Archived chats can be restored in Settings.
- Pi context and chat history are stored in `.learnev/workspace.sqlite`. Bound values of interactive components and appearance settings are stored in the current browser. Each message can have up to 4 text attachments of up to 64 KB each.

## Development

```sh
npm test
npm run typecheck
npm run build
npm start
```

The integration tests use a temporary local model endpoint and go through the real Pi SDK to check tool calls, streaming, context restore and cancellation. Sources, versions and licenses of upstream components are in `src/openui/`.

The phone apps are in `mobile/`. `mobile/prepare-runtime.mjs` packs the server, the built UI and the runtime npm packages; `mobile/smoke.mjs` starts that package with desktop Node.js and runs a full chat turn against a local fixture model.

```sh
npm run android:apk    # JDK 21, Android SDK and NDK 28.2.13676358 → mobile/android/app/build/outputs/apk/release/
npm run ios:build      # macOS with Xcode → dist/release/learnev-<version>-ios-unsigned.ipa
sh mobile/ios/build.sh simulator   # after npm run ios:prepare: a build for the iOS Simulator
```

LEV's source is in `plugins/lev/`. `npm run pack:lev` writes the unpacked package, the DeepSeek Harness `.tgz` and the skill `.zip` to `dist/`; `npm run build:lev` writes only the folder.

## CI and releases

- `.github/workflows/ci.yml`: on pushes to `main` and every pull request, runs the tests, type check, production build and LEV build on Linux, macOS and Windows, then starts the server for a smoke test. Linux and macOS install with `install.sh`.
- CI also builds the Android APK and the unsigned iOS IPA on every run, after the mobile runtime smoke test, and keeps them as workflow artifacts.
- `.github/workflows/release.yml`: when a tag matching the `package.json` version is pushed (for example `v0.1.5`), builds a package on each of linux-x64, linux-arm64, macos-arm64, macos-x64, windows-x64 and windows-arm64, extracts and starts it to verify, and publishes it with LEV's `.tgz`, the skill `.zip`, the Android APK and the iOS IPA to a GitHub Release. Running it by hand only produces build artifacts without publishing.
- Signing is optional. For Android, set the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. For iOS, set `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64` and `IOS_TEAM_ID`, plus the repository variables `IOS_BUNDLE_ID` (default `app.learnev.ios`) and `IOS_EXPORT_METHOD` (default `release-testing`, which is ad hoc) when the profile needs them.

```sh
npm version patch      # bump package.json and tag
git push --follow-tags
```
