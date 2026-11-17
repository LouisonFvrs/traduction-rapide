// Settings popup: saves changes immediately to chrome.storage.sync.

const enabled = document.getElementById('enabled');
const targetLang = document.getElementById('targetLang');
const modes = document.querySelectorAll('input[name="mode"]');

for (const [code, name] of Object.entries(QT_LANGUAGES)) {
  targetLang.add(new Option(name, code));
}

chrome.storage.sync.get(QT_DEFAULTS, (s) => {
  enabled.checked = s.enabled;
  targetLang.value = s.targetLang;
  for (const r of modes) r.checked = r.value === s.mode;
});

enabled.addEventListener('change', () => chrome.storage.sync.set({ enabled: enabled.checked }));
targetLang.addEventListener('change', () => chrome.storage.sync.set({ targetLang: targetLang.value }));
for (const r of modes) r.addEventListener('change', () => chrome.storage.sync.set({ mode: r.value }));
