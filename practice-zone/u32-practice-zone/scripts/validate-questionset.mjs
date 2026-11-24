#!/usr/bin/env node
// 校验题集 JSON 是否符合 u32-practice-zone v2 schema（Section 树）。
// 与 src/core/Engine.ts 的 parseQuestionSet 校验逻辑保持一致。
// 用法：
//   node validate-questionset.mjs <file.json>
//   cat file.json | node validate-questionset.mjs
// 输出 JSON：{ ok:true, title, questionCount, maxScore } 或 { ok:false, errors:[...] }
import { readFileSync } from 'node:fs'
import { argv, stdin, exit } from 'node:process'

const VALID_TYPES = [
    'single-choice',
    'multiple-select',
    'fill-in-the-blank',
    'matching',
    'ordering',
    'free-response',
]

function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asStringArray(v, prefix, field, errors) {
    if (!Array.isArray(v) || v.length === 0) {
        errors.push(`${prefix}：${field} 应为非空数组`)
        return null
    }
    const arr = []
    let bad = false
    v.forEach((x, i) => {
        if (typeof x === 'string') arr.push(x)
        else { errors.push(`${prefix}：${field} 第 ${i + 1} 项应为字符串`); bad = true }
    })
    return bad ? null : arr
}

function defaultPoints(q) {
    if (q.points != null && q.points >= 0 && Number.isFinite(q.points)) return q.points
    return q.type === 'free-response' ? 5 : 1
}

function parseQuestion(raw, prefix) {
    const errors = []
    if (!isPlainObject(raw)) return { question: null, errors: [`${prefix}：应为对象`] }
    const o = raw
    const type = o.type
    if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
        return { question: null, errors: [`${prefix}：type 缺失或非六种题型之一`] }
    }

    const q = { type }

    if (typeof o.title === 'string') q.title = o.title
    else errors.push(`${prefix}：title 应为字符串`)

    if (typeof o.explanation === 'string') q.explanation = o.explanation
    else if (o.explanation != null) errors.push(`${prefix}：explanation 应为字符串`)

    if (o.points != null) {
        if (typeof o.points === 'number' && o.points >= 0 && Number.isFinite(o.points)) q.points = o.points
        else errors.push(`${prefix}：points 应为非负数字`)
    }

    switch (type) {
        case 'single-choice': {
            const options = asStringArray(o.options, prefix, 'options', errors)
            if (options != null) {
                if (typeof o.answer !== 'number' || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= options.length) {
                    errors.push(`${prefix}：single-choice 的 answer 应为 options 范围内的整数下标`)
                } else {
                    q.options = options; q.answer = o.answer
                }
            }
            break
        }
        case 'multiple-select': {
            const options = asStringArray(o.options, prefix, 'options', errors)
            if (options != null) {
                if (!Array.isArray(o.answer) || o.answer.length === 0) {
                    errors.push(`${prefix}：multiple-select 的 answer 应为非空数组`)
                } else if (!o.answer.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < options.length)) {
                    errors.push(`${prefix}：multiple-select 的 answer 含超出 options 范围的下标`)
                } else {
                    q.options = options; q.answer = o.answer
                }
            }
            break
        }
        case 'fill-in-the-blank': {
            const ans = asStringArray(o.answer, prefix, 'answer', errors)
            if (ans != null) q.answer = ans
            break
        }
        case 'matching': {
            const prompts = asStringArray(o.prompts, prefix, 'prompts', errors)
            const options = asStringArray(o.options, prefix, 'options', errors)
            if (prompts != null && options != null) {
                if (!Array.isArray(o.answer) || o.answer.length !== prompts.length) {
                    errors.push(`${prefix}：matching 的 answer 长度应与 prompts 一致（${prompts.length}）`)
                } else if (!o.answer.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < options.length)) {
                    errors.push(`${prefix}：matching 的 answer 含超出 options 范围的下标`)
                } else {
                    q.prompts = prompts; q.options = options; q.answer = o.answer
                }
            }
            break
        }
        case 'ordering': {
            const items = asStringArray(o.items, prefix, 'items', errors)
            if (items != null) {
                const n = items.length
                if (!Array.isArray(o.answer) || o.answer.length !== n) {
                    errors.push(`${prefix}：ordering 的 answer 长度应与 items 一致（${n}）`)
                } else {
                    const sorted = [...o.answer].sort((a, b) => a - b)
                    const expected = Array.from({ length: n }, (_, i) => i)
                    const isPerm = sorted.every((x, i) => typeof x === 'number' && Number.isInteger(x) && x === expected[i])
                    if (!isPerm) errors.push(`${prefix}：ordering 的 answer 应为 0..${n - 1} 的一个排列`)
                    else { q.items = items; q.answer = o.answer }
                }
            }
            break
        }
        case 'free-response': {
            if (typeof o.reference === 'string') q.reference = o.reference
            else if (o.reference != null) errors.push(`${prefix}：reference 应为字符串`)
            break
        }
    }

    return { question: errors.length === 0 ? q : null, errors }
}

