# 出题规范

## TypeScript 类型定义

以下是 JSON 数据的结构定义，**出题时只需要包含这些字段**：

```typescript
// 题目类型：单选、多选、填空
type QuestionType = 'single' | 'multiple' | 'fill'

// 富文本内容：可以是纯字符串，或者 HTML 对象
type HtmlContent = { type: 'html'; innerHTML: string }
type RichContent = string | HtmlContent

// 基础题目字段
type BaseQuestion = {
  type: QuestionType           // 题型
  content: RichContent         // 题目内容（必填）
  hint?: RichContent           // 提示（可选）
  explanation?: RichContent    // 解析（可选）
}

// 单选题
type SingleChoiceQuestion = BaseQuestion & {
  type: 'single'
  options: RichContent[]       // 选项数组
  answer: number               // 正确答案的索引（从0开始）
}

// 多选题
type MultipleChoiceQuestion = BaseQuestion & {
  type: 'multiple'
  options: RichContent[]       // 选项数组
  answer: number[]             // 正确答案的索引数组（从0开始）
}

// 填空题
type FillBlankQuestion = BaseQuestion & {
  type: 'fill'
  answer: string[]             // 所有正确答案（字符串数组）
}

type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | FillBlankQuestion

// 题集（最终输出格式）
type QuestionSet = {
  title: string                // 题集标题
  description?: string         // 题集描述（可选）
  questions: Question[]        // 题目数组
}
```

## 三种题型示例

### 1. 单选题 (single)

只有一个正确答案，`answer` 是索引数字（从 0 开始）。

```json
{
  "type": "single",
  "content": "3 + 4 = ?",
  "options": ["5", "6", "7", "8"],
  "answer": 2,
  "explanation": "3 + 4 = 7"
}
```

使用 HTML 的示例：

```json
{
  "type": "single",
  "content": {
    "type": "html",
    "innerHTML": "<p>下面哪个图形是<span style='color:red'>三角形</span>？</p>"
  },
  "hint": "三角形有三条边",
  "options": ["○", "△", "□", "☆"],
  "answer": 1,
  "explanation": "三角形（△）由三条边组成"
}
```

### 2. 多选题 (multiple)

有多个正确答案，`answer` 是索引数组。

```json
{
  "type": "multiple",
  "content": "下面哪些数是偶数？",
  "options": ["1", "2", "3", "4"],
  "answer": [1, 3],
  "explanation": "偶数是能被2整除的整数"
}
```

### 3. 填空题 (fill)

`answer` 是字符串数组，包含所有可接受的答案（同义词、不同写法等）。

```json
{
  "type": "fill",
  "content": "一年有___个月",
  "hint": "想想日历",
  "answer": ["12", "十二"],
  "explanation": "一年有12个月"
}
```

使用 HTML 的示例：

```json
{
  "type": "fill",
  "content": {
    "type": "html",
    "innerHTML": "<p><sup>1</sup>/<sub>2</sub> + <sup>1</sup>/<sub>2</sub> = ___</p>"
  },
  "answer": ["1", "1/1"],
  "explanation": "同分母分数相加，分母不变，分子相加"
}
```

## 完整示例（混合题型）

```json
{
  "title": "小学数学综合练习",
  "description": "包含单选、多选和填空题",
  "questions": [
    {
      "type": "single",
      "content": "12 × 3 = ?",
      "options": ["24", "36", "48", "15"],
      "answer": 1,
      "explanation": "12 × 3 就是3个12相加：12 + 12 + 12 = 36"
    },
    {
      "type": "multiple",
      "content": "下面哪些数是偶数？",
      "options": ["1", "2", "3", "4"],
      "answer": [1, 3],
      "explanation": "偶数是能被2整除的整数"
    },
    {
      "type": "fill",
      "content": "1米 = ___ 厘米",
      "answer": ["100"],
      "explanation": "1米 = 100厘米"
    }
  ]
}
```

## 重要提示

1. **富文本格式**：`content`、`hint`、`explanation`、`options` 都可以是纯字符串或 HTML 对象
2. **索引从 0 开始**：单选题的 `answer` 是数字，多选题的 `answer` 是数字数组，索引从 0 开始
3. **填空题多答案**：`answer` 数组包含所有可接受的答案（如 "12" 和 "十二"）
4. **不要包含 `record` 字段**：这是应用运行时生成的，出题时不需要
5. **`explanation` 字段建议填写**：帮助学生理解错误原因
