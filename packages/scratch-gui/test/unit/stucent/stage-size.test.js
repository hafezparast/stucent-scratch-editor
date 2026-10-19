/**
 * `setStageSize` (#10965): the host asks for a small stage so the editor lays out below 1024 px.
 */
import {SMALL_STAGE_CLASS, STAGE_SIZES, applyStageSize} from '../../../src/stucent/stage-size';
import fs from 'fs';
import path from 'path';
import stageSizeReducer from '../../../src/reducers/stage-size';
import {STAGE_SIZE_MODES} from '../../../src/lib/layout-constants';

const fakeStore = () => {
    const store = {state: stageSizeReducer(void 0, {})};
    store.dispatch = action => {
        store.state = stageSizeReducer(store.state, action);
    };
    return store;
};
const fakeRoot = () => {
    const classes = new Set();
    return {classes, classList: {toggle: (name, on) => (on ? classes.add(name) : classes.delete(name))}};
};

describe('setStageSize', () => {
    test('small: the small stage and the narrow layout class', () => {
        const store = fakeStore();
        const root = fakeRoot();
        applyStageSize(store, root, 'small');
        expect(store.state.stageSize).toBe(STAGE_SIZE_MODES.small);
        expect(root.classes.has(SMALL_STAGE_CLASS)).toBe(true);
    });

    test('normal: back to the large stage and the 1024 px layout', () => {
        const store = fakeStore();
        const root = fakeRoot();
        applyStageSize(store, root, 'small');
        applyStageSize(store, root, 'normal');
        expect(store.state.stageSize).toBe(STAGE_SIZE_MODES.large);
        expect(root.classes.has(SMALL_STAGE_CLASS)).toBe(false);
    });

    test('an unknown size is refused and changes nothing', () => {
        const store = fakeStore();
        const root = fakeRoot();
        expect(() => applyStageSize(store, root, 'huge')).toThrow(/Unknown stage size/);
        expect(store.state.stageSize).toBe(STAGE_SIZE_MODES.large);
        expect(root.classes.size).toBe(0);
    });

    test('the sizes are the protocol\'s and the editor advertises the request', () => {
        expect(STAGE_SIZES).toEqual(['normal', 'small']);
        // mount.jsx pulls in the whole GUI (and a webpack alias), so read it as text.
        const mount = fs.readFileSync(path.join(__dirname, '../../../src/stucent/mount.jsx'), 'utf8');
        expect(mount).toMatch(/FEATURES = Object\.freeze\(\[[^\]]*'setStageSize'/);
        expect(mount).toMatch(/setStageSize: msg =>/);
    });
});
