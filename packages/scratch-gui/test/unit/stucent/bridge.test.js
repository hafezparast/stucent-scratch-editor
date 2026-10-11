import {TRANSFER, debounce, startBridge} from '../../../src/stucent/bridge';

const HOST = 'https://stucent.example';

const fakeWindow = () => {
    const listeners = [];
    const parent = {posted: [],
        postMessage (data, origin, transfer) {
            this.posted.push({data, origin, transfer});
        }};
    return {
        parent,
        addEventListener: (type, fn) => listeners.push(fn),
        removeEventListener: (type, fn) => listeners.splice(listeners.indexOf(fn), 1),
        dispatch: event => listeners.forEach(fn => fn(event)),
        listeners
    };
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('StuCent bridge', () => {
    test('answers a request from the parent at the host origin, only to that origin', async () => {
        const win = fakeWindow();
        startBridge({win, host: HOST, handlers: {getState: () => ({running: false})}});
        win.dispatch({source: win.parent, origin: HOST, data: {emu: 'emu/1', type: 'getState', id: 'r1'}});
        await flush();
        expect(win.parent.posted).toEqual([{
            data: {emu: 'emu/1', type: 'result', re: 'r1', ok: true, running: false},
            origin: HOST,
            transfer: []
        }]);
    });

    test('ignores another origin, another window and other protocols', async () => {
        const win = fakeWindow();
        const handler = jest.fn(() => ({}));
        startBridge({win, host: HOST, handlers: {getState: handler}});
        win.dispatch({source: win.parent, origin: 'https://evil.example', data: {emu: 'emu/1', type: 'getState', id: 1}});
        win.dispatch({source: {}, origin: HOST, data: {emu: 'emu/1', type: 'getState', id: 2}});
        win.dispatch({source: win.parent, origin: HOST, data: {emu: 'emu/2', type: 'getState', id: 3}});
        win.dispatch({source: win.parent, origin: HOST, data: 'getState'});
        await flush();
        expect(handler).not.toHaveBeenCalled();
        expect(win.parent.posted).toEqual([]);
    });

    test('an unknown request and a failing handler are answered with ok: false', async () => {
        const win = fakeWindow();
        startBridge({win,
            host: HOST,
            handlers: {load: () => {
                throw new Error('bad project');
            }}});
        win.dispatch({source: win.parent, origin: HOST, data: {emu: 'emu/1', type: 'toString', id: 'a'}});
        win.dispatch({source: win.parent, origin: HOST, data: {emu: 'emu/1', type: 'load', id: 'b'}});
        await flush();
        expect(win.parent.posted.map(p => p.data)).toEqual([
            {emu: 'emu/1', type: 'result', re: 'a', ok: false, error: 'Unknown request "toString"'},
            {emu: 'emu/1', type: 'result', re: 'b', ok: false, error: 'bad project'}
        ]);
    });

    test('buffers a handler marks are transferred, not copied', async () => {
        const win = fakeWindow();
        const sb3 = new ArrayBuffer(4);
        startBridge({win, host: HOST, handlers: {getProject: () => ({sb3, [TRANSFER]: [sb3]})}});
        win.dispatch({source: win.parent, origin: HOST, data: {emu: 'emu/1', type: 'getProject', id: 'p'}});
        await flush();
        expect(win.parent.posted[0].transfer).toEqual([sb3]);
        expect(win.parent.posted[0].data[TRANSFER]).toBeUndefined();
    });

    test('events go to the host origin; stop removes the listener', () => {
        const win = fakeWindow();
        const bridge = startBridge({win, host: HOST, handlers: {}});
        bridge.post('running', {running: true});
        expect(win.parent.posted[0]).toEqual({data: {emu: 'emu/1', type: 'running', running: true}, origin: HOST, transfer: []});
        bridge.stop();
        expect(win.listeners).toHaveLength(0);
    });

    test('no host, no bridge', () => {
        expect(() => startBridge({win: fakeWindow(), host: null, handlers: {}})).toThrow();
    });

    test('debounce works with the window timers (they must not be called as methods of another object)', async () => {
        // A browser's setTimeout throws "Illegal invocation" when `this` is not the window; jsdom's does not.
        const realSet = global.setTimeout;
        const realClear = global.clearTimeout;
        const strict = real => function (...args) {
            // eslint-disable-next-line @typescript-eslint/no-invalid-this -- the receiver is what is tested
            if (typeof this !== 'undefined' && this !== globalThis) throw new TypeError('Illegal invocation');
            return real(...args);
        };
        global.setTimeout = strict(realSet);
        global.clearTimeout = strict(realClear);
        try {
            const fn = jest.fn();
            const d = debounce(fn, 1);
            expect(() => d()).not.toThrow();
            expect(() => d()).not.toThrow();
            await new Promise(resolve => realSet(resolve, 20));
            expect(fn).toHaveBeenCalledTimes(1);
        } finally {
            global.setTimeout = realSet;
            global.clearTimeout = realClear;
        }
    });

    test('debounce calls once after quiet time', () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const d = debounce(fn, 500);
        d();
        d();
        jest.advanceTimersByTime(499);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});
