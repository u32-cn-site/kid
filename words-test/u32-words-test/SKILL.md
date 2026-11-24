---
name: u32-words-test
description: >-
  Use when 用户想测试 / 听写 / 考察英语单词拼写掌握度（含新概念英语 1-4、KET、牛津自然拼读等教材）。
  AI 按需求生成单词测试链接（教材取词优先，AI 造词兜底），输出一个 URL 让用户在
  https://kid.u32.cn/words-test 打开即测：从词库随机抽样、逐个拼写、每词一次、即时判分、
  给出正确率。本技能以公网页式部署，读取本文件即可使用。
---

# u32-words-test

辅导用户测试英语单词的技能。核心产出是**一个测试链接**：把单词通过 URL 参数注入到「英语单词测试」PWA，用户打开即测——从选定单词中随机抽取 N 个（默认 16），逐个拼写作答，每词只测一次，结束给出正确率。

> 本技能以纯文本公网部署。AI 读取本 `SKILL.md` 即可获得全部指令；如需自动化可下载 `scripts/` 下脚本运行。

- 应用入口：<https://kid.u32.cn/words-test/index.html>
- 技能根目录：<https://kid.u32.cn/words-test/u32-words-test/>

---

## 何时使用

当用户表达类似下面的意图时触发：

- 「测测我的单词」「我要听写单词」「考察一下我的拼写」
- 「测新概念第 X 册第 Y 课」「考 KET 单词」「牛津自然拼读」
- 「我要自测考研高频词 / 四六级 / 旅游英语 / 雅思核心词」
- 给出一组单词、一篇课文、一张词表，要求测试 / 听写 / 考察

**产出契约**：最终交给用户的是一个可点击的 URL（单词已预填），并附一句说明（如「打开链接点开始测试即可，会随机抽 16 个词」）。AI 不直接操作浏览器。

> 若用户想要的是「背单词 / 练习 / 间隔复习」而非一次性评估，请改用 `u32-words-learn-by-doing` 技能（<https://kid.u32.cn/words-learn-by-doing/>）。

---

## 核心机制：URL 启动

应用读取两个查询参数（均可选，均须 percent-encode）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `title` | 测试标题 | `新概念1 L1` |
| `words` | 换行分隔的单词文本 | `excuse\|v. 原谅\nhandbag\|n. 手提包` |

打开后：单词自动填入输入框、标题填入标题栏；用户设置「测试数量」（默认 16）并点「开始测试」，在确认弹窗里勾选参与抽样的单词（默认全选），确认后随机抽取指定数量进入测试。

**纯代码构造 URL（无需下载脚本）**：

```js
const BASE = 'https://kid.u32.cn/words-test/index.html'
const title = '新概念1 L1'
const words = 'excuse|v. 原谅\nhandbag|n. 手提包\npardon|int. 原谅'
const url = `${BASE}?title=${encodeURIComponent(title)}&words=${encodeURIComponent(words)}`
```

> 关键：`encodeURIComponent` 会把 `|` 编为 `%7C`、换行编为 `%0A`、空格编为 `%20`，浏览器 `URLSearchParams` 解析时自动还原。切勿只编一部分。

---

## 单词文本格式

每行一个单词，竖线 `|` 分隔字段，字段数 2 或 3：

```
单词|释义
单词|释义|例句
```

- **释义**必填；**例句**可选（测试时作为提示展示）
- 释义可含词性前缀：`excuse|v. 原谅`、`handbag|n. （女用）手提包`
- 空行静默跳过；缺单词或释义的行记为问题行，不影响其他行
- 单词与释义两侧空格会被自动 trim

**正确**：

```
excuse|v. 原谅
handbag|n. （女用）手提包|Is this your handbag?
thank you|感谢你
```

**错误**（缺释义，该行会被忽略）：

```
excuse
```

---

## 工作流

### A. 教材取词（优先）

当用户要测的词属于已收录教材（新概念 1-4 / KET / 牛津自然拼读 1-5），从数据源拉取现成单词，再构造链接。

