---
name: lev
description: 用 LearnEV（LearnEverything）的 OpenUI 语言做可以操作的界面：知识卡片、可拖动的公式演示、闪卡练习、小测验、计算器、图表、示意图、学习报告和各种小工具。用户想要“做一个界面、卡片、图表、练习、演示、小工具”，或者提到 LEV、OpenUI、LearnEV、LearnEverything 时使用。程序先检查，再写进回复里的 ```openui 代码块交付；装了 LEV 插件的 DeepSeek Harness 会在对话里把它实时显示成界面。
---

# LEV

OpenUI 是 LearnEV 描述界面的语言：一段程序写出界面上的组件、状态和交互。程序放在回复里的 `` ```openui `` 代码块中交付。

## 在哪里显示

| 环境 | 用户看到什么 | 怎么检查 |
| --- | --- | --- |
| 装了 LEV 插件的 DeepSeek Harness（有 `openui_check` 工具） | 回复里的代码块直接显示成实时界面：可以点按钮、拖滑块、翻闪卡、勾选、填表单，数字和图形随状态变化 | 调用 `openui_check` |
| 其他环境（Claude Code、Codex、Droid 等） | 代码块显示成普通代码。要看到界面，在装了插件的 DeepSeek Harness 里让智能体显示这段程序 | 运行 `scripts/check.mjs` |

能用 `openui_check` 工具，就说明你在装了插件的 DeepSeek Harness 里。界面一定要放在回复里：DSH 在一轮回答结束后会把工具调用折叠起来，回复始终可见。

