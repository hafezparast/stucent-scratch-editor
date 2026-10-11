/**
 * The bridge's VM-facing parts against a real VM: locks, the edit log,
 * the state snapshot and host block edits (applyBlocks / undo).
 */
import VM from '@scratch/scratch-vm';

import {LockState, normalizeLocks} from '../../../src/stucent/locks';
import {blocklyEdit, logVmEdits} from '../../../src/stucent/edit-log';
import {vmState} from '../../../src/stucent/vm-state';
import {BlockEditor, extensionOf, renewBlockIds} from '../../../src/stucent/apply-blocks';

// jsdom has no User Timing API; the VM marks its work with it.
if (typeof performance.mark !== 'function') performance.mark = () => {};
if (typeof performance.measure !== 'function') performance.measure = () => {};

// The VM's own sb3 module, as the stucent build aliases it.
const {deserializeBlocks} = require('../../../../../node_modules/@scratch/scratch-vm/src/serialization/sb3.js');

const costume = {
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    name: 'c1',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0
};

const project = () => ({
    targets: [
        {
            isStage: true,
            name: 'Stage',
            variables: {v1: ['score', 3]},
            lists: {l1: ['caught', ['a', 'b']]},
            broadcasts: {},
            blocks: {},
            currentCostume: 0,
            costumes: [costume],
            sounds: [],
            volume: 100
        },
        {
            isStage: false,
            name: 'Bowl',
            variables: {},
            lists: {},
            broadcasts: {},
            currentCostume: 0,
            costumes: [costume],
            sounds: [],
            volume: 100,
            visible: true,
            x: 10,
            y: -150,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around',
            blocks: {
                top: {opcode: 'event_whenflagclicked',
                    next: 'mv',
                    parent: null,
                    inputs: {},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 0,
                    y: 0},
                mv: {opcode: 'motion_changexby',
                    next: null,
                    parent: 'top',
                    inputs: {DX: [1, [4, '10']]},
                    fields: {},
                    shadow: false,
                    topLevel: false},
                free: {opcode: 'looks_hide',
                    next: null,
                    parent: null,
                    inputs: {},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 300,
                    y: 0}
            }
        }
    ],
    monitors: [],
    extensions: [],
    meta: {semver: '3.0.0', vm: '0.2.0', agent: ''}
});

const newScript = {
    s1: {opcode: 'event_whenkeypressed',
        next: 's2',
        parent: null,
        inputs: {},
        fields: {KEY_OPTION: ['right arrow', null]},
        shadow: false,
        topLevel: true,
        x: 0,
        y: 0},
    s2: {opcode: 'motion_changexby',
        next: null,
        parent: 's1',
        inputs: {DX: [1, [4, '5']]},
        fields: {},
        shadow: false,
        topLevel: false}
};

let counter = 0;
const editorFor = (vm, lockState) => new BlockEditor(vm, {
    deserializeBlocks,
    newId: () => `id${++counter}`,
    isExtensionAllowed: id => id === 'pen' || id === 'music',
    isScriptLocked: (target, topId) => lockState.isScriptLocked(target, topId)
});

const loadVm = async () => {
    const vm = new VM();
    await vm.loadProject(project());
    return vm;
};

describe('locks', () => {
    test('normalizeLocks drops what is not a sprite name or a {sprite, topId} pair', () => {
        expect(normalizeLocks({sprites: ['Bowl', 3], scripts: [{sprite: 'Bowl', topId: 'top'}, {sprite: 1}]}))
            .toEqual({sprites: ['Bowl'], scripts: [{sprite: 'Bowl', topId: 'top'}]});
        expect(normalizeLocks(null)).toEqual({sprites: [], scripts: []});
    });

    test('a locked script refuses changes to any block in it and blocks dropped into it', async () => {
        const vm = await loadVm();
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        const locks = new LockState();
        locks.set(normalizeLocks({scripts: [{sprite: 'Bowl', topId: 'top'}]}), vm.runtime);
        expect(locks.refuses({type: 'move', blockId: 'top'}, bowl)).toBe(true);
        expect(locks.refuses({type: 'delete', blockId: 'mv'}, bowl)).toBe(true);
        const shadowId = bowl.blocks.getBlock('mv').inputs.DX.shadow;
        expect(locks.refuses({type: 'change', blockId: shadowId, element: 'field'}, bowl)).toBe(true);
        expect(locks.refuses({type: 'block_field_intermediate_change', blockId: shadowId}, bowl)).toBe(true);
        expect(locks.refuses({type: 'move', blockId: 'free', newParentId: 'mv'}, bowl)).toBe(true);
        // The free script is not locked; nor is a new block, nor a UI event.
        expect(locks.refuses({type: 'move', blockId: 'free'}, bowl)).toBe(false);
        expect(locks.refuses({type: 'create', blockId: 'brand-new'}, bowl)).toBe(false);
        expect(locks.refuses({type: 'selected', blockId: 'top'}, bowl)).toBe(false);
    });

    test('a locked sprite locks every script it has when it is locked', async () => {
        const vm = await loadVm();
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        const locks = new LockState();
        locks.set(normalizeLocks({sprites: ['Bowl']}), vm.runtime);
        expect(locks.isSpriteLocked('Bowl')).toBe(true);
        expect(locks.isScriptLocked(bowl, 'top')).toBe(true);
        expect(locks.isScriptLocked(bowl, 'free')).toBe(true);
    });
});