// v2：递归校验 Section 节点；返回 { section, questionCount, maxScore }
function parseSection(raw, prefix, errors) {
    if (!isPlainObject(raw)) {
        errors.push(`${prefix}：应为对象`)
        return { section: null, questionCount: 0, maxScore: 0 }
    }
    const o = raw

    let title
    if (typeof o.title === 'string') title = o.title
    else if (o.title != null) errors.push(`${prefix}：title 应为字符串`)

    let content
    if (typeof o.content === 'string') content = o.content
    else if (o.content != null) errors.push(`${prefix}：content 应为字符串`)

    const hasQ = 'question' in o
    const hasS = 'sections' in o
    if (hasQ && hasS) {
        errors.push(`${prefix}：sections 与 question 不能同时存在（互斥）`)
        return { section: null, questionCount: 0, maxScore: 0 }
    }

    if (hasQ) {
        const r = parseQuestion(o.question, `${prefix} 的 question`)
        errors.push(...r.errors)
        if (!r.question) return { section: null, questionCount: 0, maxScore: 0 }
        return {
            section: { title, content, question: r.question },
            questionCount: 1,
            maxScore: defaultPoints(r.question),
        }
    }

    if (hasS) {
        if (!Array.isArray(o.sections)) {
            errors.push(`${prefix}：sections 应为数组`)
            return { section: null, questionCount: 0, maxScore: 0 }
        }
        let count = 0
        let score = 0
        const subs = []
        o.sections.forEach((sub, i) => {
            const r = parseSection(sub, `${prefix}.sections[${i}]`, errors)
            if (r.section) {
                subs.push(r.section)
                count += r.questionCount
                score += r.maxScore
            }
        })
        return {
            section: { title, content, sections: subs },
            questionCount: count,
            maxScore: score,
        }
    }

    // 纯展示节点
    if (content === undefined && title === undefined) {
        errors.push(`${prefix}：节点缺少 content / sections / question（空节点）`)
        return { section: null, questionCount: 0, maxScore: 0 }
    }
    return { section: { title, content }, questionCount: 0, maxScore: 0 }
}

function parseQuestionSet(text) {
    const errors = []
    let raw
    try {
        raw = JSON.parse(text)
    } catch (e) {
        return { set: null, errors: [`JSON 解析失败：${e.message}`] }
    }
    if (!isPlainObject(raw)) return { set: null, errors: ['题集顶层应为对象'] }

    let title = ''
    if (typeof raw.title === 'string' && raw.title.trim() !== '') title = raw.title
    else errors.push('题集缺少有效的 title（非空字符串）')

    let basePath
    if (typeof raw.basePath === 'string') basePath = raw.basePath
    else if (raw.basePath != null) errors.push('题集的 basePath 应为字符串')

    if (typeof raw.root !== 'object' || raw.root === null) {
        if (Array.isArray(raw.exercises)) {
            errors.push('题集缺少 root（v2 schema）。注意：v2 已废除 exercises 数组，改用 root: Section 树。')
        } else {
            errors.push('题集缺少 root（Section 树根）')
        }
        return { set: null, errors }
    }

    const r = parseSection(raw.root, 'root', errors)
    if (!r.section) return { set: null, errors }
    if (r.questionCount === 0) {
        errors.push('题集 root 树内必须至少有一道题（question）')
        return { set: null, errors }
    }

    if (errors.length > 0) return { set: null, errors }
    return { set: { title, basePath, root: r.section }, errors: [], maxScore: r.maxScore, questionCount: r.questionCount }
}

function readInput() {
    const fileArg = argv.find((a, i) => i > 1 && !a.startsWith('-') && i >= 2)
    if (fileArg) {
        try {
            return readFileSync(fileArg, 'utf8')
        } catch (e) {
            console.log(JSON.stringify({ ok: false, errors: [`无法读取文件：${e.message}`] }))
            exit(1)
        }
    }
    try {
        return readFileSync(0, 'utf8')
    } catch {
        console.log(JSON.stringify({ ok: false, errors: ['未提供输入：用法 node validate-questionset.mjs <file.json> 或通过管道传入 JSON'] }))
        exit(1)
    }
}

const text = readInput()
const result = parseQuestionSet(text)
if (result.errors.length > 0) {
    console.log(JSON.stringify({ ok: false, errors: result.errors }))
    exit(1)
}
console.log(JSON.stringify({
    ok: true,
    title: result.set.title,
    questionCount: result.questionCount,
    maxScore: result.maxScore,
}))
exit(0)