```bash
# 方式一：下载脚本后运行（node ≥ 18）
node fetch-words.mjs --book nce1 --lessons 1,3 | node build-url.mjs --title "新概念1 L1-L3"

# 方式二：不下载脚本，AI 直接 fetch（见下文「内联代码片段」）
```

教材代号见下表（`--book` 参数用 `dir` 列）：

| 书名 | dir |
|------|-----|
| 新概念英语第一册 | `nce1` |
| 新概念英语第二册 | `nce2` |
| 新概念英语第三册 | `nce3` |
| 新概念英语第四册 | `nce4` |
| KET | `ket` |
| 牛津自然拼读第一册 | `phonics/book1` |
| 牛津自然拼读第二册 | `phonics/book2` |
| 牛津自然拼读第三册 | `phonics/book3` |
| 牛津自然拼读第四册 | `phonics/book4` |
| 牛津自然拼读第五册 | `phonics/book5` |

### B. AI 造词（兜底）

当用户要的词不在教材（如考研高频、旅游英语、用户自定义词表），由 AI 组织成 `单词|释义|例句` 文本，再构造链接。释义尽量带词性，有例句更佳。

```bash
node build-url.mjs --title "旅游英语" --words-file words.txt
```

或纯代码（见上文「核心机制」）。

> 测试会从给定单词中随机抽样（默认 16 个），所以提供的词表宜明显多于测试数量（建议 20 个以上），抽样才有意义；若只想全量逐个测，把测试数量设为词数即可。

---

## 教材数据源 API

无鉴权，公网可 fetch。基址：`https://kid.u32.cn/english/nce/data`

| 资源 | URL | 结构 |
|------|-----|------|
| 全部书目 | `/index.json` | `{ books: [{ name, dir }] }` |
| 某书课次 | `/{dir}/index.json` | `{ lessons: [{ lesson, title:[en, zh] }] }` |
| 某课单词 | `/{dir}/lesson_{n}.json` | `{ lesson, title, words: [[word, 词性, 中文], ...] }` |

例：`https://kid.u32.cn/english/nce/data/nce1/lesson_1.json` 的 `words` 字段：

```json
[ ["excuse", "v.", "原谅"], ["handbag", "n.", "（女用）手提包"], ["pardon", "int.", "原谅，请再说一遍"] ]
```

**单词三元组 → 文本规则**（与应用一致）：`[word, type, meaning]` → 有词性时 `word|type meaning`，无词性时 `word|meaning`。

---

## 自动化脚本

`scripts/` 下两个零依赖 Node.js 脚本（node ≥ 18）。可从公网下载：

```bash
BASE=https://kid.u32.cn/words-test/u32-words-test/scripts
curl -O $BASE/fetch-words.mjs
curl -O $BASE/build-url.mjs
```

### fetch-words.mjs — 拉教材单词

```bash
# 列出所有书
node fetch-words.mjs --list-books

# 列出某书课次
node fetch-words.mjs --book nce1 --list

# 拉指定课单词（输出 word|词性释义 纯文本，可管道串接 build-url）
node fetch-words.mjs --book nce1 --lessons 1,3,5-7

# 结构化输出
node fetch-words.mjs --book nce1 --lessons 1 --json
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `--list-books` | 否 | 列出全部书目（JSON） |
| `--book <dir>` | 视场景 | 教材代号，如 `nce1`、`phonics/book1` |
| `--list` | 否 | 配合 `--book` 列出课次（JSON） |
| `--lessons <spec>` | 否 | 课次规格，逗号分隔，支持范围：`1,3,5-7` |
| `--json` | 否 | 输出结构化 JSON（默认纯文本） |

### build-url.mjs — 造测试链接

```bash
# 从 stdin 读单词（支持管道）
node fetch-words.mjs --book nce1 --lessons 1 | node build-url.mjs --title "新概念1 L1"

# 从文件读
node build-url.mjs --title "旅游英语" --words-file words.txt

# 内联（多行用实际换行）
node build-url.mjs --title "test" --words "hotel|n. 酒店
taxi|n. 出租车"
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `--title <str>` | 否 | 测试标题 |
| `--words <str>` | 三选一 | 内联单词文本 |
| `--words-file <path>` | 三选一 | 从文件读单词文本 |
| `--base <url>` | 否 | 自定义应用入口（默认公网地址，本地预览可改） |

