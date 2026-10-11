// The StuCent editor keeps no cookies (and, sandboxed, cannot read them): the
// colour mode follows the system's contrast preference and is not remembered.
// This module stands in for lib/settings/color-mode/persistence.js, so it imports
// nothing relative: the values are lib/settings/color-mode's.
const DEFAULT_MODE = 'default';
const HIGH_CONTRAST_MODE = 'high-contrast';

const detectColorMode = () => (
    window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches ? HIGH_CONTRAST_MODE : DEFAULT_MODE
);
const persistColorMode = () => {};

export {
    detectColorMode,
    persistColorMode
};
