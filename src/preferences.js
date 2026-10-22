'use strict';

/** Общие настройки приложения: клавиша активации и тема меню. */

const TRIGGER_OPTIONS = [
  { key: 'shift', label: 'Shift', keys: ['shift'], hint: 'Классика' },
  { key: 'ctrl', label: 'Ctrl', keys: ['ctrl'], hint: 'Для правой руки' },
  { key: 'alt', label: 'Alt', keys: ['alt'], hint: 'Рядом с пробелом' },
  { key: 'shift+ctrl', label: 'Shift + Ctrl', keys: ['shift', 'ctrl'], hint: 'Сочетание' },
  { key: 'shift+alt', label: 'Shift + Alt', keys: ['shift', 'alt'], hint: 'Сочетание' },
  { key: 'ctrl+alt', label: 'Ctrl + Alt', keys: ['ctrl', 'alt'], hint: 'Сочетание' },
];

const THEME_OPTIONS = [
  { key: 'liquid', label: 'Liquid Glass', hint: 'Матовое стекло и блики' },
  { key: 'modern', label: 'Модерн', hint: 'Чистый минимализм' },
  { key: 'futuristic', label: 'Футуризм', hint: 'Неон, HUD и сетка' },
  { key: 'kids', label: 'Детский', hint: 'Яркие краски и мягкие формы' },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  autoLaunch: false,
  trigger: 'shift',
  theme: 'liquid',
};

function triggerOption(key) {
  return TRIGGER_OPTIONS.find((item) => item.key === key) || TRIGGER_OPTIONS[0];
}

function triggerKeys(key) {
  return triggerOption(key).keys.slice();
}

function triggerLabel(key) {
  return triggerOption(key).label;
}

function themeOption(key) {
  return THEME_OPTIONS.find((item) => item.key === key) || THEME_OPTIONS[0];
}

function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const trigger = TRIGGER_OPTIONS.some((item) => item.key === src.trigger)
    ? src.trigger
    : DEFAULT_SETTINGS.trigger;
  const theme = THEME_OPTIONS.some((item) => item.key === src.theme)
    ? src.theme
    : DEFAULT_SETTINGS.theme;

  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
    autoLaunch: typeof src.autoLaunch === 'boolean' ? src.autoLaunch : DEFAULT_SETTINGS.autoLaunch,
    trigger,
    theme,
  };
}

module.exports = {
  TRIGGER_OPTIONS,
  THEME_OPTIONS,
  DEFAULT_SETTINGS,
  triggerOption,
  triggerKeys,
  triggerLabel,
  themeOption,
  normalizeSettings,
};
