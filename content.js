// Shows a translation bubble next to the text the user highlights.
// The UI lives in a Shadow DOM so the page's CSS cannot break it.

(() => {
  if (window.__qtLoaded) return;
  window.__qtLoaded = true;

  const LANGS = globalThis.QT_LANGUAGES;
  let settings = { ...globalThis.QT_DEFAULTS };
  chrome.storage.sync.get(settings, (s) => { settings = s; });
  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    if (!settings.enabled) hide();
  });

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .icon {
      width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
      background: #2563eb; color: #fff; font-size: 14px; font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center;
    }
    .icon:hover { background: #1d4ed8; }
    .card {
      width: 340px; max-width: calc(100vw - 16px); background: #fff; color: #1f2937;
      border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.25); border: 1px solid #e5e7eb;
      font-size: 14px; line-height: 1.45; overflow: hidden; animation: pop .12s ease-out;
    }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .head {
      display: flex; align-items: center; gap: 6px; padding: 8px 10px;
      background: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;
    }
    .head select {
      font-size: 12px; padding: 2px 4px; border: 1px solid #d1d5db; border-radius: 5px;
      background: #fff; color: #111827; cursor: pointer;
    }
    .head .spacer { flex: 1; }
    .btn {
      border: none; background: transparent; cursor: pointer; color: #6b7280;
      font-size: 15px; padding: 2px 6px; border-radius: 5px;
    }
    .btn:hover { background: #e5e7eb; color: #111827; }
    .result { padding: 10px 12px; font-size: 15px; color: #111827; max-height: 260px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; }
    .result.loading { color: #9ca3af; font-style: italic; }
    .result.error { color: #b91c1c; font-size: 13px; }
    .source {
      padding: 6px 12px 9px; font-size: 12px; color: #6b7280; border-top: 1px dashed #e5e7eb;
      max-height: 70px; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap;
    }
    @media (prefers-color-scheme: dark) {
      .card { background: #1f2937; color: #e5e7eb; border-color: #374151; }
      .head { background: #111827; border-color: #374151; color: #9ca3af; }
      .head select { background: #1f2937; color: #e5e7eb; border-color: #4b5563; }
      .btn:hover { background: #374151; color: #f9fafb; }
      .result { color: #f9fafb; }
      .source { border-color: #374151; color: #9ca3af; }
    }
  `;

  let host = null;
  let shadow = null;
  let requestId = 0;
  let current = null; // { text, rect }

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;';
    shadow = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);
  }

  function hide() {
    requestId++;
    current = null;
    if (host) host.remove();
    host = null;
  }

  // Place the host below the selection (or above if there is no room), inside the viewport.
  function position(rect) {
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const margin = 8;
    let left = rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    let top = rect.bottom + margin;
    if (top + h > window.innerHeight - margin && rect.top - h - margin > margin) top = rect.top - h - margin;
    host.style.left = `${left + window.scrollX}px`;
    host.style.top = `${top + window.scrollY}px`;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of children) node.append(c);
    return node;
  }

  function showIcon(text, rect) {
    ensureHost();
    current = { text, rect };
    const btn = el('button', { className: 'icon', title: 'Traduire', textContent: '文A' });
    btn.addEventListener('click', () => showCard(text, rect));
    shadow.replaceChildren(el('style', { textContent: STYLE }), btn);
    position({ left: rect.right - 15, right: rect.right, top: rect.top, bottom: rect.bottom });
  }

  function showCard(text, rect, target = settings.targetLang) {
    ensureHost();
    current = { text, rect };
    const id = ++requestId;

    const detected = el('span', { textContent: 'Détection…' });
    const select = el('select', { title: 'Langue cible' },
      Object.entries(LANGS).map(([code, name]) => el('option', { value: code, textContent: name })));
    select.value = target;
    select.addEventListener('change', () => showCard(text, rect, select.value));

    const result = el('div', { className: 'result loading', textContent: 'Traduction…' });
    const copyBtn = el('button', { className: 'btn', title: 'Copier la traduction', textContent: '⧉' });
    const speakBtn = el('button', { className: 'btn', title: 'Écouter', textContent: '🔊' });
    const closeBtn = el('button', { className: 'btn', title: 'Fermer (Échap)', textContent: '✕' });
    closeBtn.addEventListener('click', hide);

    const head = el('div', { className: 'head' }, [detected, el('span', { textContent: '→' }), select,
      el('span', { className: 'spacer' }), speakBtn, copyBtn, closeBtn]);
    const source = el('div', { className: 'source', textContent: text.length > 300 ? `${text.slice(0, 300)}…` : text });
    const card = el('div', { className: 'card' }, [head, result, source]);
    shadow.replaceChildren(el('style', { textContent: STYLE }), card);
    position(rect);

    let translation = '';
    copyBtn.addEventListener('click', async () => {
      if (!translation) return;
      try {
        await navigator.clipboard.writeText(translation);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⧉'; }, 1200);
      } catch { /* clipboard blocked by the page */ }
    });
    speakBtn.addEventListener('click', () => {
      if (!translation) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(translation);
      u.lang = select.value;
      speechSynthesis.speak(u);
    });

    const done = (fn) => { if (id === requestId && host) { fn(); position(rect); } };
    try {
      chrome.runtime.sendMessage({ type: 'translate', text, target }, (res) => {
        const err = chrome.runtime.lastError?.message || (!res?.ok && (res?.error || 'Erreur inconnue'));
        done(() => {
          if (err) {
            result.className = 'result error';
            result.textContent = `Traduction impossible : ${err}`;
            detected.textContent = '?';
            return;
          }
          translation = res.text;
          result.className = 'result';
          result.textContent = res.text;
          detected.textContent = LANGS[res.detected] || res.detected;
        });
      });
    } catch {
      // Extension was reloaded/updated: this old content script can no longer talk to it.
      result.className = 'result error';
      result.textContent = "L'extension a été mise à jour : rechargez la page (F5).";
    }
  }

  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text || !/\p{L}/u.test(text)) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return { text, rect };
  }

  document.addEventListener('mouseup', (e) => {
    if (!settings.enabled || e.button !== 0) return;
    if (host && e.composedPath().includes(host)) return;
    // Wait for the browser to finalise the selection.
    setTimeout(() => {
      const info = selectionInfo();
      if (!info) return;
      if (current && current.text === info.text) return;
      if (settings.mode === 'icon') showIcon(info.text, info.rect);
      else showCard(info.text, info.rect);
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (host && !e.composedPath().includes(host)) hide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && host) hide();
  });

  // Right-click menu "Traduire « … »" (works even when the extension is disabled).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'translate-selection') return;
    const info = selectionInfo();
    const rect = info?.rect || { left: window.innerWidth / 2 - 170, right: 0, top: 80, bottom: 80 };
    showCard(info?.text || msg.text, rect);
  });
})();