**只用 `` ```openui `` 代码块交付界面。** 不要把程序写进文件让用户自己打开。

## 流程

1. 读 `references/openui-language.md`，它是 OpenUI 语言的完整参考：语法、每个组件的参数顺序、全部 `@` 函数和示例。只能用其中列出的组件和函数。它开头要求“整个回复都是 openui-lang”，这一条在这里不适用：回复用普通文字，程序只放在代码块里。讲解、练习这类教学内容还要读 `references/teaching-guide.md`。路径都相对于本技能所在的目录。
2. 想清楚这个界面讲什么、给谁看、用户能在里面做什么。一个界面只做一件事，内容多就拆成几个界面。
3. 检查程序：
   - 有 `openui_check` 工具时调用它。`code` 是完整的程序，第一行 `root = Col([...])`，不要 Markdown 代码围栏；`title` 可选，几个字的标题。
   - 没有这个工具时运行检查脚本，需要 Node.js 18 或更新版本。把程序从标准输入传进去（也可以传文件路径，文件里可以是单独的程序，也可以是带代码块的整段回复）：

     ```sh
     node <本技能目录>/scripts/check.mjs - <<'OUI'
     root = Col([...])
     OUI
     ```

     退出码 0 表示没有问题；2 表示有问题，逐条列在输出里；1 表示读不到输入。加 `--json` 输出 JSON。
   - 有问题就逐条改好，用完整的程序再检查一次，直到没有问题。
4. 回复：先用一两句话告诉用户界面里有什么、可以怎么操作，然后把检查过的程序原样放进 `` ```openui `` 代码块。语言名后面可以写一个短标题，显示在界面上方：`` ```openui 勾股定理 ``。
   - 代码块里只放程序。一个代码块是一个界面，需要几个界面就写几个代码块。
   - 同一个程序不要再用别的代码块贴一遍。
   - 以后修改界面时，在新的回复里写一个完整的新代码块，不要只写改动的部分。
   - 不在 DeepSeek Harness 里时，最后补一句：这里只能显示源码，在装了 LEV 插件的 DeepSeek Harness 里让智能体显示这段程序，就能看到可以操作的界面。

检查只覆盖解析阶段的问题。参数类型不对导致的渲染错误只在界面里显示：界面下方列出问题，并有“请助手修复”按钮；用户点了它，你会收到问题列表，按它修改后重新检查、重新回复。
## 语法要点

- 第一行是 `root = Col([...])`。每行一条 `名字 = 表达式`。
- 参数按位置传，不支持 `name: value`。末尾的参数可以省略；要跳过中间的参数，写 `null`。
- 名字、`$` 状态、`@` 函数和 `.字段` 只能用 ASCII。中文只能出现在双引号字符串里。引号外的括号、逗号、冒号和引号都必须是半角。
- 对象的键需要显示出来时（例如图表的系列名），写成带引号的中文键：`{"日期": "周一", "分钟": 45}`。其他键用 ASCII：`{label: "总时长"}`。
- 每个定义的名字都要能从 root 到达，每个引用的名字都要有定义。
- `@Each(list, "x", 模板)` 的模板必须写在调用里面，不能拆成单独的语句。
- `$` 变量的默认值只能是字面量。没有 `@If`，用 `条件 ? a : b` 在两个值或两个组件之间选。
- 能算出来的数字用表达式算（`@Sum`、`@Round`、`@Format` 等），不要手算后写死。

## 交互

下面的交互在实时界面里生效（装了插件的 DeepSeek Harness，以及 LearnEV 自己的聊天）。

- 让界面自己工作：输入和列表放在 `$` 变量里，显示的内容都从它们算出来，用 `@Set`、`@Reset` 改变它们。滑块、分段选择、复选框、`Flashcard`、`Carousel`、`Popover`、`Timer`、`Celebration` 都能直接用。
- `@ToAssistant("消息")` 和 `Form` 里的提交按钮会把消息作为用户的新消息发进这个对话，界面当前的状态和表单的值以 `交互状态.json: {...}` 的形式附在后面。只用在界面自己算不了、需要你来回答的地方，例如“再出几道题”“按我的选择定计划”。消息写成用户口吻的短句。
- `@OpenUrl` 打开链接，`@CopyToClipboard` 复制文字。
- 界面状态保存在浏览器本地，刷新或重新打开会话后还在。

## 版式

- 对话列宽约 600 到 760 px。`Grid` 用 2 到 3 列，minChildWidth 约 150；`Table` 不超过 5 列；`Chart` 高度 200 到 260；`Svg` 的 viewBox 收紧到图形周围。
- 从上到下：`Title`，一两句要点，主体（交互区、图、表或公式），最后用 `Quote` 或 `Card(..., "soft")` 做小结或下一步。
- 颜色用主题色名：`ink`、`muted`、`faint`、`surface`、`success`、`warning`、`danger`、`purple`、`pink`、`chart1` 到 `chart6`。`info` 是中性灰，要蓝色用 `chart1`。主题色会跟着深色主题换色，写死的十六进制颜色不会。
- `SearchImage`（维基百科图片，查询词用英文、写具体事物）和 `Map`（OpenFreeMap 地图）需要访问外网，离线时显示为占位块。

## 示例

一次完整的回复，界面是可以拖动的勾股定理（程序已检查，没有问题）：

````markdown
拖动两个滑块，看斜边怎么跟着变；下面的闪卡点一下就能看到答案。

```openui 勾股定理
root = Col([head, controls, figure, result, cards, more])
$a = 3
$b = 4
head = Col([Title("勾股定理", "2xl"), Text("拖动滑块改变两条直角边，斜边跟着变。", "md", "muted")], 2)
controls = Grid([Slider($a, 1, 8, 1, "直角边 a"), Slider($b, 1, 8, 1, "直角边 b")], 2, 150)
c = @Round(@Sqrt($a * $a + $b * $b), 2)
tri = "60,170 " + (60 + $b * 18) + ",170 60," + (170 - $a * 12)
figure = Svg([Polygon(tri, "chart1", null, null, 0.15), Polygon(tri, "none", "ink", 2), SvgText("a = " + $a, 52, 174 - $a * 6, 14, "ink", "end"), SvgText("b = " + $b, 60 + $b * 9, 192, 14, "ink", "middle"), SvgText("c = " + c, 68 + $b * 9, 164 - $a * 6, 14, "danger", "start", "semibold")], "0 64 320 136")
result = Card([Math("a^2 + b^2 = c^2"), Text($a + "² + " + $b + "² = " + ($a * $a + $b * $b) + "，所以 c = " + c, "md", null, "semibold")], "soft")
cards = Grid([Flashcard("3、4、?", "5", "点一下看答案"), Flashcard("5、12、?", "13", "点一下看答案"), Flashcard("8、15、?", "17", "点一下看答案")], 3, 150)
more = Button("再出几道练习题", @ToAssistant("再出几道勾股定理的练习题"), "outline", null, "sm", "sparkles")
```
````

## 问题列表

| 问题 | 原因和改法 |
| --- | --- |
| `No OpenUI program found` | 没有以 `root =` 开头的行 |
| `Unknown component "X"` | 组件名写错或不存在。只能用参考中列出的组件 |
| `Referenced but never defined` | 引用了没有定义的名字。补上定义，或改正拼写 |
| `Defined but not reachable from root` | 定义了，但没有放进 root 的子树，不会显示 |
| `Skipped by the parser because they are outside quotes` | 引号外出现了中文或全角符号 |
| `The program is truncated` | 括号或引号没有闭合 |
| `<语句名>: …` | 这条语句的参数有错，按提示修改 |
