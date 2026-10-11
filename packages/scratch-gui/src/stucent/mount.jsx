/**
 * Mount the editor and connect the VM to the StuCent bridge: privacy guards,
 * locks, the edit log and the request handlers (PROTOCOL.md).
 */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {setAppElement} from 'react-modal';
// A webpack alias for the VM's own sb3 module (webpack.config.js, the stucent build).
// eslint-disable-next-line import-x/no-unresolved
import {deserializeBlocks} from 'stucent-vm-sb3';

import GUI from '../containers/gui.jsx';
import {AppStateProviderHOC} from '../lib/app-state-provider-hoc.jsx';
import {EditorState} from '../lib/editor-state';
import {setFullScreen, setPlayer} from '../reducers/mode.js';

import {BlockEditor} from './apply-blocks';
import {blankProjectJson} from './blank-project';
import {TRANSFER, debounce, startBridge} from './bridge';
import {UPSTREAM_COMMIT, VERSION} from './constants';
import {blocklyEdit, logVmEdits} from './edit-log';
import {LockState, markWorkspace, normalizeLocks, targetLockName} from './locks';
import {EMPTY_LOCKS, MODES, getPolicy, isExtensionAllowed, setPolicy} from './policy';
import {vmState} from './vm-state';

const FEATURES = Object.freeze([
    'load', 'setLocks', 'getProject', 'getState', 'applyBlocks', 'undo', 'greenFlag', 'stop', 'fullscreen', 'setMode',
    'edit-log', 'project-assets'
]);

/** How long after a load project changes are the load's own, not the player's. */
const LOAD_SETTLE_MS = 300;

const SOUP = '!#%()*+,-./:;=?@[]^_`{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const newBlockId = () => {
    let id = '';
    for (let i = 0; i < 20; i++) id += SOUP.charAt(Math.floor(Math.random() * SOUP.length));
    return id;
};

/**
 * Copy a typed array's bytes into an ArrayBuffer of their own (safe to transfer).
 * @param {Uint8Array} data bytes
 * @returns {ArrayBuffer} copy
 */
const ownBuffer = data => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

/**
 * Refuse extensions that call outside servers or hardware, wherever they are loaded from.
 * @param {object} vm the VM
 */
const guardExtensions = vm => {
    const manager = vm.extensionManager;
    const load = manager.loadExtensionURL.bind(manager);
    manager.loadExtensionURL = url => {
        if (!isExtensionAllowed(url)) {
            return Promise.reject(new Error(`The "${url}" extension is not available in this editor`));
        }
        return load(url);
    };
};

const getMainWorkspace = () => {
    const ScratchBlocks = require('scratch-blocks');
    return ScratchBlocks.getMainWorkspace ? ScratchBlocks.getMainWorkspace() : null;
};

/**
 * Mount the editor in `appTarget` and start the bridge when the page has a host.
 * @param {HTMLElement} appTarget container
 * @param {object} params parsed URL parameters (params.js)
 * @param {object} storage StucentStorage
 */