单词文本来源优先级：`--words` > `--words-file` > stdin（管道）。

**build-url 输出**（stdout，JSON）：

```json
{ "ok": true, "url": "https://kid.u32.cn/words-test/index.html?title=...&words=...",
  "title": "新概念1 L1", "wordCount": 11, "preview": "excuse|v. 原谅\nhandbag|n. 手提包\n..." }
```

失败时 `{ "ok": false, "error": "..." }`，退出码 `1`。

---

## 内联代码片段（不下载脚本）

### 构造测试 URL

```js
const BASE = 'https://kid.u32.cn/words-test/index.html'
function buildUrl(title, wordsText) {
  const u = new URL(BASE)
  if (title) u.searchParams.set('title', title)
  u.searchParams.set('words', wordsText)
  return u.toString()
}
// URLSearchParams 会自动正确编码换行与特殊字符
```

### 拉教材单词（Node ≥ 18 原生 fetch）

```js
const API = 'https://kid.u32.cn/english/nce/data'
async function fetchLessonWords(dir, lessons) {
  const all = []
  await Promise.all(lessons.map(async n => {
    const res = await fetch(`${API}/${dir}/lesson_${n}.json`)
    const data = await res.json()
    for (const [w, t, m] of data.words) all.push(t ? `${w}|${t} ${m}` : `${w}|${m}`)
  }))
  return all.join('\n')
}
const words = await fetchLessonWords('nce1', [1, 3])
```

---

## 测试与计分规则（参考）

AI 一般无需关心，仅供解释给用户时参考。

- 抽样：从用户勾选的单词中用 Fisher–Yates 洗牌随机抽取 N 个（默认 16，实际抽取数 = `min(N, 选中词数)`），每个词浅拷贝重置为未测状态
- 作答：逐字符拼写，界面给逐字符镜像反馈（不染色，统一色显示已输入 + 未输入下划线 + 空格位␣）
- 每词只测一次：按未测顺序推进，全部测完即结束，无间隔复习、无重复出现
- 判分：答对 / 答错即时判定，严格大小写；空答案被 UI 层拦截，不允许空提交
- 朗读：作答时不朗读（防剧透），揭示答案后可点喇叭朗读正确单词；切换单词时取消正在进行的朗读
- 结果：结束后展示正确率、正确数 / 错误数 / 测试数、每个单词的对错及错误答案，写入历史
- 重测：历史记录支持「全部重测 / 错题重测」，重测时清空结果回到输入页
- 数据存浏览器 OPFS（命名空间 `/u32-words-test/`），刷新自动恢复进行中的会话（含当前单词耗时续算）

> 与「以练代学」的核心区别：本应用是**一次性评估**（随机抽样、每词一次、不计掌握度、不安排复习）；练习应用是**间隔复习**（按掌握度安排重练）。

---

## 正反示例

**对**：用户「测新概念 1 第 1 课」→ 拉教材 → 造链接 → 回复「这是你的测试链接：<URL>，打开点开始测试即可，会随机抽 16 个词」。

**对**：用户「我要听写这些词：apple, book, cat」→ AI 补释义 → `apple|n. 苹果\nbook|n. 书\ncat|n. 猫` → 造链接。

**错**：用户「测新概念 1 第 1 课」→ AI 凭记忆默写单词（可能漏词、错释义）。应从数据源拉取权威数据。

**错**：构造 URL 时手动拼 `words=excuse|v. 原谅`（未编码 `|` 和中文），链接会失效。必须 `encodeURIComponent` 或用 `URLSearchParams`。

---

## 注意事项

1. `words` 参数有长度上限（浏览器 URL 约 8000 字符安全），词数过多（一般 >60）应分批生成多个链接。
2. 教材数据源的课次编号不一定连续（如 NCE1 只有奇数课），用 `--list` 先核对。
3. 释义段避免再含 `|`（会被误认为字段分隔）；若释义本身含 `|`，可用全角 `｜` 替代。
4. 本技能文件以公网静态部署，更新随应用发版；脚本无 npm 依赖，下载即用。
