(function () {
  'use strict'

  /* ================= 常量 ================= */
  const APP_VERSION = '1.4.0'           // 功能版本：1.4.0 = 强制休息 + 钟声10s + 人声MP3(晓晓)
  const APP_UPDATED = '2026-08-20 09:41' // 最后修改时间（每次改动务必同步更新）
  const DATA_KEY = 'time-tracker-v2'
  const SESSION_KEY = 'time-tracker-session-v2'
  const KEEP_DAYS = 7               // 只保留最近 7 天
  const MAX_MINUTES = 40            // 单次学习上限
  const REST_MINUTES = 5            // 强制休息时长
  const REST_KEY = 'time-tracker-rest-v2'
  const DAY_MIN = 24 * 60           // 一天总分钟
  const RING_C = 603.19             // 2πr (r=96)

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id)
  const els = {
    todayValue: $('today-value'),
    todayDetail: $('today-detail'),
    inputMinutes: $('input-minutes'),
    btnStart: $('btn-start'),
    restSection: $('rest-section'),
    timerSetup: document.querySelector('.timer-setup'),
    timerIdle: $('timer-idle'),
    timerLive: $('timer-live'),
    ringProgress: $('ring-progress'),
    timeLeft: $('time-left'),
    timeDone: $('time-done'),
    statusLine: $('status-line'),
    btnStop: $('btn-stop'),
    mstart: $('input-mstart'),
    mend: $('input-mend'),
    mreason: $('input-mreason'),
    btnManualSave: $('btn-manual-save'),
    manualMsg: $('manual-msg'),
    timeline: $('timeline'),
    barchart: $('barchart'),
    logList: $('log-list'),
    modal: $('modal'),
    modalIcon: $('modal-icon'),
    modalTitle: $('modal-title'),
    modalMsg: $('modal-msg'),
    btnModal: $('btn-modal')
  }

  /* ================= 状态 ================= */
  let records = loadData()          // [{id,date,start,end,minutes,source,reason,status,ts}]
  let session = loadSession()       // {id, targetMin, startTs} | null
  let tickHandle = null
  let restEndTs = loadRest()        // 休息结束时间戳，0=无需休息
  let restTickHandle = null

  /* ================= 本地存储 ================= */
  function loadData() {
    try {
      const raw = localStorage.getItem(DATA_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (Array.isArray(d.records)) return prune(d.records)
      }
    } catch (e) { /* ignore */ }
    return []
  }

  function saveData() {
    try {
      records = prune(records)
      localStorage.setItem(DATA_KEY, JSON.stringify({ records }))
    } catch (e) { /* ignore */ }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (s && s.id && typeof s.startTs === 'number') return s
      }
    } catch (e) { /* ignore */ }
    return null
  }

  function saveSession() {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
    } catch (e) { /* ignore */ }
  }

  function loadRest() {
    try {
      const raw = localStorage.getItem(REST_KEY)
      if (raw) {
        const r = JSON.parse(raw)
        if (r && typeof r.endTs === 'number') return r.endTs
      }
    } catch (e) { /* ignore */ }
    return 0
  }

  function saveRest() {
    try {
      if (restEndTs && restEndTs > Date.now()) {
        localStorage.setItem(REST_KEY, JSON.stringify({ endTs: restEndTs }))
      } else {
        localStorage.removeItem(REST_KEY)
      }
    } catch (e) { /* ignore */ }
  }

  /** 清理 7 天前的记录，返回清理后的数组 */
  function prune(list) {
    const cutoff = dayStart(Date.now() - (KEEP_DAYS - 1) * 86400000)
    const kept = list.filter((r) => r && r.date && dayStart(parseDate(r.date).getTime()) >= cutoff)
    return kept
  }

  /* ================= 日期/时间工具 ================= */
  /** 本地时区的零点时间戳 */
  function dayStart(ts) {
    const d = new Date(ts)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  /** 本地日期 YYYY-MM-DD */
  function fmtDate(ts) {
    const d = new Date(ts)
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }

  /** Date -> 'HH:MM' */
  function fmtHM(d) {
    const p = (n) => String(n).padStart(2, '0')
    return p(d.getHours()) + ':' + p(d.getMinutes())
  }

  /** 'YYYY-MM-DD' -> Date（本地） */
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  /** 秒 -> 'MM:SS'（>1h 时 'H:MM:SS'） */
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    const p = (n) => String(n).padStart(2, '0')
    return h > 0 ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s)
  }

  /** 分钟 -> 'X小时Y分' / 'Y分钟' */
  function fmtDur(min) {
    min = Math.max(0, Math.round(min))
    if (min < 1) return '0分钟'
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h === 0) return m + '分钟'
    if (m === 0) return h + '小时'
    return h + '小时' + m + '分'
  }

  /** 'HH:MM' -> 当日分钟数 */
  function toMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }

  /** 唯一 id */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }

  /* ================= 铃声 + 人声（Web Audio 合成 + 系统 TTS，无外部文件） ================= */
  let audioCtx = null

  /** 获取/解锁音频上下文（浏览器自动播放策略：需在用户手势中调用过一次才能出声） */
  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      } catch (e) { return null }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  }

  /* ---- 人声 MP3（Edge TTS 晓晓预生成） ---- */
  let voiceEl = null

  function getVoiceEl() {
    if (!voiceEl) {
      voiceEl = new Audio('./bell-voice.mp3')
      voiceEl.preload = 'auto'
    }
    return voiceEl
  }

  /** 借用户手势解锁音频元素（iOS 自动播放策略：手势内播过一次才允许后续编程播放） */
  function unlockVoice() {
    const el = getVoiceEl()
    el.muted = true
    const done = () => { el.pause(); el.currentTime = 0; el.muted = false }
    el.play().then(done).catch(() => { el.muted = false })
  }

  /** 学习结束提醒：≥10 秒钟声 + 人声播报 */
  function playBell() {
    const ctx = getAudioCtx()
    if (!ctx || ctx.state !== 'running') return
    try {
      const now = ctx.currentTime
      // 三声一组（A5-E5-C5），组起点间隔 2.0s，共 5 组：
      // 末组最后一响在 8.9s，余韵延续至 ~10.3s
      for (let g = 0; g < 5; g++) {
        const base = now + g * 2.0
        chime(ctx, base, 880)
        chime(ctx, base + 0.45, 659.25)
        chime(ctx, base + 0.9, 523.25)
      }
    } catch (e) { /* ignore */ }
    playVoice()
  }

  /** 播放人声 MP3（"学习时间到！请休息一下眼睛吧！"） */
  function playVoice() {
    const el = getVoiceEl()
    el.currentTime = 0
    el.play().catch(() => {})
  }

  /** 单次钟声：基音 + 泛音（含非整数分音 2.76x，更接近真实铃铛音色） */
  function chime(ctx, t, freq) {
    const partials = [
      { f: freq, gain: 0.35, decay: 1.4 },
      { f: freq * 2, gain: 0.12, decay: 0.9 },
      { f: freq * 2.76, gain: 0.06, decay: 0.6 }
    ]
    partials.forEach((p) => {
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(p.gain, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = p.f
      osc.connect(gain)
      osc.start(t)
      osc.stop(t + p.decay + 0.1)
    })
  }

  /* ================= 休息判断 ================= */
  /** 今天计时记录的总分钟（不含补记、不含作废） */
  function todayTimerMinutes() {
    const today = fmtDate(Date.now())
    return records
      .filter((r) => r.date === today && r.source === 'timer' && r.status === 'active')
      .reduce((sum, r) => sum + (r.minutes || 0), 0)
  }

  /** 获取今天最后一个连续学习块：{total, lastEnd}，间隔 < 5 分钟视为连续 */
  function getContinuousBlock() {
    const today = fmtDate(Date.now())
    const recs = records
      .filter((r) => r.date === today && r.source === 'timer' && r.end !== null && r.status === 'active')
      .sort((a, b) => a.ts - b.ts)
    if (recs.length === 0) return { total: 0, lastEnd: 0 }

    let blocks = []
    let cur = { total: recs[0].minutes, end: recs[0].ts }
    for (let i = 1; i < recs.length; i++) {
      const r = recs[i]
      const rStart = r.ts - r.minutes * 60000
      const gap = rStart - cur.end
      if (gap < REST_MINUTES * 60000) {
        cur.total += r.minutes
        cur.end = r.ts
      } else {
        blocks.push(cur)
        cur = { total: r.minutes, end: r.ts }
      }
    }
    blocks.push(cur)
    return blocks[blocks.length - 1]
  }

  /** 是否需要休息 */
  function needsRest() {
    if (restEndTs && restEndTs > Date.now()) return true
    const block = getContinuousBlock()
    if (block.total < MAX_MINUTES) return false
    const gapMin = (Date.now() - block.end) / 60000
    return gapMin < REST_MINUTES
  }

  /** 当前允许的单次最大学习时长 = 40 - 已连续学习（休息足够后重置为 40） */
  function currentMaxMinutes() {
    const block = getContinuousBlock()
    if (block.total === 0) return MAX_MINUTES
    const gapMin = (Date.now() - block.end) / 60000
    if (gapMin >= REST_MINUTES) return MAX_MINUTES // 休息已足够，连续块重置
    return Math.max(1, MAX_MINUTES - block.total)
  }

  /** 根据当前连续学习量更新输入框上限 */
  function updateInputMax() {
    const effMax = currentMaxMinutes()
    els.inputMinutes.max = effMax
    if (parseInt(els.inputMinutes.value, 10) > effMax) {
      els.inputMinutes.value = effMax
    }
  }

  /* ================= 休息倒计时 ================= */
  function startRest() {
    restEndTs = Date.now() + REST_MINUTES * 60000
    saveRest()
    renderRestUI(true)
    if (restTickHandle) clearInterval(restTickHandle)
    restTickHandle = setInterval(tickRest, 1000)
    tickRest()
  }

  function tickRest() {
    if (!restEndTs || restEndTs <= Date.now()) {
      restEndTs = 0
      saveRest()
      if (restTickHandle) { clearInterval(restTickHandle); restTickHandle = null }
      renderRestUI(false)
      return
    }
    const remainSec = Math.max(0, (restEndTs - Date.now()) / 1000)
    const el = $('rest-countdown')
    if (el) el.textContent = fmtClock(remainSec)
  }

  function renderRestUI(resting) {
    const setup = els.timerSetup
    const restEl = els.restSection
    if (resting) {
      setup.hidden = true
      restEl.hidden = false
      const remainSec = Math.max(0, (restEndTs - Date.now()) / 1000)
      const countdownEl = $('rest-countdown')
      if (countdownEl) countdownEl.textContent = fmtClock(remainSec)
    } else {
      setup.hidden = false
      restEl.hidden = true
      updateInputMax()
    }
  }

  /* ================= 计时核心 ================= */
  /** 清理孤儿记录：删除所有 end=null 的计时记录（双击误创建等），当前 session 对应的除外 */
  function pruneOrphans() {
    const before = records.length
    records = records.filter((r) => !(r.source === 'timer' && r.end === null && (!session || r.id !== session.id)))
    if (records.length !== before) saveData()
  }

  function startTimer() {
    if (session) return // 防重入：双击「开始学习」不会创建第二条计时
    if (needsRest()) { startRest(); return }
    const effMax = currentMaxMinutes()
    els.inputMinutes.max = effMax
    const val = parseInt(els.inputMinutes.value, 10)
    if (!val || val < 1 || val > effMax) {
      showModal('&#128276;', '时长不对哦', '请输入 1~' + effMax + ' 之间的分钟数。')
      return
    }
    const now = Date.now()
    getAudioCtx() // 借用户手势解锁音频，倒计时归零时才能响铃
    unlockVoice() // 借用户手势解锁人声 MP3
    const rec = {
      id: uid(),
      date: fmtDate(now),
      start: fmtHM(new Date(now)),
      end: null,
      minutes: 0,
      source: 'timer',
      reason: '',
      status: 'active',
      ts: now
    }
    records.push(rec)
    saveData()
    session = { id: rec.id, targetMin: val, startTs: now }
    saveSession()
    renderTimerUI(true)
  }

  /** 结束计时：mode = 'manual' | 'auto' */
  function stopTimer(mode) {
    if (!session) return
    const rec = records.find((r) => r.id === session.id)
    const targetMs = session.targetMin * 60000
    const endTs = mode === 'auto' ? session.startTs + targetMs : Date.now()
    if (rec) {
      rec.end = fmtHM(new Date(endTs))
      rec.minutes = Math.round((endTs - session.startTs) / 60000)
      // 自动完成时按目标精确计时
      if (mode === 'auto') rec.minutes = session.targetMin
      rec.reason = mode === 'auto' ? '自动结束' : '手动结束'
      rec.ts = endTs
    }
    session = null
    saveSession()
    pruneOrphans() // 当前记录已闭合，清除任何遗留的进行中记录
    saveData()
    renderTimerUI(false)
    renderToday()
    renderTimeline()
    renderWeek()
    renderLog()
    updateInputMax()
    if (mode === 'auto') {
      playBell()
      showModal('&#127881;', '学习完成！', '太棒了，本次学习了 ' + sessionTargetMin(rec) + ' 分钟，好好休息一下吧！')
    }
  }

  /** 自动结束时取记录分钟数（session 已清空，从 rec 取） */
  function sessionTargetMin(rec) {
    return rec ? rec.minutes : 0
  }

  function tick() {
    if (!session) return
    const elapsedSec = (Date.now() - session.startTs) / 1000
    const targetSec = session.targetMin * 60
    const remainSec = targetSec - elapsedSec
    const frac = Math.max(0, Math.min(1, remainSec / targetSec))
    els.ringProgress.style.strokeDashoffset = String(RING_C * (1 - frac))
    els.timeLeft.textContent = fmtClock(remainSec)
    els.timeDone.textContent = '已学 ' + fmtClock(elapsedSec)
    renderToday() // 今日总时长实时累加
    if (remainSec <= 0) {
      stopTimer('auto')
      return
    }
    // 跨天时实时更新时间轴（定时器开始时画了，这里轻量刷新）
    if (fmtDate(Date.now()) !== session._date) {
      session._date = fmtDate(Date.now())
      renderTimeline()
    }
  }

  /** 页面加载时恢复计时会话 */
  function resumeSession() {
    if (!session) return
    const elapsedSec = (Date.now() - session.startTs) / 1000
    const targetSec = session.targetMin * 60
    session._date = fmtDate(session.startTs)
    if (elapsedSec >= targetSec) {
      // 离开期间已完成
      stopTimer('auto')
      return
    }
    renderTimerUI(true)
    tick()
  }

  function renderTimerUI(running) {
    if (running) {
      els.timerSetup.hidden = true
      els.timerIdle.hidden = true
      els.timerLive.hidden = false
      els.timeLeft.textContent = fmtClock(session.targetMin * 60)
      els.timeDone.textContent = '已学 00:00'
      els.ringProgress.style.strokeDashoffset = '0'
      els.statusLine.textContent = '学习中，剩余 ' + session.targetMin + ' 分钟，加油！'
      if (tickHandle) clearInterval(tickHandle)
      tickHandle = setInterval(tick, 1000)
      tick()
    } else {
      if (tickHandle) { clearInterval(tickHandle); tickHandle = null }
      els.timerSetup.hidden = false
      els.timerIdle.hidden = false
      els.timerLive.hidden = true
    }
  }

  /* ================= 补记 ================= */
  function saveManual() {
    const s = els.mstart.value
    const e = els.mend.value
    const reason = els.mreason.value.trim()
    if (!s || !e) {
      setManualMsg('err', '请填写起始时间和结束时间。')
      return
    }
    if (s === e) {
      setManualMsg('err', '起始和结束时间不能相同。')
      return
    }
    // 跨天：end <= start 视为次日
    let minutes = toMin(e) - toMin(s)
    if (minutes <= 0) minutes += DAY_MIN
    const now = Date.now()
    const rec = {
      id: uid(),
      date: fmtDate(now),
      start: s,
      end: e,
      minutes,
      source: 'manual',
      reason: reason || '补记',
      status: 'active',
      ts: now
    }
    records.push(rec)
    saveData()
    setManualMsg('ok', '已保存：' + s + ' ~ ' + e + '（' + fmtDur(minutes) + '）')
    els.mstart.value = ''
    els.mend.value = ''
    els.mreason.value = ''
    renderToday()
    renderTimeline()
    renderWeek()
    renderLog()
  }

  function setManualMsg(type, text) {
    els.manualMsg.textContent = text
    els.manualMsg.className = 'form-msg ' + (type === 'ok' ? 'ok' : 'err')
    if (type === 'ok') setTimeout(() => { els.manualMsg.textContent = '' }, 4000)
  }

  /* ================= 记录操作 ================= */
  function voidRecord(id) {
    const rec = records.find((r) => r.id === id)
    if (!rec || rec.source !== 'timer') return
    rec.status = 'void'
    saveData()
    renderToday(); renderTimeline(); renderWeek(); renderLog()
  }

  function restoreRecord(id) {
    const rec = records.find((r) => r.id === id)
    if (!rec) return
    rec.status = 'active'
    saveData()
    renderToday(); renderTimeline(); renderWeek(); renderLog()
  }

  function deleteRecord(id) {
    const rec = records.find((r) => r.id === id)
    if (!rec || rec.source !== 'manual') return
    records = records.filter((r) => r.id !== id)
    saveData()
    renderToday(); renderTimeline(); renderWeek(); renderLog()
  }

  /* ================= 统计渲染 ================= */
  /** 今日有效学习分钟（active 记录） */
  function todayMinutes() {
    const today = fmtDate(Date.now())
    return records
      .filter((r) => r.date === today && r.status === 'active')
      .reduce((sum, r) => sum + (r.minutes || 0), 0)
  }

  /** 最近 N 天每天的有效分钟，返回 [{date,label,today,min}] 升序 */
  function weekStats() {
    const out = []
    const now = Date.now()
    const today = fmtDate(now)
    const wd = ['日', '一', '二', '三', '四', '五', '六']
    for (let i = KEEP_DAYS - 1; i >= 0; i--) {
      const ts = now - i * 86400000
      const date = fmtDate(ts)
      const d = new Date(ts)
      let label
      if (date === today) label = '今天'
      else if (i === 1) label = '昨天'
      else label = '周' + wd[d.getDay()]
      const min = records
        .filter((r) => r.date === date && r.status === 'active')
        .reduce((sum, r) => sum + (r.minutes || 0), 0)
      out.push({ date, label, today: date === today, min })
    }
    return out
  }

  function renderToday() {
    const min = todayMinutes()
    els.todayValue.textContent = fmtClock(min * 60)
    const activeCount = records.filter((r) => r.date === fmtDate(Date.now()) && r.status === 'active').length
    const runningMin = session ? Math.round((Date.now() - session.startTs) / 60000) : 0
    if (min === 0 && !session) {
      els.todayDetail.textContent = '还没有学习记录，加油开始吧！'
    } else {
      els.todayDetail.textContent = '共 ' + activeCount + ' 段学习' + (runningMin > 0 ? '（进行中 ' + runningMin + ' 分钟）' : '')
    }
  }

  function renderTimeline() {
    els.timeline.innerHTML = ''
    const today = fmtDate(Date.now())
    const recs = records.filter((r) => r.date === today && r.end !== null)
    // 正在进行的计时画成活动块
    let blocks = recs.map((r) => ({
      startMin: toMin(r.start),
      endMin: toMin(r.end),
      status: r.status,
      title: (r.source === 'timer' ? '计时 ' : '补记 ') + r.start + '~' + r.end + ' · ' + fmtDur(r.minutes)
    }))
    if (session) {
      const startMin = toMin(fmtHM(new Date(session.startTs)))
      const endMin = Math.min(DAY_MIN, startMin + Math.max(0, (Date.now() - session.startTs) / 60000))
      if (endMin > startMin) {
        blocks.push({ startMin, endMin, status: 'active', title: '进行中 ' + fmtHM(new Date(session.startTs)) + '~现在' })
      }
    }
    // 时间带
    for (let h = 0; h < 24; h += 3) {
      const zone = document.createElement('div')
      zone.className = 'timeline-zone'
      zone.style.left = (h / 24) * 100 + '%'
      zone.style.width = (3 / 24) * 100 + '%'
      zone.dataset.u32Name = 'timeline-zone'
      els.timeline.appendChild(zone)
    }
    if (blocks.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'timeline-empty'
      empty.dataset.u32Name = 'timeline-empty'
      empty.textContent = '今天还没有学习时段'
      els.timeline.appendChild(empty)
    } else {
      blocks.forEach((b) => {
        const block = document.createElement('div')
        block.className = 'timeline-block' + (b.status === 'void' ? ' void-block' : '')
        const start = Math.max(0, b.startMin)
        const end = Math.min(DAY_MIN, Math.max(start + 1, b.endMin))
        block.style.left = (start / DAY_MIN) * 100 + '%'
        block.style.width = Math.max(0.8, ((end - start) / DAY_MIN) * 100) + '%'
        block.title = b.title
        block.dataset.u32Name = 'timeline-block'
        els.timeline.appendChild(block)
      })
    }
    const label = document.createElement('div')
    label.className = 'timeline-label'
    label.dataset.u32Name = 'timeline-label'
    label.innerHTML = '<span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span>'
    els.timeline.appendChild(label)
  }

  function renderWeek() {
    els.barchart.innerHTML = ''
    const stats = weekStats()
    const max = Math.max(1, ...stats.map((s) => s.min))
    stats.forEach((s) => {
      const col = document.createElement('div')
      col.className = 'bar-col'
      col.dataset.u32Name = 'bar-col'
      const val = document.createElement('div')
      val.className = 'bar-value'
      val.textContent = s.min > 0 ? fmtDur(s.min).replace('小时', 'h').replace('分钟', 'm').replace('分', 'm') : ''
      val.dataset.u32Name = 'bar-value'
      const bar = document.createElement('div')
      bar.className = 'bar' + (s.min === 0 ? ' zero' : '') + (s.today ? ' today-bar' : '')
      bar.style.height = (s.min / max) * 100 + '%'
      bar.title = s.date + ' 学习 ' + fmtDur(s.min)
      bar.dataset.u32Name = 'bar'
      const lab = document.createElement('div')
      lab.className = 'bar-label' + (s.today ? ' today-label-b' : '')
      lab.textContent = s.label
      lab.dataset.u32Name = 'bar-label'
      col.appendChild(val)
      col.appendChild(bar)
      col.appendChild(lab)
      els.barchart.appendChild(col)
    })
  }

  function renderLog() {
    els.logList.innerHTML = ''
    // 7 天内记录：active 在前、void 置底灰色
    const list = prune(records.slice())
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.ts - a.ts
    })
    if (list.length === 0) {
      const li = document.createElement('li')
      li.className = 'log-empty'
      li.dataset.u32Name = 'log-empty'
      li.textContent = '还没有记录'
      els.logList.appendChild(li)
      return
    }
    list.forEach((r) => {
      const li = document.createElement('li')
      li.className = 'log-item' + (r.status === 'void' ? ' void' : '')
      li.dataset.u32Name = 'log-item'

      const badge = document.createElement('span')
      badge.className = 'log-badge ' + (r.status === 'void' ? 'void' : r.source)
      badge.textContent = r.status === 'void' ? '已作废' : (r.source === 'timer' ? '计时' : '补记')
      badge.dataset.u32Name = 'log-badge'

      const body = document.createElement('div')
      body.className = 'log-body'
      body.dataset.u32Name = 'log-body'
      const time = document.createElement('div')
      time.className = 'log-time'
      time.textContent = r.end === null
        ? r.date.slice(5) + '  ' + r.start + ' 进行中…'
        : r.date.slice(5) + '  ' + r.start + ' ~ ' + r.end + ' · ' + fmtDur(r.minutes)
      time.dataset.u32Name = 'log-time'
      body.appendChild(time)
      if (r.reason) {
        const reason = document.createElement('div')
        reason.className = 'log-reason'
        reason.textContent = r.source === 'manual' ? '原因：' + r.reason : r.reason
        reason.dataset.u32Name = 'log-reason'
        body.appendChild(reason)
      }

      const actions = document.createElement('div')
      actions.className = 'log-actions'
      actions.dataset.u32Name = 'log-actions'
      // 进行中的计时记录不提供操作按钮（结束后才能作废/启用）
      if (r.end === null) {
        // 无操作
      } else if (r.source === 'timer') {
        const btn = document.createElement('button')
        btn.className = 'btn ' + (r.status === 'void' ? 'btn-restore' : 'btn-void')
        btn.textContent = r.status === 'void' ? '启用' : '作废'
        btn.dataset.u32Name = 'log-btn-toggle'
        btn.addEventListener('click', () => {
          if (r.status === 'void') restoreRecord(r.id)
          else voidRecord(r.id)
        })
        actions.appendChild(btn)
      } else {
        const btn = document.createElement('button')
        btn.className = 'btn btn-del'
        btn.textContent = '删除'
        btn.dataset.u32Name = 'log-btn-del'
        btn.addEventListener('click', () => confirmDelete(r))
        actions.appendChild(btn)
      }

      li.appendChild(badge)
      li.appendChild(body)
      li.appendChild(actions)
      els.logList.appendChild(li)
    })
  }

  function confirmDelete(rec) {
    showModal('&#128465;', '删除这条补记？', rec.start + ' ~ ' + rec.end + '（' + fmtDur(rec.minutes) + '）将永久删除。', () => deleteRecord(rec.id))
  }

  /* ================= 弹窗 ================= */
  function showModal(icon, title, msg, onClose) {
    els.modalIcon.innerHTML = icon
    els.modalTitle.textContent = title
    els.modalMsg.textContent = msg
    els.modal.hidden = false
    els.modal.dataset.onClose = onClose ? '1' : ''
    els.modal._cb = onClose || null
  }

  function closeModal() {
    if (!els.modal.hidden) {
      const cb = els.modal._cb
      els.modal.hidden = true
      if (typeof cb === 'function') cb()
    }
  }

  /* ================= 事件绑定 ================= */
  els.btnStart.addEventListener('click', startTimer)
  els.btnStop.addEventListener('click', () => stopTimer('manual'))
  els.btnManualSave.addEventListener('click', saveManual)
  els.btnModal.addEventListener('click', closeModal)
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal()
  })

  /* ================= 初始化 ================= */
  console.log('[time-tracker] v' + APP_VERSION + ' · 最后修改 ' + APP_UPDATED)
  renderTimerUI(false)
  pruneOrphans() // 清理历史遗留的孤儿记录（session 已从 localStorage 恢复）
  resumeSession()
  // 恢复休息状态（页面刷新时休息未结束则继续倒计时）
  if (restEndTs && restEndTs > Date.now()) {
    renderRestUI(true)
    if (restTickHandle) clearInterval(restTickHandle)
    restTickHandle = setInterval(tickRest, 1000)
    tickRest()
  } else {
    restEndTs = 0
    saveRest()
  }
  updateInputMax()
  renderToday()
  renderTimeline()
  renderWeek()
  renderLog()
})()
