#!/usr/bin/env node
// build-url.mjs — 标题 + 单词文本 → 测试 URL（自动 percent-encode）
// 零依赖，Node ≥ 18。单词来源优先级：--words > --words-file > stdin(管道)。
// stdout 仅输出 JSON；进度/帮助走 stderr。

const DEFAULT_BASE = 'https://kid.u32.cn/words-test/index.html'

function parseArgs(argv) {
    const args = { _: [] }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--' ) { args._.push(...argv.slice(i + 1)); break }
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

function readStdin() {
    return new Promise(resolve => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', chunk => { data += chunk })
        process.stdin.on('end', () => resolve(data))
    })
}

function str(v) {
    return typeof v === 'string' ? v : ''
}

async function main() {
    const args = parseArgs(process.argv.slice(2))

    if (args.help || args.h) {
        process.stderr.write([
            'build-url.mjs — 生成单词测试 URL',
            '',
            '用法:',
            '  node build-url.mjs [--title <标题>] [--words <文本> | --words-file <路径>] [--base <url>]',
            '',
            '参数:',
            '  --title <str>       测试标题（可省略）',
            '  --words <str>       内联单词文本（可含换行）',
            '  --words-file <path> 从文件读单词文本',
            '  --base <url>        应用入口 URL（默认公网地址）',
            '',
            '单词来源优先级: --words > --words-file > stdin(管道)',
            '单词格式: 每行 "单词|释义" 或 "单词|释义|例句"',
            '',
            '输出: stdout JSON { ok, url, title, wordCount, preview, ... }',
            ''
        ].join('\n'))
        process.exit(0)
    }

    const base = str(args.base) || DEFAULT_BASE
    const title = str(args.title)

    let words = ''
    const inlineWords = str(args.words)
    const wordsFile = str(args['words-file'])
    if (inlineWords) {
        words = inlineWords
    } else if (wordsFile) {
        const fs = await import('node:fs')
        words = fs.readFileSync(wordsFile, 'utf8')
    } else if (process.stdin.isTTY) {
        process.stderr.write('错误: 未提供单词文本。请用 --words / --words-file，或通过管道传入。\n')
        process.exit(1)
    } else {
        words = await readStdin()
    }

    words = words.trim()
    if (!words) {
        process.stderr.write('错误: 单词文本为空。\n')
        process.exit(1)
    }

    // 校验（复刻应用 parseWordsWithIssues 的有效行判定）
    const lines = words.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const valid = lines.filter(l => {
        const parts = l.split('|').map(s => s.trim())
        return (parts[0] || '').length > 0 && (parts[1] || '').length > 0
    })
    const issueCount = lines.length - valid.length

    if (valid.length === 0) {
        process.stdout.write(JSON.stringify({ ok: false, error: '没有有效单词行（均缺单词或释义）' }, null, 2) + '\n')
        process.exit(1)
    }

    const u = new URL(base)
    if (title) u.searchParams.set('title', title)
    u.searchParams.set('words', words)

    const out = {
        ok: true,
        url: u.toString(),
        title,
        wordCount: valid.length,
        preview: valid.slice(0, 5).join('\n') + (valid.length > 5 ? '\n...' : ''),
    }
    if (issueCount > 0) out.warnings = `${issueCount} 行因缺单词/释义将被应用忽略`

    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

main().catch(e => {
    process.stderr.write('错误: ' + (e && e.message ? e.message : String(e)) + '\n')
    process.exit(1)
})
