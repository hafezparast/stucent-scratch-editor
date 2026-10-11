/**
 * The edit log the bridge streams to the host (`edit` events): what the
 * player changed, block by block and asset by asset. Only the player's own
 * edits are logged: a project load reaches the VM without Blockly events, and
 * the bridge's own changes (applyBlocks) are logged by the bridge itself.
 */
import {targetLockName} from './locks';

/** Blockly event type → edit kind. */
const BLOCKLY_KINDS = Object.freeze({
    create: 'block.create',
    delete: 'block.delete',
    move: 'block.move',
    change: 'block.change',
    var_create: 'variable.create',
    var_delete: 'variable.delete',
    var_rename: 'variable.rename'
});

/**
 * The edit a Blockly event makes, or null for events that change nothing
 * (UI, drags, intermediate field typing, comments).
 * @param {object} e Blockly event
 * @param {object|null} target the editing target
 * @returns {object|null} {kind, target, blockId, opcode, detail}
 */
const blocklyEdit = (e, target) => {
    const kind = e && BLOCKLY_KINDS[e.type];
    if (!kind) return null;
    const edit = {kind};
    if (target) edit.target = targetLockName(target);
    if (typeof e.blockId === 'string') {
        edit.blockId = e.blockId;
        const block = target && target.blocks.getBlock(e.blockId);
        if (block) edit.opcode = block.opcode;
    }
    if (e.type === 'change' && typeof e.element === 'string') {
        edit.detail = e.name ? `${e.element}:${e.name}` : e.element;
    } else if (e.type === 'move') {
        if (typeof e.newParentId === 'string') edit.detail = 'attach';
        else edit.detail = typeof e.oldParentId === 'string' ? 'detach' : 'position';
    } else if (kind.startsWith('variable.')) {
        edit.detail = e.varName || e.newName || e.varId;
    }
    return edit;
};

/** VM methods → the edit kind each one makes. */
const VM_METHOD_KINDS = Object.freeze({
    addSprite: 'sprite.add',
    duplicateSprite: 'sprite.add',
    deleteSprite: 'sprite.delete',
    renameSprite: 'sprite.rename',
    addCostume: 'costume.add',
    addCostumeFromLibrary: 'costume.add',
    addBackdrop: 'costume.add',
    deleteCostume: 'costume.delete',
    renameCostume: 'costume.change',
    updateSvg: 'costume.change',
    updateBitmap: 'costume.change',
    reorderCostume: 'costume.change',
    addSound: 'sound.add',
    deleteSound: 'sound.delete'
});

/**
 * Log the sprite, costume and sound edits the GUI makes through the VM.
 * @param {object} vm the VM
 * @param {function(object): void} emit called with each edit
 * @param {function(): boolean} isQuiet true while the bridge itself changes the project
 */
const logVmEdits = (vm, emit, isQuiet) => {
    Object.keys(VM_METHOD_KINDS).forEach(name => {
        const original = vm[name];
        if (typeof original !== 'function') return;
        // These take the sprite's target id; the others act on the editing target.
        const byId = name === 'deleteSprite' || name === 'renameSprite' || name === 'duplicateSprite';
        vm[name] = function (...args) {
            const target = byId ? vm.runtime.getTargetById(args[0]) : vm.editingTarget;
            const result = original.apply(this, args);
            if (!isQuiet()) {
                const edit = {kind: VM_METHOD_KINDS[name], detail: name};
                if (target) edit.target = targetLockName(target);
                emit(edit);
            }
            return result;
        };
    });
};

export {BLOCKLY_KINDS, VM_METHOD_KINDS, blocklyEdit, logVmEdits};
