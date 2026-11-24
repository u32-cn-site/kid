---
name: u32-words-learn-by-doing
description: >-
  Use when 用户想背单词 / 练习英语拼写 / 学习英语词汇（含新概念英语 1-4、KET、牛津自然拼读等教材）。
  AI 按需求生成单词练习链接（教材取词优先，AI 造词兜底），输出一个 URL 让用户在
  https://kid.u32.cn/words-learn-by-doing 打开即练。本技能以公网页式部署，读取本文件即可使用。
---

# u32-words-learn-by-doing

辅导用户背英语单词的技能。核心产出是**一个练习链接**：把单词通过 URL 参数注入到「英语单词以练代学」PWA，用户打开即练，系统按间隔复习算法自动安排复习时机。

> 本技能以纯文本公网部署。AI 读取本 `SKILL.md` 即可获得全部指令；如需自动化可下载 `scripts/` 下脚本运行。

- 应用入口：<https://kid.u32.cn/words-learn-by-doing/index.html>
- 技能根目录：<https://kid.u32.cn/words-learn-by-doing/u32-words-learn-by-doing/>

---

## 何时使用

当用户表达类似下面的意图时触发：

- 「帮我背单词」「我想练英语拼写」「测测我的词汇」
- 「学新概念第 X 册第 Y 课」「练 KET 单词」「牛津自然拼读」
- 「我要背考研高频词 / 四六级 / 旅游英语 / 雅思核心词」
- 给出一组单词、一篇课文、一张词表，要求练习

**产出契约**：最终交给用户的是一个可点击的 URL（单词已预填），并附一句说明（如「打开链接点开始练习即可」）。AI 不直接操作浏览器。

---

## 核心机制：URL 启动

应用读取两个查询参数（均可选，均须 percent-encode）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `title` | 练习标题 | `新概念1 L1` |
| `words` | 换行分隔的单词文本 | `excuse\|v. 原谅\nhandbag\|n. 手提包` |

打开后：单词自动填入输入框、标题填入标题栏，用户点「开始练习」即进入会话。

**纯代码构造 URL（无需下载脚本）**：

```js
const BASE = 'https://kid.u32.cn/words-learn-by-doing/index.html'
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

- **释义**必填；**例句**可选（答题时作为提示展示）
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

当用户要练的词属于已收录教材（新概念 1-4 / KET / 牛津自然拼读 1-5），从数据源拉取现成单词，再构造链接。

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

> 一次练习建议 8～30 个词，太少缺乏复习循环、太多负担重。可分批生成多个链接。

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
BASE=https://kid.u32.cn/words-learn-by-doing/u32-words-learn-by-doing/scripts
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

### build-url.mjs — 造练习链接

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
| `--title <str>` | 否 | 练习标题 |
| `--words <str>` | 三选一 | 内联单词文本 |
| `--words-file <path>` | 三选一 | 从文件读单词文本 |
| `--base <url>` | 否 | 自定义应用入口（默认公网地址，本地预览可改） |

单词文本来源优先级：`--words` > `--words-file` > stdin（管道）。

**build-url 输出**（stdout，JSON）：

```json
{ "ok": true, "url": "https://kid.u32.cn/words-learn-by-doing/index.html?title=...&words=...",
  "title": "新概念1 L1", "wordCount": 11, "preview": "excuse|v. 原谅\nhandbag|n. 手提包\n..." }
```

失败时 `{ "ok": false, "error": "..." }`，退出码 `1`。

---

## 内联代码片段（不下载脚本）

### 构造练习 URL

```js
const BASE = 'https://kid.u32.cn/words-learn-by-doing/index.html'
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

## 练习与掌握度算法（参考）

AI 一般无需关心，仅供解释给用户时参考。

- 作答：逐字符拼写，界面给镜像染色反馈
- 计分：答对基础 `+30`，速度快额外加分（最高 `+60`），`mastered` 封顶 `120`；答错 `mastered -20`（下限 `0`）
- 空答案：不改 `mastered`，仍记一次尝试
- 间隔复习（按轮次序号安排下次出现）：`<30` 立即 / `<60` +2 / `<90` +4 / `<120` +8 / `≥120` 不再安排（视为已掌握）
- 全部掌握后会话自动结束，写入历史；可从历史「重练全部 / 错题 / 不熟」
- 数据存浏览器 OPFS，刷新自动恢复进行中的会话（含当前单词耗时续算）

---

## 正反示例

**对**：用户「练新概念 1 第 1 课」→ 拉教材 → 造链接 → 回复「这是你的练习链接：<URL>，打开点开始练习即可」。

**对**：用户「我要背这些词：apple, book, cat」→ AI 补释义 → `apple|n. 苹果\nbook|n. 书\ncat|n. 猫` → 造链接。

**错**：用户「练新概念 1 第 1 课」→ AI 凭记忆默写单词（可能漏词、错释义）。应从数据源拉取权威数据。

**错**：构造 URL 时手动拼 `words=excuse|v. 原谅`（未编码 `|` 和中文），链接会失效。必须 `encodeURIComponent` 或用 `URLSearchParams`。

---

## 注意事项

1. `words` 参数有长度上限（浏览器 URL 约 8000 字符安全），词数过多（一般 >60）应分批生成多个链接。
2. 教材数据源的课次编号不一定连续（如 NCE1 只有奇数课），用 `--list` 先核对。
3. 释义段避免再含 `|`（会被误认为字段分隔）；若释义本身含 `|`，可用全角 `｜` 替代。
4. 本技能文件以公网静态部署，更新随应用发版；脚本无 npm 依赖，下载即用。
