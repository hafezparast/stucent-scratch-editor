/**
 * The StuCent embedding policy: what the editor allows while it runs inside
 * StuCent (src/stucent/index.jsx sets it). Outside StuCent `active` is false
 * and every check answers as upstream does, so the hooks this module adds to
 * shared components change nothing for other builds.
 */
import {useSyncExternalStore} from 'react';

/**
 * Built-in extensions that never call outside servers or hardware.
 * Everything else (translate, text-to-speech, video and face sensing, speech
 * to text, micro:bit, LEGO, Go Direct, ...) is refused, for children's privacy.
 */
const ALLOWED_EXTENSIONS = Object.freeze(['pen', 'music']);

const MODES = Object.freeze(['edit', 'exam', 'readonly']);

const EMPTY_LOCKS = Object.freeze({sprites: [], scripts: []});

let state = Object.freeze({
    active: false,
    mode: 'edit',
    libraries: false,
    locks: EMPTY_LOCKS
});
const listeners = new Set();

const getPolicy = () => state;

const subscribe = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/**
 * Change the policy; listeners (React components through useStucentPolicy) are told.
 * @param {object} patch fields to change
 * @returns {object} the new policy
 */
const setPolicy = patch => {
    const next = {...state, ...patch};
    if (!MODES.includes(next.mode)) throw new Error(`Unknown mode "${next.mode}"`);
    state = Object.freeze(next);
    listeners.forEach(l => l());
    return state;
};

/** @returns {object} the policy, re-rendering the calling component when it changes. */
const useStucentPolicy = () => useSyncExternalStore(subscribe, getPolicy, getPolicy);

const uploadsAllowed = (policy = state) => !policy.active || policy.mode === 'edit';
const librariesAllowed = (policy = state) => !policy.active || policy.libraries;
const isExtensionAllowed = (id, policy = state) => !policy.active || ALLOWED_EXTENSIONS.includes(id);
const isSpriteLocked = (name, policy = state) => policy.active && policy.locks.sprites.includes(name);
const hasLocks = (policy = state) => policy.locks.sprites.length > 0 || policy.locks.scripts.length > 0;
/**
 * May the player replace the whole project (File > New, File > Load)? Never in an exam or over locked items.
 * @param policy
 */
const projectReplaceAllowed = (policy = state) => !policy.active || (policy.mode === 'edit' && !hasLocks(policy));
/**
 * May the player save the project to their computer? Not in an exam (the sandbox has no downloads there)
 * or a readonly view.
 * @param policy
 */
const downloadAllowed = (policy = state) => !policy.active || policy.mode === 'edit';
/**
 * Is anything left in the File menu (New, Load, Save to your computer)?
 * @param policy
 */
const fileMenuAllowed = (policy = state) => projectReplaceAllowed(policy) || downloadAllowed(policy);

/**
 * Is a button of this kind (`stucentKind` on an action menu button) allowed?
 * @param {string|undefined} kind library | surprise | upload | paint | record
 * @param {object} policy the policy
 * @returns {boolean} allowed
 */
const buttonAllowed = (kind, policy = state) => {
    if (kind === 'library' || kind === 'surprise') return librariesAllowed(policy);
    if (kind === 'upload') return uploadsAllowed(policy);
    return true;
};

/**
 * An action menu (add sprite / costume / sound / backdrop) with the buttons the
 * policy refuses removed. When the main button does what a removed button does
 * (open the library), the paint button (or the first one left) becomes the main
 * button. Null when nothing is left.
 * @param {object} menu {img, title, onClick, moreButtons}
 * @param {object} policy the policy
 * @returns {object|null} the menu to show
 */
const filterActionMenu = (menu, policy = state) => {
    if (!policy.active) return menu;
    const moreButtons = menu.moreButtons || [];
    const kept = moreButtons.filter(b => buttonAllowed(b.stucentKind, policy));
    const removed = moreButtons.filter(b => !kept.includes(b));
    const mainRemoved = removed.some(b => b.onClick === menu.onClick) ||
        !buttonAllowed(menu.stucentKind, policy);
    if (!mainRemoved) return {...menu, moreButtons: kept};
    const main = kept.find(b => b.stucentKind === 'paint') || kept[0];
    if (!main) return null;
    return {...menu, img: main.img, title: main.title, onClick: main.onClick, moreButtons: kept};
};

export {
    ALLOWED_EXTENSIONS,
    EMPTY_LOCKS,
    MODES,
    buttonAllowed,
    downloadAllowed,
    fileMenuAllowed,
    filterActionMenu,
    getPolicy,
    hasLocks,
    isExtensionAllowed,
    isSpriteLocked,
    librariesAllowed,
    projectReplaceAllowed,
    setPolicy,
    subscribe,
    uploadsAllowed,
    useStucentPolicy
};
