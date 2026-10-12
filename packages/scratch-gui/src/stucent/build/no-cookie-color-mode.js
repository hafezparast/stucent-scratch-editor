// The StuCent editor keeps no cookies (and, sandboxed, cannot read them): the
// colour mode is the host's (`colorMode=dark` in the URL, for a dark StuCent
// page), else follows the system's contrast preference, and is not remembered.
// This module stands in for lib/settings/color-mode/persistence.js, so it imports
// nothing relative: the values are lib/settings/color-mode's (and params.js's COLOR_MODES).
const DEFAULT_MODE = 'default';
const DARK_MODE = 'dark';
const HIGH_CONTRAST_MODE = 'high-contrast';

const detectColorMode = () => {
    if (window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches) return HIGH_CONTRAST_MODE;
    if (new URLSearchParams(window.location.search).get('colorMode') === DARK_MODE) return DARK_MODE;
    return DEFAULT_MODE;
};
const persistColorMode = () => {};

export {
    detectColorMode,
    persistColorMode
};
