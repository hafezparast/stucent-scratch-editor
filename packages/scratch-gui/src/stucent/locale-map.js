// CommonJS: webpack.config.js reads it too, to keep only these locales' messages in the build.
/**
 * StuCent's locales mapped to the nearest scratch-l10n locale. Malay has no
 * scratch-l10n translation; Indonesian is the closest language. A locale not
 * listed here (or not translated) falls back to English.
 */
module.exports = Object.freeze({
    en: 'en',
    ar: 'ar',
    de: 'de',
    es: 'es',
    fa: 'fa',
    fr: 'fr',
    id: 'id',
    ja: 'ja',
    ko: 'ko',
    ms: 'id',
    pt: 'pt-br',
    ru: 'ru',
    sw: 'sw',
    ta: 'en',
    tr: 'tr',
    vi: 'vi',
    zh: 'zh-cn'
});
