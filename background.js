// Service worker: performs translation requests (avoids page CORS/CSP limits)
// and provides the right-click "Traduire" menu entry.

const MAX_CHARS = 5000;

async function translate(text, target, source = 'auto') {
  const url = 'https://translate.googleapis.com/translate_a/single'
    + `?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t`
    + `&q=${encodeURIComponent(text.slice(0, MAX_CHARS))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Le service de traduction a répondu ${res.status}`);
  const data = await res.json();
  const translated = (data[0] || []).map((segment) => segment[0]).join('');
  return { ok: true, text: translated, detected: data[2] || source };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'translate') return false;
  translate(msg.text, msg.target, msg.source)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // keep the channel open for the async response
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'qt-translate',
    title: 'Traduire « %s »',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'qt-translate' || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'translate-selection', text: info.selectionText }, { frameId: info.frameId })
    .catch(() => {}); // page without the content script (e.g. chrome:// pages)
});
