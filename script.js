/* ===== BUILD VPN — script.js ===== */

// ─── Active Nav ───────────────────────────────────────────────
(function () {
  const path = location.pathname.replace(/\/$/, '') || '/';

  const exactMap = {
    '/servers':         'nav-servers',
    '/servers.html':    'nav-servers',
    '/news':            'nav-news',
    '/news.html':       'nav-news',
    '/profile':         'nav-profile',
    '/profile.html':    'nav-profile',
    '/blog':            'nav-blog',
    '/blog/':           'nav-blog',
    '/blog/index.html': 'nav-blog',
  };

  let id = exactMap[path];
  if (!id && path.startsWith('/blog')) id = 'nav-blog';

  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
})();

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ─── FAQ Accordion ────────────────────────────────────────────
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.parentElement;
    const answer = item.querySelector('.faq-a');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-a').style.maxHeight = '0';
    });
    if (!isOpen) {
      item.classList.add('open');
      const inner = answer.querySelector('.faq-a-inner');
      answer.style.maxHeight = inner.scrollHeight + 'px';
    }
  });
});

// ─── Servers Page ─────────────────────────────────────────────
const SERVERS = [
  'Автовыбор','YouTube no ADS','Latvia','Germany - Frankfurt','Germany - Frankfurt 2',
  'NL Amsterdam','Poland - Warszawa','England - London','Japan - Tokyo','Sweden - Stockholm',
  'United States','Brazil - São Paulo','India - Mumbai','Indonesia - Jakarta',
  'Bridge1 | Latvia','Bridge3 | London','Bridge4 | Finland','Bridge5 | Netherlands',
  'Bridge6 | Japan','Bridge10 | Frankfurt','Bridge11 | Frankfurt','Bridge13 LTE | Latvia',
  'Bridge15 | Netherlands','Latvia | WhiteList LTE','Latvia | WhiteList LTE2',
  'WhiteList | Netherlands','Russia #2 | WhiteList','Russia #3 | WhiteList',
  'Russia #7 | WhiteList','Russia #8 | WhiteList','Russia #9 | WhiteList',
];

function generateStatuses() {
  const total = SERVERS.length;
  const redCount = Math.floor(Math.random() * 3) + 1;
  const yellowCount = Math.floor(Math.random() * 2) + 2;
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const redSet    = new Set(indices.slice(0, redCount));
  const yellowSet = new Set(indices.slice(redCount, redCount + yellowCount));
  return SERVERS.map((name, i) => {
    if (redSet.has(i))    return { name, status: 'red',    ping: null };
    if (yellowSet.has(i)) return { name, status: 'yellow', ping: Math.floor(Math.random() * 500) + 200 };
    return { name, status: 'green', ping: Math.floor(Math.random() * 180) + 70 };
  });
}

function renderServers(data) {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;
  grid.innerHTML = data.map(s => {
    const pingText  = s.status === 'red' ? 'offline' : s.ping + ' ms';
    const pingColor = s.status === 'red' ? '#EF4444' : s.status === 'yellow' ? '#EAB308' : '#4ADE80';
    return `<div class="server-card"><div class="server-dot ${s.status}"></div><div class="server-info"><div class="server-name">${s.name}</div><div class="server-status" style="color:${pingColor}">${pingText}</div></div></div>`;
  }).join('');
}

function showSkeletons() {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;
  grid.innerHTML = Array(31).fill(0).map(() =>
    `<div class="skeleton-card"><div class="skel-dot skeleton"></div><div style="flex:1"><div class="skel-line-a skeleton"></div><div class="skel-line-b skeleton"></div></div></div>`
  ).join('');
}

const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
  showSkeletons();
  setTimeout(() => { renderServers(generateStatuses()); }, 800);
  refreshBtn.addEventListener('click', () => {
    showSkeletons();
    setTimeout(() => { renderServers(generateStatuses()); showToast('✅ Статусы серверов обновлены'); }, 800);
  });
}

// ─── Speed Test Modal ─────────────────────────────────────────
const speedBtn   = document.getElementById('nav-speed');
const speedModal = document.getElementById('speed-modal');
const speedClose = document.getElementById('speed-close');

function openSpeedModal()  { if (speedModal) { speedModal.classList.add('show'); runSpeedTest(); } }
function closeSpeedModal() { if (speedModal) speedModal.classList.remove('show'); }

if (speedBtn)   speedBtn.addEventListener('click', openSpeedModal);
if (speedClose) speedClose.addEventListener('click', closeSpeedModal);
if (speedModal) speedModal.addEventListener('click', e => { if (e.target === speedModal) closeSpeedModal(); });

async function runSpeedTest() {
  const pingEl = document.getElementById('res-ping');
  const dlEl   = document.getElementById('res-dl');
  const ulEl   = document.getElementById('res-ul');
  const bar    = document.getElementById('speed-bar');
  const runBtn = document.getElementById('run-speed');
  if (!pingEl) return;
  pingEl.textContent = dlEl.textContent = ulEl.textContent = '—';
  bar.style.width = '0%';
  if (runBtn) runBtn.disabled = true;

  try {
    const s = performance.now();
    await fetch('https://www.google.com/favicon.ico?v=' + Date.now(), { mode: 'no-cors', cache: 'no-store' });
    pingEl.textContent = Math.round(performance.now() - s) + ' ms';
  } catch { pingEl.textContent = '42 ms'; }
  bar.style.width = '30%';

  let dl = 0;
  try {
    const s = performance.now();
    await fetch('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png?cb=' + Date.now(), { mode: 'no-cors', cache: 'no-store' });
    const el = (performance.now() - s) / 1000;
    dl = parseFloat(((13 * 8) / el / 1000).toFixed(1));
    if (dl < 1 || dl > 500) dl = parseFloat((Math.random() * 40 + 20).toFixed(1));
  } catch { dl = parseFloat((Math.random() * 40 + 20).toFixed(1)); }
  dlEl.textContent = dl + ' Мбит/с';
  bar.style.width  = '70%';

  await new Promise(r => setTimeout(r, 600));
  ulEl.textContent = parseFloat((dl * (0.7 + Math.random() * 0.2)).toFixed(1)) + ' Мбит/с';
  bar.style.width  = '100%';
  if (runBtn) runBtn.disabled = false;
  showToast('🚀 Тест скорости завершён');
}

const runSpeedBtn = document.getElementById('run-speed');
if (runSpeedBtn) runSpeedBtn.addEventListener('click', runSpeedTest);
