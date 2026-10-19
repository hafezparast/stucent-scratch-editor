/**
 * The stage size the host asks for (`setStageSize`, PROTOCOL.md): a small stage
 * (240 x 180, half of the standard one) lets the editor lay out in about 640 px
 * instead of 1024 px, so a tablet or a narrow question column gets a real
 * layout instead of a shrunk copy of the wide one (#10965).
 */
import {STAGE_SIZE_MODES} from '../lib/layout-constants';
import {setStageSize} from '../reducers/stage-size';

/** The sizes the host may ask for. */
const STAGE_SIZES = Object.freeze(['normal', 'small']);

/** Set on the page's root element while the stage is small: stucent.raw.css narrows the editor's minimum width. */
const SMALL_STAGE_CLASS = 'stucent-small-stage';

/**
 * Make the stage `size` and narrow (or widen) the editor's layout to match.
 * @param {{dispatch: function(object): void}} store the redux store
 * @param {Element} root the page's root element (document.documentElement)
 * @param {string} size 'normal' | 'small'
 */
const applyStageSize = (store, root, size) => {
    if (!STAGE_SIZES.includes(size)) throw new Error(`Unknown stage size "${size}"`);
    const small = size === 'small';
    store.dispatch(setStageSize(small ? STAGE_SIZE_MODES.small : STAGE_SIZE_MODES.large));
    root.classList.toggle(SMALL_STAGE_CLASS, small);
};

export {SMALL_STAGE_CLASS, STAGE_SIZES, applyStageSize};
