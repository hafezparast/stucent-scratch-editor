/**
 * Block edits from the host (the bridge's `applyBlocks` / `undo`): add a
 * script from sb3 blocks JSON, or replace one, with an undo token for each.
 * Written for the AI help to come, which proposes scripts the player can
 * take or reject. A locked script is never replaced.
 */

/** Opcode prefixes of the blocks every project has; any other prefix is an extension's id. */
const CORE_PREFIXES = Object.freeze([
    'motion', 'looks', 'sound', 'event', 'control', 'sensing', 'operator', 'data', 'procedures', 'argument', 'note',
    'matrix', 'colour', 'math', 'text'
]);

/**
 * The extension an opcode belongs to, or null for a core block.
 * @param {string} opcode block opcode
 * @returns {string|null} extension id
 */
const extensionOf = opcode => {
    const i = opcode.indexOf('_');
    if (i <= 0) return null;
    const prefix = opcode.slice(0, i);
    return CORE_PREFIXES.includes(prefix) ? null : prefix;
};

/**
 * Give every block of a deserialized (VM format) script a fresh id, so it can
 * never clash with the project's blocks, and keep the links between them.
 * @param {Record<string, object>} blocks VM-format blocks by id
 * @param {function(): string} newId makes a fresh id
 * @returns {Record<string, object>} the blocks under their new ids
 */
const renewBlockIds = (blocks, newId) => {
    const ids = {};
    Object.keys(blocks).forEach(id => {
        ids[id] = newId();
    });
    const map = id => (typeof id === 'string' && ids[id] ? ids[id] : id);
    const out = {};
    Object.keys(blocks).forEach(id => {
        const b = blocks[id];
        const inputs = {};
        Object.keys(b.inputs || {}).forEach(name => {
            const input = b.inputs[name];
            inputs[name] = {...input, block: map(input.block), shadow: map(input.shadow)};
        });
        const copy = {...b, id: ids[id], next: map(b.next), parent: map(b.parent), inputs};
        // A comment would need the target's comment list too; scripts from the host carry none.
        delete copy.comment;
        out[ids[id]] = copy;
    });
    return out;
};

/**
 * Every block of a script (its stack, inputs and shadows), copied.
 * @param {object} blocksContainer a target's VM Blocks
 * @param {string} topId the script's top block id
 * @returns {object[]} the blocks
 */
const scriptBlocks = (blocksContainer, topId) => {
    const out = [];
    const seen = new Set();
    const visit = id => {
        if (typeof id !== 'string' || seen.has(id)) return;
        const b = blocksContainer.getBlock(id);
        if (!b) return;
        seen.add(id);
        out.push(JSON.parse(JSON.stringify(b)));
        Object.keys(b.inputs || {}).forEach(name => {
            visit(b.inputs[name].block);
            visit(b.inputs[name].shadow);
        });
        visit(b.next);
    };
    visit(topId);
    return out;
};

let tokenCounter = 0;

class BlockEditor {
    /**
     * @param {object} vm the VM
     * @param {object} deps dependencies
     * @param {function(object): object} deps.deserializeBlocks scratch-vm's sb3.deserializeBlocks
     * @param {function(): string} deps.newId makes a fresh block id
     * @param {function(string): boolean} deps.isExtensionAllowed policy check
     * @param {function(object, string): boolean} deps.isScriptLocked lock check (target, topId)
     */
    constructor (vm, deps) {
        this.vm = vm;
        this.deps = deps;
        /** @type {Map<string, {targetId: string, added: string, removed: object[]}>} */
        this.undos = new Map();
    }

    findTarget (name) {
        const runtime = this.vm.runtime;
        const target = name === 'Stage' ? runtime.getTargetForStage() : runtime.getSpriteTargetByName(name);
        if (!target) throw new Error(`No sprite named "${name}"`);
        return target;
    }

    refresh (target) {
        if (this.vm.editingTarget === target) this.vm.emitWorkspaceUpdate();
        this.vm.runtime.emitProjectChanged();
    }

    /**
     * Add a script (or replace one).
     * @param {object} req {target, blocks, replace?, x?, y?}
     * @returns {Promise<{topId: string, undo: string}>} the new script and its undo token
     */
    async apply (req) {
        const target = this.findTarget(req.target);
        if (!req.blocks || typeof req.blocks !== 'object') throw new Error('blocks must be an sb3 blocks object');
        const replacing = typeof req.replace === 'string';
        if (replacing) {
            if (!target.blocks.getBlock(req.replace) || target.blocks.getTopLevelScript(req.replace) !== req.replace) {
                throw new Error(`No script with top block "${req.replace}"`);
            }
            if (this.deps.isScriptLocked(target, req.replace)) throw new Error('That script is locked');
        }
        const raw = JSON.parse(JSON.stringify(req.blocks));
        const tops = Object.keys(raw).filter(id => raw[id] && !Array.isArray(raw[id]) && raw[id].topLevel);
        if (tops.length !== 1) throw new Error(`blocks must hold exactly one script (found ${tops.length})`);
        this.deps.deserializeBlocks(raw);
        const blocks = renewBlockIds(raw, this.deps.newId);
        const list = Object.keys(blocks).map(id => blocks[id]);
        const top = list.find(b => b.topLevel && !b.parent);
        if (!top) throw new Error('The script has no top block');
        if (typeof req.x === 'number') top.x = req.x;
        if (typeof req.y === 'number') top.y = req.y;

        const extensions = [...new Set(list.map(b => extensionOf(b.opcode)).filter(Boolean))];
        const refused = extensions.filter(id => !this.deps.isExtensionAllowed(id));
        if (refused.length > 0) throw new Error(`Extension not available: ${refused.join(', ')}`);
        const manager = this.vm.extensionManager;
        const missing = extensions.filter(id => !manager.isExtensionLoaded(id));
        await Promise.all(missing.map(id => manager.loadExtensionURL(id)));

        let removed = [];
        if (replacing) {
            removed = scriptBlocks(target.blocks, req.replace);
            target.blocks.deleteBlock(req.replace);
        }
        list.forEach(b => target.blocks.createBlock(b));
        target.blocks.updateTargetSpecificBlocks(target.isStage);
        target.fixUpVariableReferences();
        this.refresh(target);

        const token = `u${++tokenCounter}-${top.id}`;
        this.undos.set(token, {targetId: target.id, added: top.id, removed});
        return {topId: top.id, undo: token};
    }

    /**
     * Take back an applyBlocks: remove the script it added, restore the one it replaced.
     * @param {string} token the undo token
     */
    undo (token) {
        const entry = this.undos.get(token);
        if (!entry) throw new Error('Unknown or used undo token');
        const target = this.vm.runtime.getTargetById(entry.targetId);
        if (!target) throw new Error('The sprite is gone');
        this.undos.delete(token);
        if (target.blocks.getBlock(entry.added)) target.blocks.deleteBlock(entry.added);
        entry.removed.forEach(b => target.blocks.createBlock(b));
        target.blocks.updateTargetSpecificBlocks(target.isStage);
        this.refresh(target);
    }
}

export {BlockEditor, CORE_PREFIXES, extensionOf, renewBlockIds, scriptBlocks};
