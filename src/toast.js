'use strict';

const ICONS = {
  spin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-opacity=".28"/><path d="M20 12a8 8 0 0 0-8-8"/></svg>',
  done: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  error: '<svg viewBox="0 0 24 24"><path d="M12 7.5v6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/><path d="M10.3 4.4 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M12 3.6l1.7 4.7 4.7 1.7-4.7 1.7L12 16.4l-1.7-4.7L5.6 10l4.7-1.7z"/><path d="m18 16.2.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/></svg>',
};

const card = document.getElementById('card');
const stateEl = document.getElementById('state');
const titleEl = document.getElementById('title');
const badgeEl = document.getElementById('badge');
const subtitleEl = document.getElementById('subtitle');
const bar = document.getElementById('bar');
const fill = document.getElementById('fill');
const hint = document.getElementById('hint');
const closeBtn = document.getElementById('close');

let current = { status: 'info', path: null };
let hideTimer = null;

function render(payload) {
  current = payload || { status: 'info' };
  const status = payload.status || 'info';

  card.className = 'card';
  card.classList.add('show', status);

  stateEl.className = 'state';
  stateEl.innerHTML = ICONS[status === 'working' ? 'spin' : status] || ICONS.info;
  if (status === 'working') stateEl.classList.add('spin');

  titleEl.textContent = payload.title || 'Конвертация';
  titleEl.title = payload.title || '';
  subtitleEl.textContent = payload.subtitle || '';
  subtitleEl.title = payload.subtitle || '';

  badgeEl.style.display = '';

  if (status === 'working') {
    bar.classList.add('visible');
    const p = payload.progress;
    if (typeof p === 'number' && p > 0) {
      bar.classList.remove('indeterminate');
      fill.style.width = `${Math.max(3, Math.round(p * 100))}%`;
      badgeEl.textContent = `${Math.round(p * 100)}%`;
    } else {
      bar.classList.add('indeterminate');
      fill.style.width = '';
      badgeEl.textContent = 'FFMPEG';
    }
  } else if (status === 'done') {
    bar.classList.add('visible');
    bar.classList.remove('indeterminate');
    fill.style.width = '100%';
    badgeEl.textContent = 'ГОТОВО';
    hint.style.opacity = '1';
  } else if (status === 'error') {
    badgeEl.textContent = 'ОШИБКА';
    hint.style.opacity = '0';
  } else {
    badgeEl.style.display = 'none';
  }

  clearTimeout(hideTimer);
}

window.gc.onToastUpdate(render);

closeBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  window.gc.dismissToast();
});

card.addEventListener('click', () => {
  if (current.status === 'done' && current.path) {
    window.gc.openFolder(current.path);
  } else if (current.status === 'info') {
    window.gc.dismissToast();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.gc.dismissToast();
});

if (new URLSearchParams(location.search).has('preview')) {
  document.body.classList.add('is-preview');
}
