/**
 * A project the bridge loads into a player-only editor (readonly) must be
 * drawn: the VM is not started there, so nothing redraws the stage, and the
 * blank project (the ball) stayed on screen until the green flag (#10736).
 */
import {redrawWhileStopped} from '../../../src/stucent/redraw';

const fakeVm = started => ({
    runtime: {_steppingInterval: started ? 1 : null},
    renderer: {draw: jest.fn()}
});

const drain = frames => {
    while (frames.length) frames.shift()();
};

describe('redrawWhileStopped', () => {
    test('draws the stage of a stopped VM after a load, for a few frames (skins load async)', () => {
        const vm = fakeVm(false);
        const frames = [];
        redrawWhileStopped(vm, {frames: 3, schedule: fn => frames.push(fn)});
        drain(frames);
        expect(vm.renderer.draw).toHaveBeenCalledTimes(3);
    });

    test('a running VM draws itself: nothing to do', () => {
        const vm = fakeVm(true);
        const frames = [];
        redrawWhileStopped(vm, {frames: 3, schedule: fn => frames.push(fn)});
        drain(frames);
        expect(vm.renderer.draw).not.toHaveBeenCalled();
    });

    test('stops drawing once the VM starts', () => {
        const vm = fakeVm(false);
        const frames = [];
        redrawWhileStopped(vm, {frames: 5, schedule: fn => frames.push(fn)});
        frames.shift()();
        vm.runtime._steppingInterval = 1;
        drain(frames);
        expect(vm.renderer.draw).toHaveBeenCalledTimes(1);
    });

    test('no renderer (a headless VM): no error', () => {
        expect(() => redrawWhileStopped({runtime: {}}, {frames: 1, schedule: fn => fn()})).not.toThrow();
    });
});
