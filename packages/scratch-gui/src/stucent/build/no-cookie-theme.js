// The StuCent editor keeps no cookies (and, sandboxed, cannot read them): the
// block theme is always the default one and is not remembered.
// This module stands in for lib/settings/theme/persistence.js, so it imports
// nothing relative: the value is lib/settings/theme's DEFAULT_THEME.
const DEFAULT_THEME = 'default';

const detectTheme = () => DEFAULT_THEME;
const persistTheme = () => {};

export {
    detectTheme,
    persistTheme
};
