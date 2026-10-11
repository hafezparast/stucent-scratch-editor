/**
 * Webpack loader for scratch-l10n's generated message files (`export default
 * {locale: {id: text}}`): keeps only English and the locales StuCent maps to
 * (src/stucent/locale-map.js). The full file holds every Scratch language.
 */
const vm = require('vm');
const LOCALE_MAP = require('../locale-map');

const KEEP = new Set(['en', ...Object.values(LOCALE_MAP)]);

module.exports = function (source) {
    const marker = 'export default';
    const at = source.indexOf(marker);
    if (at < 0) throw new Error('l10n-filter-loader: no default export');
    // The generated file is a plain object literal; build-time evaluation only.
    const body = source.slice(at + marker.length).trim()
        .replace(/;\s*$/, '');
    const messages = vm.runInNewContext(`(${body})`);
    const kept = {};
    Object.keys(messages).forEach(locale => {
        if (KEEP.has(locale)) kept[locale] = messages[locale];
    });
    return `export default ${JSON.stringify(kept)};\n`;
};