const mountEditor = (appTarget, params, storage) => {
    const appState = new EditorState(
        {locale: params.locale, isPlayerOnly: params.mode === 'readonly'},
        () => ({storage})
    );
    const store = appState.store;
    const vm = store.getState().scratchGui.vm;

    guardExtensions(vm);

    let quietUntil = 0;
    let loadedAt = performance.now();
    const isQuiet = () => performance.now() < quietUntil;
    const at = () => Math.round(performance.now() - loadedAt);

    let bridge = null;
    const post = (type, payload, transfer) => {
        if (bridge) bridge.post(type, payload, transfer);
    };
    const emitEdit = edit => post('edit', {at: at(), ...edit});

    // ── Locks ────────────────────────────────────────────────────────────
    const lockState = new LockState();
    const resync = debounce(() => vm.emitWorkspaceUpdate(), 0);
    const applyLocks = raw => {
        const locks = normalizeLocks(raw);
        lockState.set(locks, vm.runtime);
        setPolicy({locks});
        if (vm.editingTarget) vm.emitWorkspaceUpdate();
    };
    vm.on('workspaceUpdate', () => {
        // After the GUI has rebuilt the workspace (its listener runs first).
        setTimeout(() => markWorkspace(getMainWorkspace(), vm.editingTarget, lockState), 0);
    });

    // Order matters: the edit log wraps the VM methods first, the locks outside it,
    // so a refused change is never logged as made.
    logVmEdits(vm, emitEdit, isQuiet);

    const deleteSprite = vm.deleteSprite.bind(vm);
    vm.deleteSprite = targetId => {
        const target = vm.runtime.getTargetById(targetId);
        if (target && lockState.isSpriteLocked(targetLockName(target))) {
            emitEdit({kind: 'locked.refused', target: targetLockName(target), detail: 'deleteSprite'});
            return () => Promise.resolve();
        }
        return deleteSprite(targetId);
    };
    const renameSprite = vm.renameSprite.bind(vm);
    vm.renameSprite = (targetId, newName) => {
        const target = vm.runtime.getTargetById(targetId);
        if (target && lockState.isSpriteLocked(targetLockName(target))) {
            emitEdit({kind: 'locked.refused', target: targetLockName(target), detail: 'renameSprite'});
            vm.emitTargetsUpdate();
            return;
        }
        return renameSprite(targetId, newName);
    };

    const blockListener = vm.blockListener;
    vm.blockListener = e => {
        const target = vm.editingTarget;
        if (lockState.refuses(e, target)) {
            emitEdit({kind: 'locked.refused', target: targetLockName(target), blockId: e.blockId, detail: e.type});
            resync();
            return;
        }
        // Read the block before a delete removes it; a created block exists only after.
        const before = blocklyEdit(e, target);
        blockListener(e);
        if (!before || isQuiet()) return;
        const edit = e.type === 'create' ? blocklyEdit(e, target) : before;
        emitEdit(edit);
    };

    // ── Events ───────────────────────────────────────────────────────────
    const changed = debounce(() => post('changed', {at: at()}), 500);
    vm.on('PROJECT_CHANGED', () => {
        if (!isQuiet()) changed();
    });
    vm.on('PROJECT_RUN_START', () => post('running', {running: true}));
    vm.on('PROJECT_RUN_STOP', () => post('running', {running: false}));

    let fullScreen = store.getState().scratchGui.mode.isFullScreen;
    store.subscribe(() => {
        const now = store.getState().scratchGui.mode.isFullScreen;
        if (now !== fullScreen) {
            fullScreen = now;
            post('fullscreen', {on: now});
        }
    });

    const applyMode = mode => {
        if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}"`);
        setPolicy({mode});
        store.dispatch(setPlayer(mode === 'readonly'));
    };

    // ── Requests ─────────────────────────────────────────────────────────
    const blockEditor = new BlockEditor(vm, {
        deserializeBlocks,
        newId: newBlockId,
        isExtensionAllowed: id => isExtensionAllowed(id),
        isScriptLocked: (target, topId) => lockState.isScriptLocked(target, topId)
    });

    const projectInput = project => {
        if (project === null || typeof project === 'undefined') return blankProjectJson();
        if (project instanceof ArrayBuffer) return project;
        if (ArrayBuffer.isView(project)) return ownBuffer(project);
        if (typeof project === 'object' && project.json && typeof project.json === 'object') {
            storage.cacheAssets(project.assets || {});
            return project.json;
        }
        if (typeof project === 'object') return project;
        throw new Error('project must be .sb3 bytes, a project.json object, {json, assets} or null');
    };

    const handlers = {
        load: async msg => {
            const input = projectInput(msg.project);
            quietUntil = Infinity;
            try {
                vm.stopAll();
                blockEditor.undos.clear();
                lockState.set(EMPTY_LOCKS, vm.runtime);
                setPolicy({locks: EMPTY_LOCKS});
                await vm.loadProject(input);
                if (msg.mode) applyMode(msg.mode);
                applyLocks(msg.locks || EMPTY_LOCKS);
            } finally {
                loadedAt = performance.now();
                quietUntil = loadedAt + LOAD_SETTLE_MS;
            }
            return {};
        },
        setLocks: msg => {
            applyLocks(msg.locks);
            return {};
        },
        getProject: async () => {
            const blob = await vm.saveProjectSb3();
            const sb3 = await blob.arrayBuffer();
            const json = JSON.parse(vm.toJSON());
            const assets = {};
            vm.assets.forEach(asset => {
                if (!asset || !asset.data) return;
                const md5ext = `${asset.assetId}.${asset.dataFormat}`;
                if (!assets[md5ext]) assets[md5ext] = ownBuffer(asset.data);
            });
            return {sb3, json, assets, [TRANSFER]: [sb3, ...Object.values(assets)]};
        },
        getState: () => vmState(vm),
        applyBlocks: async msg => {
            const result = await blockEditor.apply(msg);
            emitEdit({kind: 'block.create', target: msg.target, blockId: result.topId, detail: 'host'});
            return result;
        },
        undo: msg => {
            blockEditor.undo(msg.token);
            return {};
        },
        greenFlag: () => {
            vm.greenFlag();
            return {};
        },
        stop: () => {
            vm.stopAll();
            return {};
        },
        fullscreen: msg => {
            store.dispatch(setFullScreen(!!msg.on));
            return {};
        },
        setMode: msg => {
            applyMode(msg.mode);
            return {};
        }
    };

    // ── Mount ────────────────────────────────────────────────────────────
    setAppElement(appTarget);
    const WrappedGui = AppStateProviderHOC(GUI);
    const editable = getPolicy().mode !== 'readonly';
    createRoot(appTarget).render(
        <WrappedGui
            appState={appState}
            backpackVisible={false}
            // The host sets the language (the `locale` parameter).
            canChangeLanguage={false}
            canCreateCopy={false}
            canCreateNew={false}
            canEditTitle={false}
            canManageFiles={editable}
            canRemix={false}
            canSave={false}
            canShare={false}
            canUseCloud={false}
            enableCommunity={false}
            isPlayerOnly={params.mode === 'readonly'}
            // '0' is the built-in project (storage.js caches the blank one under it).
            projectId="0"
            showComingSoon={false}
        />
    );

    // `ready` once the GUI has shown its first (blank) project: a host `load` can no longer be overwritten by it.
    if (!params.host) return;
    const unsubscribe = store.subscribe(() => {
        const loading = store.getState().scratchGui.projectState.loadingState;
        if (bridge || !String(loading).startsWith('SHOWING')) return;
        unsubscribe();
        bridge = startBridge({
            win: window,
            host: params.host,
            handlers,
            onError: error => console.warn('[stucent bridge]', error) // eslint-disable-line no-console
        });
        loadedAt = performance.now();
        post('ready', {version: VERSION, upstream: UPSTREAM_COMMIT, features: FEATURES});
    });
};

export {FEATURES, mountEditor};
