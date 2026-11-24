/* 词语表 — 阅读/背诵 单页应用（原生 JS，无依赖）
 * 背诵模式只模糊词语汉字，拼音两种模式始终清晰；按住词语可偷看。
 * 重点标记：点击词语上方拼音切换 ⭐（两种模式可用，背诵模式按住汉字偷看不变）。
 */
(function () {
  'use strict';

  // 版本标识：随每次发布手动更新（与 sw.js VERSION 保持同步），用于控制台核对缓存新旧
  console.log('[词语表] 版本 v1.2.0 · 最后修订 2026-09-06');

  const state = {
    books: [],
    standard: '2022',   // 课标版本 tab：2022 / 2011
    bookId: '',         // 当前册
    mode: 'read',
    q: '',
    memOnly: false,
    starOnly: false,
  };
  const DONE_KEY = 'words-list-done';
  let doneSet = new Set();
  try { doneSet = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch {}
  const STAR_KEY = 'words-list-star';   // 重点词："册id:课名:词"
  let starSet = new Set();
  try { starSet = new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]')); } catch {}

  // 册次短名：二年级上册 → 二上（chip 展示用）
  const NUM_CN = { 一: '一', 二: '二', 三: '三', 四: '四', 五: '五', 六: '六' };

  const $ = s => document.querySelector(s);
  const listEl = $('#lessonList');
  const bookChipsEl = $('#bookChips');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function saveDone() {
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneSet])); } catch {}
  }

  function saveStars() {
    try { localStorage.setItem(STAR_KEY, JSON.stringify([...starSet])); } catch {}
  }

  function booksOf(standard) {
    return state.books.filter(b => b.standardKey === standard);
  }
  function currentBook() {
    return state.books.find(b => b.id === state.bookId) || null;
  }
  function gradeShort(grade) {
    const m = grade.match(/^([一二三四五六])年级(上|下)册$/);
    return m ? NUM_CN[m[1]] + (m[2] === '上' ? '上' : '下') : grade;
  }
  function bookWords(b) {
    return b.sections.reduce((s, sec) => s + sec.lessons.reduce((x, l) => x + l.words.length, 0), 0);
  }

  // 搜索 hay：词语 + 拼音（保留声调）+ 拼音（去声调），输入同样去声调比对
  function stripTone(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function lessonVisible(l) {
    const q = state.q.trim().toLowerCase();
    if (state.memOnly && doneSet.has(state.bookId + ':' + l.lesson)) return false;
    if (state.starOnly && !l.words.some(w => starSet.has(state.bookId + ':' + l.lesson + ':' + w.w))) return false;
    if (!q) return true;
    const hay = l.words.map(w => w.w + ' ' + w.p + ' ' + stripTone(w.p)).join(' ').toLowerCase();
    return hay.includes(q) || stripTone(q) && hay.includes(stripTone(q));
  }

  function renderChips() {
    const books = booksOf(state.standard);
    bookChipsEl.innerHTML = '';
    const mk = (b) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (state.bookId === b.id ? ' active' : '');
      btn.textContent = gradeShort(b.grade);
      btn.setAttribute('data-u32-name', 'book-chip-' + b.id);
      btn.onclick = () => { state.bookId = b.id; state.q = ''; $('#searchInput').value = ''; renderChips(); render(); };
      return btn;
    };
    books.forEach(b => bookChipsEl.appendChild(mk(b)));
  }

  function cardHtml(b, sec, l) {
    const id = b.id + ':' + l.lesson;
    const done = doneSet.has(id);
    const tab = state.mode === 'recite' ? ' tabindex="0"' : '';
    const shown = state.starOnly ? l.words.filter(w => starSet.has(b.id + ':' + l.lesson + ':' + w.w)) : l.words;
    const words = shown.map(w => {
      const star = starSet.has(b.id + ':' + l.lesson + ':' + w.w);
      return '<span class="word' + (star ? ' starred' : '') + '"' + tab + ' data-u32-name="word">' +
        '<span class="word-py" data-u32-name="word-py" title="点击标记/取消重点">' + esc(w.p) + '</span>' +
        '<span class="word-hz" data-u32-name="word-hz">' +
          Array.from(w.w).map(ch => '<i class="cz" data-char="' + esc(ch) + '">' + esc(ch) + '</i>').join('') +
        '</span>' +
      '</span>';
    }).join('');
    const badge = state.starOnly ? shown.length + ' / ' + l.words.length + ' 词' : l.words.length + ' 词';
    return '' +
    '<article class="lesson-card' + (done ? ' is-done' : '') + '" data-id="' + esc(id) + '" data-u32-name="lesson-card">' +
      '<div class="lesson-head" data-u32-name="lesson-head">' +
        '<h3 class="lesson-name" data-u32-name="lesson-name">' + esc(l.lesson) +
          '<span class="badge" data-u32-name="word-count">' + badge + '</span></h3>' +
        '<div class="lesson-actions" data-u32-name="lesson-actions">' +
          '<button class="icon-btn' + (done ? ' done' : '') + '" data-act="done" data-u32-name="done-btn">' +
            (done ? '✓ 已掌握' : '标记掌握') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="words" data-u32-name="words">' + words + '</div>' +
    '</article>';
  }

  // 计数标签（render 与重点标记局部更新共用，自算过滤计数）
  function updateCountLabel() {
    const b = currentBook();
    if (!b) return 0;
    const totalLessons = b.sections.reduce((s, sec) => s + sec.lessons.length, 0);
    const shownLessons = b.sections.reduce((s, sec) => s + sec.lessons.filter(lessonVisible).length, 0);
    const doneCount = b.sections.reduce((s, sec) => s + sec.lessons.filter(l => doneSet.has(b.id + ':' + l.lesson)).length, 0);
    const starCount = b.sections.reduce((s, sec) => s + sec.lessons.reduce((x, l) =>
      x + l.words.filter(w => starSet.has(b.id + ':' + l.lesson + ':' + w.w)).length, 0), 0);
    $('#countLabel').textContent = (state.q || state.memOnly || state.starOnly)
      ? '显示 ' + shownLessons + ' / ' + totalLessons + ' 课'
      : b.grade + ' · ' + totalLessons + ' 课 · ' + bookWords(b) + ' 词 · 已掌握 ' + doneCount + ' 课 · 重点 ' + starCount + ' 词';
    return starCount;
  }

  function render() {
    const b = currentBook();
    if (!b) { listEl.innerHTML = '<div class="empty" data-u32-name="empty">没有该册数据</div>'; return; }
    const starCount = updateCountLabel();
    const filtered = b.sections
      .map(sec => ({ title: sec.title, lessons: sec.lessons.filter(lessonVisible) }))
      .filter(sec => sec.lessons.length);

    if (!filtered.length) {
      const tip = (state.starOnly && !starCount && !state.q)
        ? '还没有重点词<br><small>点击词语上方的拼音即可标记重点 ⭐</small>'
        : '没有符合条件的词语 🖌️';
      listEl.innerHTML = '<div class="empty" data-u32-name="empty">' + tip + '</div>';
      return;
    }
    let html = '';
    filtered.forEach(sec => {
      html += '<h2 class="sec-title" data-u32-name="sec-title">' + esc(sec.title) + '</h2>';
      sec.lessons.forEach(l => { html += cardHtml(b, sec, l); });
    });
    listEl.innerHTML = html;
  }

  // ---- 背诵模式：按住词语偷看（Pointer Events + 键盘等效） ----
  const peekTimers = new WeakMap();
  listEl.addEventListener('pointerdown', e => {
    if (state.mode !== 'recite') return;
    if (e.target.closest('.word-py')) return;   // 拼音区留给重点标记，不触发偷看
    const word = e.target.closest('.word');
    if (!word) return;
    e.preventDefault();
    const t = setTimeout(() => word.classList.add('peek'), 90);
    peekTimers.set(word, t);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    listEl.addEventListener(evt, e => {
      const word = e.target.closest('.word');
      if (!word) return;
      clearTimeout(peekTimers.get(word));
      word.classList.remove('peek');
    }, true);
  });
  listEl.addEventListener('scroll', clearPeek, { passive: true });
  document.addEventListener('touchmove', clearPeek, { passive: true });
  listEl.addEventListener('keydown', e => {
    if (state.mode !== 'recite') return;
    const word = e.target.closest('.word');
    if (!word || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    word.classList.add('peek');
  });
  listEl.addEventListener('keyup', e => {
    const word = e.target.closest('.word');
    if (!word || (e.key !== 'Enter' && e.key !== ' ')) return;
    word.classList.remove('peek');
  });
  // 禁用长按选中/菜单（背诵偷看依赖手势）
  listEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.word')) e.preventDefault();
  });
  function clearPeek() {
    listEl.querySelectorAll('.word.peek').forEach(w => {
      clearTimeout(peekTimers.get(w));
      w.classList.remove('peek');
    });
  }

  // ---- 笔顺动画弹层（仅阅读模式；数据同域 kid.u32.cn/data，源自 hanzi-writer-data@2.0.1） ----
  const STROKE_BASE = 'https://kid.u32.cn/data/hanzi-writer-data/';
  const strokeCache = new Map();   // 字 → 笔画数据，会话内复用
  let strokeWriter = null;         // 当前 HanziWriter 实例

  const strokePop = $('#strokePop');
  const strokeStage = $('#strokeStage');
  const strokeGrid = $('#strokeGrid');
  const strokeWriterEl = $('#writer');

  function closeStroke() {
    if (strokeWriter) {
      try { strokeWriter.pauseAnimation(); } catch (e) { /* 已停止则忽略 */ }
      strokeWriter = null;
    }
    strokePop.hidden = true;
  }

  function openStroke(char, pinyin) {
    if (typeof HanziWriter === 'undefined') return;
    $('#strokeChar').textContent = char;
    $('#strokePy').textContent = pinyin || '';
    $('#strokeErrChar').textContent = char;
    $('#strokeLoading').hidden = false;
    $('#strokeError').hidden = true;
    strokePop.hidden = false;

    // 田字格尺寸随视口收缩（外框实线 + 十字虚线，同 character-test 参考实现）
    const size = Math.round(Math.min(window.innerWidth * 0.72, window.innerHeight * 0.52, 340));
    strokeStage.style.width = size + 'px';
    strokeStage.style.height = size + 'px';
    strokeGrid.setAttribute('width', size);
    strokeGrid.setAttribute('height', size);
    strokeGrid.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    strokeGrid.innerHTML =
      '<rect x="0.75" y="0.75" width="' + (size - 1.5) + '" height="' + (size - 1.5) + '" fill="none" stroke="#ddd"/>' +
      '<line x1="' + size / 2 + '" y1="0" x2="' + size / 2 + '" y2="' + size + '" stroke="#eee" stroke-dasharray="5 5"/>' +
      '<line x1="0" y1="' + size / 2 + '" x2="' + size + '" y2="' + size / 2 + '" stroke="#eee" stroke-dasharray="5 5"/>';
    strokeWriterEl.innerHTML = '';   // 清掉上一个字的 svg

    const start = (data) => {
      if (strokePop.hidden) return;  // 数据回来前弹层已被关闭
      $('#strokeLoading').hidden = true;
      strokeWriter = HanziWriter.create(strokeWriterEl, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        strokeColor: '#333',
        charDataLoader: () => Promise.resolve(data),
      });
      strokeWriter.loopCharacterAnimation();
    };
    const fail = () => {
      $('#strokeLoading').hidden = true;
      $('#strokeError').hidden = false;
    };

    if (strokeCache.has(char)) { start(strokeCache.get(char)); return; }
    fetch(STROKE_BASE + encodeURIComponent(char) + '.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { strokeCache.set(char, data); start(data); })
      .catch(fail);
  }

  $('#strokeClose').onclick = closeStroke;
  strokePop.addEventListener('click', e => { if (e.target === strokePop) closeStroke(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !strokePop.hidden) closeStroke(); });

  // 多音节词取指定位置的音节作单字拼音；儿化等字数与音节数不一致时回退整词拼音
  function charPinyin(word, pinyin, idx) {
    const syl = String(pinyin || '').split(' ').filter(Boolean);
    return syl.length >= word.length ? (syl[idx] || pinyin) : pinyin;
  }

  // ---- 列表点击（事件委托）：点拼音切换重点标记；阅读模式点字看笔顺；按钮走 data-act ----
  listEl.addEventListener('click', e => {
    const py = e.target.closest('.word-py');
    if (py) {
      const wordEl = py.closest('.word');
      const card = py.closest('.lesson-card');
      const hzEl = wordEl ? wordEl.querySelector('.word-hz') : null;
      if (wordEl && card && hzEl) {
        const w = hzEl.textContent;
        const key = card.dataset.id + ':' + w;
        const on = !starSet.has(key);
        on ? starSet.add(key) : starSet.delete(key);
        saveStars();
        // 局部同步同课同名词，不整页重绘；"只看重点"视图下取消标记则重绘保持过滤一致
        if (!on && state.starOnly) render();
        else {
          card.querySelectorAll('.word').forEach(el => {
            if (el.querySelector('.word-hz').textContent === w) el.classList.toggle('starred', on);
          });
          updateCountLabel();   // 重点词数变了，计数标签同步
        }
      }
      return;
    }
    if (state.mode === 'read') {
      const cz = e.target.closest('.cz');
      if (cz) {
        const wordEl = cz.closest('.word');
        const hzEl = wordEl ? wordEl.querySelector('.word-hz') : null;
        const pyEl = wordEl ? wordEl.querySelector('.word-py') : null;
        const idx = hzEl ? Array.from(hzEl.querySelectorAll('.cz')).indexOf(cz) : 0;
        openStroke(cz.dataset.char, pyEl ? charPinyin(hzEl.textContent, pyEl.textContent, idx) : '');
        return;
      }
    }
    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    const card = actBtn.closest('.lesson-card');
    const id = card.dataset.id;
    if (actBtn.dataset.act === 'done') {
      doneSet.has(id) ? doneSet.delete(id) : doneSet.add(id);
      saveDone(); render();
    }
  });

  // ---- 全局控件 ----
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.onclick = () => {
      // 记录切换前视口中央的课卡及其视口位置（用于切换后补偿滚动）
      const anchor = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.4);
      const anchorCard = anchor ? anchor.closest('.lesson-card') : null;
      const anchorTop = anchorCard ? anchorCard.getBoundingClientRect().top : null;

      state.mode = b.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(x => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      document.body.classList.toggle('recite', state.mode === 'recite');
      // 模式切换只换 CSS class，不重新渲染；清掉临时偷看与笔顺弹层
      clearPeek();
      closeStroke();
      // 仅背诵模式词语可 Tab 聚焦（键盘按住 Enter/Space 查看）
      listEl.querySelectorAll('.word').forEach(w => {
        if (state.mode === 'recite') w.setAttribute('tabindex', '0');
        else w.removeAttribute('tabindex');
      });

      // 布局变化后，把锚点课卡滚回原视口位置
      if (anchorCard) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const delta = anchorCard.getBoundingClientRect().top - anchorTop;
          if (delta) window.scrollBy(0, delta);
        }));
      }
    };
  });
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.onclick = () => {
      state.standard = b.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.toggle('active', x === b));
      const books = booksOf(state.standard);
      state.bookId = books.some(x => x.id === state.bookId) ? state.bookId : (books[0] ? books[0].id : '');
      renderChips(); render();
    };
  });
  let searchTimer = null;
  $('#searchInput').addEventListener('input', e => {
    state.q = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 200);
  });
  $('#memOnly').addEventListener('change', e => { state.memOnly = e.target.checked; render(); });
  $('#starOnly').addEventListener('change', e => { state.starOnly = e.target.checked; render(); });

  // ---- 启动 ----
  // 在词语数据中找某字的拼音（?pop= 直链弹层用）
  function findPinyin(ch) {
    for (const b of state.books) {
      for (const sec of b.sections) {
        for (const l of sec.lessons) {
          for (const w of l.words) {
            const i = w.w.indexOf(ch);
            if (i < 0) continue;
            return charPinyin(w.w, w.p, i);
          }
        }
      }
    }
    return '';
  }

  fetch('data/words.json')
    .then(r => r.json())
    .then(data => {
      state.books = data.books;
      // URL 参数直链：?std=2011&book=s2011-4b&mode=recite（可收藏背诵模式）
      const params = new URLSearchParams(location.search);
      const std = params.get('std');
      if (std && booksOf(std).length) state.standard = std;
      const bookParam = params.get('book');
      if (bookParam && state.books.some(b => b.id === bookParam)) state.bookId = bookParam;
      else state.bookId = booksOf(state.standard)[0] ? booksOf(state.standard)[0].id : '';
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.toggle('active', x.dataset.cat === state.standard));
      if (params.get('mode') === 'recite') {
        state.mode = 'recite';
        document.body.classList.add('recite');
        document.querySelectorAll('.mode-btn').forEach(x => {
          const on = x.dataset.mode === 'recite';
          x.classList.toggle('active', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }
      $('#totalCount').textContent = state.books.length;
      $('#totalWords').textContent = state.books.reduce((s, b) => s + bookWords(b), 0);
      renderChips();
      render();
      // ?pop=字 直链：加载后直接弹出该字笔顺动画（可分享单字笔顺）
      const popChar = params.get('pop');
      if (popChar) {
        const ch = Array.from(popChar)[0];
        openStroke(ch, findPinyin(ch));
      }
    })
    .catch(err => {
      listEl.innerHTML = '<div class="empty" data-u32-name="load-error">数据加载失败：' + esc(err.message) + '<br>请通过本地服务器访问（不要直接双击打开）。</div>';
    });

  // ---- PWA Service Worker 注册（不支持/非安全上下文时静默跳过） ----
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {/* SW 不可用不影响使用 */});
    });
  }
})();
