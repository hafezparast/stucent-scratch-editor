/**
 * The page's URL parameters in StuCent: `host` (the parent page's origin; the
 * bridge is active only with it), `mode`, `locale` and `assetHost`.
 */
import {MODES} from './policy';
import LOCALE_MAP from './locale-map';

/** The block colour modes the host may ask for (`colorMode`): dark follows a dark host page. */
const COLOR_MODES = Object.freeze(['default', 'dark']);

/**
 * The scratch-l10n locale for a StuCent locale code.
 * @param {string|null} code StuCent locale (e.g. "zh", "pt-BR")
 * @param {string[]} supported the locales scratch-l10n has
 * @returns {string} a supported locale
 */
const mapLocale = (code, supported) => {
    if (!code) return 'en';
    const lower = String(code).toLowerCase();
    const mapped = LOCALE_MAP[lower] || LOCALE_MAP[lower.split('-')[0]] || lower;
    return supported.includes(mapped) ? mapped : 'en';
};

/**
 * An origin (scheme://host[:port]) or null when the value is not one.
 * @param {string|null} value raw parameter
 * @returns {string|null} the origin
 */
const parseOrigin = value => {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        // Only a bare origin is accepted: a path or query is a mistake, not a different origin.
        if (url.origin !== value.replace(/\/$/, '')) return null;
        return url.origin;
    } catch {
        return null;
    }
};

/**
 * An http(s) URL with its trailing slash removed, or null.
 * @param {string|null} value raw parameter
 * @returns {string|null} the URL
 */
const parseHttpUrl = value => {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return url.href.replace(/\/$/, '');
    } catch {
        return null;
    }
};

/**
 * The StuCent parameters of a page URL.
 * @param {string} search location.search
 * @param {string[]} supportedLocales scratch-l10n locales
 * @returns {{host: (string|null), mode: string, locale: string, assetHost: (string|null), colorMode: string}}
 *     parameters
 */
const parseParams = (search, supportedLocales) => {
    const q = new URLSearchParams(search);
    const mode = q.get('mode');
    return {
        host: parseOrigin(q.get('host')),
        mode: MODES.includes(mode) ? mode : 'edit',
        locale: mapLocale(q.get('locale'), supportedLocales),
        assetHost: parseHttpUrl(q.get('assetHost')),
        colorMode: COLOR_MODES.includes(q.get('colorMode')) ? q.get('colorMode') : 'default'
    };
};

export {COLOR_MODES, LOCALE_MAP, mapLocale, parseHttpUrl, parseOrigin, parseParams};
