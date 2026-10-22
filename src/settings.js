'use strict';

const api = window.gc;
const keysEl = document.getElementById('keys');
const themesEl = document.getElementById('themes');
const triggerBadge = document.getElementById('triggerBadge');
const triggerNote = document.getElementById('triggerNote');
const themeBadge = document.getElementById('themeBadge');
const autoLaunchEl = document.getElementById('autoLaunch');
const closeEl = document.getElementById('close');
const doneEl = document.getElementById('done');

const state = {
  enabled: true,
  autoLaunch: false,
  trigger: 'shift',
  theme: 'liquid',
};

const triggerOptions = api.triggerOptions || [{ key: 'shift', label: 'Shift', hint: 'Классика' }];
const themeOptions = api.themeOptions || [{ key: 'liquid', label: 'Liquid Glass', hint: 'Матовое стекло' }];

function triggerMeta(key) {
  return triggerOptions.find((item) => item.key === key) || triggerOptions[0];
}

function themeMeta(key) {
  return themeOptions.find((item) => item.key === key) || themeOptions[0];
}

function buildKeys() {
  keysEl.innerHTML = triggerOptions
    .map(
      (item) => `
        <button class="key-option" type="button" data-trigger="${item.key}">
          <span>${item.label}</span>
          <small>${item.hint || ''}</small>
        </button>`
    )
    .join('');

  keysEl.querySelectorAll('[data-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      apply({ trigger: button.dataset.trigger });
    });
  });
}

function buildThemes() {
  themesEl.innerHTML = themeOptions
    .map(
      (item) => `
        <button class="theme-card" type="button" data-theme="${item.key}">
          <span class="theme-preview p-${item.key}">
            <span class="p-lens"></span>
            <span class="p-core"></span>
            <span class="p-tile t1"></span>
            <span class="p-tile t2"></span>
            <span class="p-tile t3"></span>
          </span>
          <span class="theme-meta">
            <strong>${item.label}</strong>
            <small>${item.hint || ''}</small>
          </span>
          <span class="theme-check">✓</span>
        </button>`
    )
    .join('');

  themesEl.querySelectorAll('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      apply({ theme: button.dataset.theme });
    });
  });
}

function render() {
  const trigger = triggerMeta(state.trigger);
  const theme = themeMeta(state.theme);

  keysEl.querySelectorAll('[data-trigger]').forEach((button) => {
    const active = button.dataset.trigger === state.trigger;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  themesEl.querySelectorAll('[data-theme]').forEach((button) => {
    const active = button.dataset.theme === state.theme;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  triggerBadge.textContent = trigger.label;
  themeBadge.textContent = theme.label;
  triggerNote.innerHTML = `Меню откроется, когда вы зажмёте <strong>${trigger.label}</strong> и начнёте перетаскивать файл. Отпустите файл на нужном формате.`;
  autoLaunchEl.setAttribute('aria-checked', state.autoLaunch ? 'true' : 'false');
}

let applying = false;
let pendingPatch = null;

async function apply(patch) {
  Object.assign(state, patch);
  render();

  if (applying) {
    pendingPatch = { ...(pendingPatch || {}), ...patch };
    return;
  }

  applying = true;
  try {
    let saved = await api.updateSettings(patch);
    while (pendingPatch) {
      const next = pendingPatch;
      pendingPatch = null;
      if (saved && typeof saved === 'object') Object.assign(state, saved);
      render();
      saved = await api.updateSettings(next);
    }
    if (saved && typeof saved === 'object') Object.assign(state, saved);
    render();
  } catch (err) {
    console.error('Не удалось сохранить настройки:', err);
  } finally {
    applying = false;
  }
}

autoLaunchEl.addEventListener('click', () => {
  apply({ autoLaunch: !state.autoLaunch });
});

closeEl.addEventListener('click', () => api.closeSettings());
doneEl.addEventListener('click', () => api.closeSettings());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') api.closeSettings();
});

api.onSettingsChanged((payload) => {
  if (!payload || typeof payload !== 'object') return;
  Object.assign(state, payload);
  render();
});

buildKeys();
buildThemes();
render();

api.getSettings()
  .then((saved) => {
    if (saved && typeof saved === 'object') Object.assign(state, saved);
    render();
  })
  .catch((err) => console.error('Не удалось загрузить настройки:', err));
