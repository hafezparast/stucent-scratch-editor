/**
 * Locked sprites and scripts (the bridge's `setLocks`).
 *
 * A locked sprite cannot be deleted or renamed, and every script it has when
 * it is locked is locked. A locked script, and every block in it, cannot be
 * deleted, moved, edited or have blocks dropped into or pulled out of it.
 *
 * The VM is the source of truth, so the lock is enforced there: Blockly events
 * that would change a locked script never reach the VM, and the workspace is
 * then reloaded from the VM, which puts the script back. The Blockly flags
 * (not movable / deletable / editable) and the lock marks only make that
 * visible; they are not what keeps the script safe.
 */
import {EMPTY_LOCKS} from './policy';

const STAGE = 'Stage';

/**
 * The name a lock uses for a target: "Stage", or the sprite's name.
 * @param target
 */
const targetLockName = target => (target.isStage ? STAGE : target.sprite.name);

/** Blockly events that change blocks, by what they touch. */
const BLOCK_EVENTS = Object.freeze(['create', 'delete', 'move', 'change', 'block_field_intermediate_change']);

/**
 * Normalise a `Locks` value from the host.
 * @param {*} raw host value
 * @returns {{sprites: string[], scripts: Array<{sprite: string, topId: string}>}} locks
 */
const normalizeLocks = raw => {
    if (!raw || typeof raw !== 'object') return EMPTY_LOCKS;
    const sprites = Array.isArray(raw.sprites) ? raw.sprites.filter(s => typeof s === 'string') : [];
    const scripts = Array.isArray(raw.scripts) ?
        raw.scripts.filter(s => s && typeof s.sprite === 'string' && typeof s.topId === 'string')
            .map(s => ({sprite: s.sprite, topId: s.topId})) :
        [];
    return {sprites, scripts};
};

class LockState {
    constructor () {
        this.locks = EMPTY_LOCKS;
        /** @type {Map<string, Set<string>>} target lock name → locked top block ids */
        this.scripts = new Map();
    }

    /**
     * Lock what `locks` names. A locked sprite's scripts are those it has now.
     * @param {object} locks normalised locks
     * @param {object} runtime the VM runtime
     */
    set (locks, runtime) {
        this.locks = locks;
        this.scripts = new Map();
        const add = (name, topId) => {
            if (!this.scripts.has(name)) this.scripts.set(name, new Set());
            this.scripts.get(name).add(topId);
        };
        locks.scripts.forEach(s => add(s.sprite, s.topId));
        locks.sprites.forEach(name => {
            const target = name === STAGE ? runtime.getTargetForStage() : runtime.getSpriteTargetByName(name);
            if (!target) return;
            target.blocks.getScripts().forEach(topId => add(name, topId));
        });
    }

    isSpriteLocked (name) {
        return this.locks.sprites.includes(name);
    }

    isScriptLocked (target, topId) {
        const set = this.scripts.get(targetLockName(target));
        return !!set && set.has(topId);
    }

    /**
     * Is this block in a locked script of the target?
     * @param {object} target VM target
     * @param {string} blockId block id
     * @returns {boolean} locked
     */
    isBlockLocked (target, blockId) {
        if (!target || typeof blockId !== 'string' || this.scripts.size === 0) return false;
        if (!target.blocks.getBlock(blockId)) return false;
        return this.isScriptLocked(target, target.blocks.getTopLevelScript(blockId));
    }

    /**
     * Would this Blockly event change a locked script of the editing target?
     * @param {object} e Blockly event (JSON-like: type, blockId, newParentId)
     * @param {object} target the editing target
     * @returns {boolean} it must be refused
     */
    refuses (e, target) {
        if (!e || !BLOCK_EVENTS.includes(e.type) || !target) return false;
        if (this.isBlockLocked(target, e.blockId)) return true;
        return e.type === 'move' && typeof e.newParentId === 'string' && this.isBlockLocked(target, e.newParentId);
    }
}

/**
 * Show the locks in a Blockly workspace: locked blocks cannot be dragged,
 * deleted or edited, and each locked script is dimmed with a lock mark.
 * @param {object} workspace Blockly workspace
 * @param {object} target the editing target
 * @param {LockState} lockState locks
 */
const markWorkspace = (workspace, target, lockState) => {
    if (!workspace || !target) return;
    workspace.getAllBlocks(false).forEach(block => {
        const root = block.getRootBlock();
        const locked = lockState.isScriptLocked(target, root.id);
        if (!locked) return;
        block.setMovable(false);
        block.setDeletable(false);
        block.setEditable(false);
        const svg = block.getSvgRoot && block.getSvgRoot();
        if (!svg) return;
        svg.classList.add('stucent-locked');
        if (block === root && !svg.querySelector(':scope > .stucent-lock-mark')) {
            const mark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            mark.setAttribute('class', 'stucent-lock-mark');
            mark.setAttribute('x', '-22');
            mark.setAttribute('y', '18');
            mark.textContent = '\u{1F512}';
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = 'Locked by your teacher';
            mark.appendChild(title);
            svg.appendChild(mark);
        }
    });
};

export {BLOCK_EVENTS, LockState, STAGE, markWorkspace, normalizeLocks, targetLockName};
