#!/usr/bin/env node
// fetch-words.mjs — 从教材数据源拉取单词
// 零依赖，Node ≥ 18（原生 fetch）。
// 数据源: https://kid.u32.cn/english/nce/data
// 默认输出纯文本（每行 word|词性释义，可管道串接 build-url）；--json 输出结构化。

const API = 'https://kid.u32.cn/english/nce/data'

function parseArgs(argv) {
    const args = { _: [] }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--') { args._.push(...argv.slice(i + 1)); break }
        if (a.startsWith('--')) {
            const key = a.slice(2)
            const next = argv[i + 1]
            if (next === undefined || next.startsWith('--')) {
                args[key] = true
            } else {
                args[key] = next
                i++
            }
        } else {
            args._.push(a)
        }
    }
    return args
}

function str(v) {
    return typeof v === 'string' ? v : ''
}

function parseLessons(spec) {
    const set = new Set()
    for (const part of String(spec).split(',')) {
        const s = part.trim()
        if (!s) continue
        const m = s.match(/^(\d+)(?:-(\d+))?$/)
        if (!m) throw new Error(`无法解析课次规格: "${s}"（应用形如 1,3,5-7）`)
        const a = parseInt(m[1], 10)
        const b = m[2] !== undefined ? parseInt(m[2], 10) : a
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        for (let n = lo; n <= hi; n++) set.add(n)
    }
    return [...set].sort((x, y) => x - y)
}

// 单词三元组 → 文本（与应用 apiWordToText 一致）
function wordToText(w) {
    const [word, type, meaning] = w
    return type ? `${word}|${type} ${meaning}` : `${word}|${meaning}`
}

function printJson(obj) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n')
}

async function getJson(pathname) {
    const res = await fetch(`${API}/${pathname}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} ${pathname}`)
    return res.json()
}

async function main() {
    const args = parseArgs(process.argv.slice(2))

    if (args.help || args.h) {
        process.stderr.write([
            'fetch-words.mjs — 从教材数据源拉取单词',
            '',
            '用法:',
            '  node fetch-words.mjs --list-books',
            '  node fetch-words.mjs --book <dir> --list',
            '  node fetch-words.mjs --book <dir> --lessons <1,3,5-7> [--json]',
            '',
            '参数:',
            '  --list-books           列出全部书目（JSON）',
            '  --book <dir>           教材代号，如 nce1、phonics/book1',
            '  --list                 配合 --book，列出该书课次（JSON）',
            '  --lessons <spec>       课次规格，逗号分隔，支持范围：1,3,5-7',
            '  --json                 结构化输出（默认每行 word|词性释义 纯文本）',
            '',
            '数据源: ' + API,
            ''
        ].join('\n'))
        process.exit(0)
    }

    if (args['list-books']) {
        const data = await getJson('index.json')
        printJson({ ok: true, books: data.books })
        return
    }

    const dir = str(args.book)
    if (!dir) {
        process.stderr.write('错误: 缺少 --book 参数（如 nce1）。用 --list-books 查看全部书目。\n')
        process.exit(1)
    }

    if (args.list) {
        const data = await getJson(`${dir}/index.json`)
        printJson({ ok: true, book: dir, lessons: data.lessons })
        return
    }

    const lessonsSpec = str(args.lessons)
    if (!lessonsSpec) {
        process.stderr.write(`错误: 缺少 --lessons 参数（如 1,3,5-7）。用 --book ${dir} --list 查看该书课次。\n`)
        process.exit(1)
    }

    const lessonNums = parseLessons(lessonsSpec)

    const results = await Promise.all(lessonNums.map(async n => {
        try {
            const data = await getJson(`${dir}/lesson_${n}.json`)
            return { n, title: data.title, words: data.words }
        } catch (e) {
            return { n, error: e.message }
        }
    }))

    const errors = results.filter(r => r.error).map(r => ({ lesson: r.n, error: r.error }))
    const okResults = results.filter(r => !r.error)

    if (args.json) {
        const words = okResults.flatMap(r =>
            (r.words || []).map(w => ({ word: w[0], type: w[1], meaning: w[2], lesson: r.n }))
        )
        printJson({
            ok: errors.length === 0,
            book: dir,
            lessons: lessonNums,
            wordCount: words.length,
            words,
            errors,
        })
    } else {
        const lines = okResults.flatMap(r => (r.words || []).map(wordToText))
        process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''))
        if (errors.length) {
            process.stderr.write(`警告: ${errors.length} 课拉取失败: ${errors.map(e => 'L' + e.lesson).join(', ')}\n`)
        }
    }

    if (errors.length) process.exitCode = 1
}

main().catch(e => {
    process.stderr.write('错误: ' + (e && e.message ? e.message : String(e)) + '\n')
    process.exit(1)
})
