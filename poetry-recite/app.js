/* 诗词背诵 — 阅读/背诵 单页应用（原生 JS，无依赖） */
(function () {
  'use strict';

  // 版本标识：随每次发布手动更新（与 sw.js VERSION 保持同步），用于控制台核对缓存新旧
  console.log('[诗词背诵] 版本 v1.0.8 · 最后修订 2026-09-05 18:39');

  const state = {
    poems: [],
    cat: 'primary',
    mode: 'read',
    grade: '',
    q: '',
    mustOnly: false,
    memOnly: false,
  };
  const DONE_KEY = 'poetry-recite-done';
  let doneSet = new Set();
  try { doneSet = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch {}

  const GRADE_ORDER = {
    primary: ['一年级上册','一年级下册','二年级上册','二年级下册','三年级上册','三年级下册',
              '四年级上册','四年级下册','五年级上册','五年级下册','六年级上册','六年级下册','课外'],
    junior: ['七年级上册','七年级下册','八年级上','八年级下册','九年级上','九年级下'],
    extra: [],
  };

  const $ = s => document.querySelector(s);
  const listEl = $('#poemList');
  const gradeChipsEl = $('#gradeChips');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function saveDone() {
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneSet])); } catch {}
  }

  function currentPoems() {
    const q = state.q.trim().toLowerCase();
    return state.poems.filter(p => {
      if (p.cat !== state.cat) return false;
      if (state.grade && p.grade !== state.grade) return false;
      if (state.mustOnly && !(p.must && p.must.includes('必背'))) return false;
      if (state.memOnly && doneSet.has(p.id)) return false;
      if (q) {
        const hay = [p.title, p.dynasty, p.author, (p.lines || []).join('')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderChips() {
    const grades = GRADE_ORDER[state.cat] || [];
    gradeChipsEl.style.display = grades.length ? 'flex' : 'none';
    gradeChipsEl.innerHTML = '';
    if (!grades.length) { state.grade = ''; return; }
    const mk = (label, val) => {
      const b = document.createElement('button');
      b.className = 'chip' + (state.grade === val ? ' active' : '');
      b.textContent = label;
      b.setAttribute('data-u32-name', 'grade-chip-' + (val || 'all'));
      b.onclick = () => { state.grade = val; renderChips(); render(); };
      return b;
    };
    gradeChipsEl.appendChild(mk('全部', ''));
    grades.forEach(g => gradeChipsEl.appendChild(mk(g, g)));
  }

  function mustBadge(p) {
    if (!p.must) return '';
    if (p.must.includes('必背')) return '<span class="badge badge-must" data-u32-name="badge-must">必背</span>';
    if (p.must.includes('书上没有')) return '<span class="badge badge-read" data-u32-name="badge-nobook">书上没有</span>';
    return '<span class="badge badge-none" data-u32-name="badge-other">' + esc(p.must) + '</span>';
  }

  function cardHtml(p) {
    const done = doneSet.has(p.id);
    const meta = [p.dynasty, p.author].filter(Boolean).map(esc).join(' · ');
    // 按标点拆成逐句小块；每个汉字包独立元素 .cz 并内联该字拼音，
    // 点击直接命中元素本身（无命中歧义），悬停由 CSS 高亮
    const HANZI = /[\u4e00-\u9fff]/;
    const clauses = (text, py) => {
      const parts = String(text).match(/[^，。、；：！？!?\.\s…]+[，。、；：！？!?…]*/g) || [text];
      const tab = state.mode === 'recite' ? ' tabindex="0"' : '';
      return parts.map((c, ci) => {
        const tokens = (py && py[ci] ? py[ci] : '').split(' ').filter(Boolean);
        let html = '', ti = 0;
        for (const ch of c) {
          if (HANZI.test(ch) && tokens[ti]) {
            const py1 = tokens[ti++].replace(/（[^）]*）/g, '').replace(/[，。、；：！？!?…]/g, '');
            html += '<i class="cz" data-p="' + esc(py1) + '">' + esc(ch) + '</i>';
          } else {
            if (HANZI.test(ch)) ti++;   // 缺拼音的汉字消耗 token 保持对齐（理论不出现）
            html += esc(ch);
          }
        }
        return '<span class="poem-clause"' + tab + ' data-u32-name="poem-clause"><span class="clause-text" data-u32-name="clause-text">' + html + '</span></span>';
      }).join('');
    };
    const lines = (p.lines && p.lines.length)
      ? p.lines.map((l, li) => '<span class="poem-line" data-u32-name="poem-line">' + clauses(l, p.pinyin && p.pinyin[li]) + '</span>').join('')
      : '<span class="poem-line" data-u32-name="poem-line"><span class="poem-clause" data-u32-name="poem-clause"><span class="clause-text" data-u32-name="clause-text">（原文缺失）</span></span></span>';

    let extra = '';
    if (p.note) extra += '<div class="poem-note" data-u32-name="poem-note">📌 ' + esc(p.note) + '</div>';
    const aux = [];
    if (p.method) aux.push('<div class="hide-in-recite" data-u32-name="poem-method"><span class="label">速记法：</span>' + esc(p.method) + '</div>');
    if (p.story) aux.push('<div class="poem-story hide-in-recite" data-u32-name="poem-story"><span class="label">记忆故事：</span>' + esc(p.story) + '</div>');
    if (p.images && p.images.length) {
      const imgs = p.images.map((im, i) =>
        '<figure data-u32-name="poem-img-wrap"><img loading="lazy" src="images/' + im + '" alt="' + esc(p.title) + '速记配图' + (i + 1) + '" data-full="images/' + im + '" data-u32-name="poem-img"><figcaption>速记配图 ' + (i + 1) + '</figcaption></figure>'
      ).join('');
      aux.push('<div class="poem-imgs" data-u32-name="poem-imgs">' + imgs + '</div>');
    }
    if (aux.length) extra += '<div class="poem-extra" data-u32-name="poem-extra">' + aux.join('') + '</div>';

    const hasHint = (p.images && p.images.length) || p.story || p.method;
    const hintBtn = hasHint
      ? '<button class="hint-toggle" data-act="hint" data-u32-name="hint-toggle">💡 提示</button>' : '';

    return '' +
    '<article class="poem-card' + (done ? ' is-done' : '') + '" data-id="' + p.id + '" data-u32-name="poem-card">' +
      '<div class="poem-head" data-u32-name="poem-head">' +
        '<div data-u32-name="poem-titles">' +
          '<h3 class="poem-title" data-u32-name="poem-title">' + esc(p.title) + mustBadge(p) + '</h3>' +
          '<div class="poem-meta" data-u32-name="poem-meta">' + (meta || '&nbsp;') +
            (p.grade ? ' · ' + esc(p.grade) : '') + '</div>' +
        '</div>' +
        '<div class="poem-actions" data-u32-name="poem-actions">' +
          hintBtn +
          '<button class="icon-btn" data-act="copy" data-u32-name="copy-btn">复制</button>' +
          '<button class="icon-btn' + (done ? ' done' : '') + '" data-act="done" data-u32-name="done-btn">' +
            (done ? '✓ 已背' : '标记已背') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="poem-body" data-u32-name="poem-body">' + lines + '</div>' +
      extra +
    '</article>';
  }

  function render() {
    const poems = currentPoems();
    $('#countLabel').textContent = '显示 ' + poems.length + ' 首';
    if (!poems.length) {
      listEl.innerHTML = '<div class="empty" data-u32-name="empty">没有符合条件的诗词 🪶</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    poems.forEach(p => {
      const wrap = document.createElement('div');
      wrap.innerHTML = cardHtml(p);
      frag.appendChild(wrap.firstElementChild);
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  // ---- 交互（Pointer Events + Click，PC 鼠标 + 移动端触摸统一） ----
  // 背诵模式：按住偷看原文；阅读模式：点击某个字，弹出该字拼音气泡
  const peekTimers = new WeakMap();
  listEl.addEventListener('pointerdown', e => {
    if (state.mode !== 'recite') return;   // 阅读模式无按压交互（看拼音用 click）
    const line = e.target.closest('.poem-clause');
    if (!line) return;
    e.preventDefault();
    const t = setTimeout(() => line.classList.add('peek'), 90);
    peekTimers.set(line, t);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    listEl.addEventListener(evt, e => {
      const line = e.target.closest('.poem-clause');
      if (!line) return;
      clearTimeout(peekTimers.get(line));
      line.classList.remove('peek');
    }, true);
  });
  // 滚动时取消按住状态并收起气泡，避免误触残留
  listEl.addEventListener('scroll', clearPeek, { passive: true });
  document.addEventListener('touchmove', clearPeek, { passive: true });
  window.addEventListener('scroll', hideTip, { passive: true });
  // 键盘可达：背诵模式下焦点句块按住 Enter/Space 查看，松开恢复
  listEl.addEventListener('keydown', e => {
    if (state.mode !== 'recite') return;
    const clause = e.target.closest('.poem-clause');
    if (!clause || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    clause.classList.add('peek');
  });
  listEl.addEventListener('keyup', e => {
    const clause = e.target.closest('.poem-clause');
    if (!clause || (e.key !== 'Enter' && e.key !== ' ')) return;
    clause.classList.remove('peek');
  });
  // ---- 阅读模式：单字拼音气泡 ----
  const pinyinTip = document.createElement('div');
  pinyinTip.className = 'pinyin-tip';
  pinyinTip.setAttribute('data-u32-name', 'pinyin-tip');
  pinyinTip.hidden = true;
  document.body.appendChild(pinyinTip);
  let tipTarget = null;   // 当前气泡挂着的字元素，用于"再点同一字关闭"

  function hideTip() {
    tipTarget = null;
    pinyinTip.hidden = true;
  }

  function showTip(cz) {
    tipTarget = cz;
    pinyinTip.textContent = cz.dataset.p;
    pinyinTip.hidden = false;
    const rect = cz.getBoundingClientRect();
    const tw = pinyinTip.offsetWidth, th = pinyinTip.offsetHeight;
    const left = Math.max(6, Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 6));
    let top = rect.top - th - 6;
    if (top < 6) top = rect.bottom + 6;   // 视口顶部放不下则显示在字下方
    pinyinTip.style.left = left + 'px';
    pinyinTip.style.top = top + 'px';
  }

  // 点击生字弹拼音：点其他字切换、再点同一字关闭、点标点/句块空白关闭
  listEl.addEventListener('click', e => {
    if (state.mode !== 'read') return;
    const cz = e.target.closest('.cz');
    if (!cz) { hideTip(); return; }
    if (tipTarget === cz) { hideTip(); return; }
    showTip(cz);
  });
  // 点击列表以外任意位置（按钮/搜索框/页头等）关闭气泡
  document.addEventListener('click', e => {
    if (!(e.target.closest && e.target.closest('.poem-clause'))) hideTip();
  });

  function clearPeek() {
    listEl.querySelectorAll('.poem-clause.peek').forEach(l => {
      clearTimeout(peekTimers.get(l));
      l.classList.remove('peek');
    });
    hideTip();
  }
  // 禁用长按选中/菜单（触摸点按看拼音与背诵偷看都依赖手势）
  listEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.poem-clause')) e.preventDefault();
  });

  // ---- 卡片内按钮（事件委托） ----
  listEl.addEventListener('click', e => {
    const img = e.target.closest('.poem-imgs img');
    if (img) { openLightbox(img.dataset.full); return; }
    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    const card = actBtn.closest('.poem-card');
    const id = card.dataset.id;
    if (actBtn.dataset.act === 'done') {
      doneSet.has(id) ? doneSet.delete(id) : doneSet.add(id);
      saveDone(); render();
    } else if (actBtn.dataset.act === 'hint') {
      card.classList.toggle('show-hint');
      actBtn.textContent = card.classList.contains('show-hint') ? '🙈 收起提示' : '💡 提示';
    } else if (actBtn.dataset.act === 'copy') {
      const p = state.poems.find(x => x.id === id);
      if (p) copyPoem(p, actBtn);
    }
  });

  // ---- 复制诗词全文（标题 + 朝代作者 + 逐行原文） ----
  function poemPlainText(p) {
    const head = ['《' + (p.title || '') + '》', [p.dynasty, p.author].filter(Boolean).join('·')]
      .filter(Boolean).join(' ');
    return head + '\n\n' + (p.lines || []).join('\n');
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // 兜底：隐藏 textarea + execCommand（旧浏览器/非安全上下文）
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }
  function copyPoem(p, btn) {
    copyText(poemPlainText(p)).then(() => {
      btn.textContent = '✓ 已复制';
    }).catch(() => {
      btn.textContent = '✗ 复制失败';
    }).finally(() => {
      setTimeout(() => { btn.textContent = '复制'; }, 1200);
    });
  }

  // 「提示」按钮通过给卡片加 show-hint 类，由 CSS 展开配图/记忆法/故事（两种模式行为一致）

  // ---- 灯箱 ----
  const lightbox = $('#lightbox');
  function openLightbox(src) {
    $('#lightboxImg').src = src;
    lightbox.hidden = false;
  }
  function closeLightbox() { lightbox.hidden = true; $('#lightboxImg').src = ''; }
  $('#lightboxClose').onclick = closeLightbox;
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // ---- 全局控件 ----
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.onclick = () => {
      // 记录切换前视口中央的诗卡及其视口位置（用于切换后补偿滚动）
      const anchor = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.4);
      const anchorCard = anchor ? anchor.closest('.poem-card') : null;
      const anchorTop = anchorCard ? anchorCard.getBoundingClientRect().top : null;

      state.mode = b.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(x => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      document.body.classList.toggle('recite', state.mode === 'recite');
      // 模式切换只换 CSS class，不重新渲染，保留展开状态；清掉临时偷看与拼音气泡
      listEl.querySelectorAll('.poem-clause.peek').forEach(c => c.classList.remove('peek'));
      hideTip();
      // 仅背诵模式句块可 Tab 聚焦（键盘按住 Enter/Space 查看）
      listEl.querySelectorAll('.poem-clause').forEach(c => {
        if (state.mode === 'recite') c.setAttribute('tabindex', '0');
        else c.removeAttribute('tabindex');
      });

      // 布局变化（如提示条显隐）后，把锚点诗卡滚回原视口位置
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
      state.cat = b.dataset.cat;
      state.grade = '';
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.toggle('active', x === b));
      $('#mustOnly').parentElement.style.display = state.cat === 'primary' ? '' : 'none';
      if (state.cat !== 'primary') state.mustOnly = false, $('#mustOnly').checked = false;
      renderChips(); render();
    };
  });
  let searchTimer = null;
  $('#searchInput').addEventListener('input', e => {
    state.q = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 200);   // 逐字元素增加 DOM 量，防抖平滑搜索输入
  });
  $('#mustOnly').addEventListener('change', e => { state.mustOnly = e.target.checked; render(); });
  $('#memOnly').addEventListener('change', e => { state.memOnly = e.target.checked; render(); });

  // ---- 启动 ----
  fetch('data/poems.json')
    .then(r => r.json())
    .then(data => {
      state.poems = data;
      $('#totalCount').textContent = data.length;
      $('#mustOnly').parentElement.style.display = '';
      renderChips();
      render();
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