describe('edit log', () => {
    test('Blockly events become edits; UI events do not', async () => {
        const vm = await loadVm();
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        expect(blocklyEdit({type: 'move', blockId: 'free', newParentId: 'mv'}, bowl))
            .toEqual({kind: 'block.move', target: 'Bowl', blockId: 'free', opcode: 'looks_hide', detail: 'attach'});
        expect(blocklyEdit({type: 'var_create', varId: 'x', varName: 'lives'}, bowl))
            .toEqual({kind: 'variable.create', target: 'Bowl', detail: 'lives'});
        expect(blocklyEdit({type: 'selected', blockId: 'top'}, bowl)).toBeNull();
        expect(blocklyEdit({type: 'block_field_intermediate_change', blockId: 'top'}, bowl)).toBeNull();
    });

    test('sprite renames are logged with the sprite they touched, but not while the bridge is quiet', async () => {
        const vm = await loadVm();
        const edits = [];
        let quiet = false;
        logVmEdits(vm, e => edits.push(e), () => quiet);
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        vm.renameSprite(bowl.id, 'Basket');
        quiet = true;
        vm.renameSprite(bowl.id, 'Bowl');
        expect(edits).toEqual([{kind: 'sprite.rename', detail: 'renameSprite', target: 'Basket'}]);
    });
});

describe('state snapshot', () => {
    test('sprites, variables and lists by name', async () => {
        const vm = await loadVm();
        const state = vmState(vm);
        expect(state.running).toBe(false);
        expect(state.stage).toEqual({costume: 'c1', variables: {score: 3}, lists: {caught: ['a', 'b']}});
        expect(state.sprites).toEqual([expect.objectContaining({
            name: 'Bowl',
            x: 10,
            y: -150,
            direction: 90,
            costume: 'c1',
            costumeIndex: 0,
            visible: true,
            size: 100,
            say: null,
            variables: {},
            lists: {},
            clones: 0
        })]);
    });
});

describe('host block edits', () => {
    test('renewBlockIds keeps the links between blocks under fresh ids', () => {
        const blocks = {a: {id: 'a', next: 'b', parent: null, inputs: {}},
            b: {id: 'b',
                next: null,
                parent: 'a',
                inputs: {X: {name: 'X', block: 'c', shadow: 'c'}}},
            c: {id: 'c', next: null, parent: 'b', inputs: {}}};
        let n = 0;
        const out = renewBlockIds(blocks, () => `n${++n}`);
        expect(Object.keys(out)).toEqual(['n1', 'n2', 'n3']);
        expect(out.n1.next).toBe('n2');
        expect(out.n2.parent).toBe('n1');
        expect(out.n2.inputs.X).toEqual({name: 'X', block: 'n3', shadow: 'n3'});
    });

    test('extensionOf tells extension blocks from core blocks', () => {
        expect(extensionOf('motion_movesteps')).toBeNull();
        expect(extensionOf('pen_clear')).toBe('pen');
        expect(extensionOf('translate_getTranslate')).toBe('translate');
    });

    test('applyBlocks adds a script under fresh ids and undo removes it', async () => {
        const vm = await loadVm();
        const locks = new LockState();
        const editor = editorFor(vm, locks);
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        const {topId, undo} = await editor.apply({target: 'Bowl', blocks: newScript, x: 40, y: 50});
        expect(bowl.blocks.getScripts()).toContain(topId);
        expect(bowl.blocks.getBlock(topId)).toMatchObject({opcode: 'event_whenkeypressed', x: 40, y: 50});
        expect(bowl.blocks.getBlock(bowl.blocks.getBlock(topId).next).opcode).toBe('motion_changexby');
        editor.undo(undo);
        expect(bowl.blocks.getBlock(topId)).toBeUndefined();
        expect(() => editor.undo(undo)).toThrow('Unknown or used undo token');
    });

    test('replace swaps a script and undo brings it back; a locked script is never replaced', async () => {
        const vm = await loadVm();
        const locks = new LockState();
        const editor = editorFor(vm, locks);
        const bowl = vm.runtime.getSpriteTargetByName('Bowl');
        const {topId, undo} = await editor.apply({target: 'Bowl', blocks: newScript, replace: 'free'});
        expect(bowl.blocks.getBlock('free')).toBeUndefined();
        editor.undo(undo);
        expect(bowl.blocks.getBlock('free').opcode).toBe('looks_hide');
        expect(bowl.blocks.getBlock(topId)).toBeUndefined();

        locks.set(normalizeLocks({scripts: [{sprite: 'Bowl', topId: 'top'}]}), vm.runtime);
        await expect(editor.apply({target: 'Bowl', blocks: newScript, replace: 'top'})).rejects.toThrow('locked');
        expect(bowl.blocks.getBlock('top').opcode).toBe('event_whenflagclicked');
    });

    test('refuses two scripts, an unknown sprite and an online extension', async () => {
        const vm = await loadVm();
        const editor = editorFor(vm, new LockState());
        const two = {...newScript,
            t: {opcode: 'looks_show',
                next: null,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
                x: 0,
                y: 0}};
        await expect(editor.apply({target: 'Bowl', blocks: two})).rejects.toThrow('exactly one script');
        await expect(editor.apply({target: 'Nobody', blocks: newScript})).rejects.toThrow('No sprite');
        const translate = {t: {opcode: 'translate_getViewerLanguage',
            next: null,
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 0,
            y: 0}};
        await expect(editor.apply({target: 'Bowl', blocks: translate})).rejects.toThrow('Extension not available');
    });
});
