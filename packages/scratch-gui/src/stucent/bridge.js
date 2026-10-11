/**
 * The postMessage bridge to the StuCent host page (protocol emu/1, PROTOCOL.md).
 *
 * Active only when the page was opened with `?host=<origin>`. A message is
 * accepted only from the parent window and only from that origin; everything
 * the editor posts goes to the parent with that origin as the target, so no
 * other page ever reads the project.
 */
import {PROTOCOL} from './constants';

/** A handler may return this to transfer buffers (e.g. the .sb3) instead of copying them. */
const TRANSFER = '__transfer';

/**
 * Start the bridge.
 * @param {object} options options
 * @param {Window} options.win the editor's window
 * @param {string} options.host the parent page's origin
 * @param {Record<string, function(object): (object|Promise<object>)>} options.handlers request handlers by type
 * @param {function(Error, object): void} [options.onError] told about a failed request
 * @returns {{post: function(string, object=, Array=): void, stop: function(): void}} the bridge
 */
const startBridge = ({win, host, handlers, onError}) => {
    if (!host) throw new Error('The bridge needs the host origin');
    const parent = win.parent;

    const post = (type, payload = {}, transfer = []) => {
        parent.postMessage({...payload, emu: PROTOCOL, type}, host, transfer);
    };

    const reply = (id, ok, data = {}, transfer = []) => {
        post('result', {...data, re: id, ok}, transfer);
    };

    const onMessage = event => {
        if (event.source !== parent || event.origin !== host) return;
        const msg = event.data;
        if (!msg || typeof msg !== 'object' || msg.emu !== PROTOCOL || typeof msg.type !== 'string') return;
        if (msg.type === 'result') return;
        const id = typeof msg.id === 'string' || typeof msg.id === 'number' ? msg.id : null;
        const handler = Object.prototype.hasOwnProperty.call(handlers, msg.type) ? handlers[msg.type] : null;
        if (!handler) {
            if (id !== null) reply(id, false, {error: `Unknown request "${msg.type}"`});
            return;
        }
        Promise.resolve()
            .then(() => handler(msg))
            .then(result => {
                if (id === null) return;
                const data = {...(result || {})};
                const transfer = data[TRANSFER] || [];
                delete data[TRANSFER];
                reply(id, true, data, transfer);
            })
            .catch(error => {
                if (onError) onError(error, msg);
                if (id !== null) reply(id, false, {error: error && error.message ? error.message : String(error)});
            });
    };

    win.addEventListener('message', onMessage);
    return {
        post,
        stop: () => win.removeEventListener('message', onMessage)
    };
};

/**
 * Call `fn` once things have been quiet for `ms` (the `changed` event).
 * @param {function(): void} fn the function
 * @param {number} ms quiet time
 * @param {object} [timers] setTimeout / clearTimeout (tests pass fakes)
 * @returns {function(): void} the debounced function
 */
// The window's timers, called as plain functions: a browser refuses them called as methods of another object.
const WINDOW_TIMERS = {
    setTimeout: (f, ms) => setTimeout(f, ms), // eslint-disable-line @typescript-eslint/no-implied-eval
    clearTimeout: handle => clearTimeout(handle)
};

const debounce = (fn, ms, timers = WINDOW_TIMERS) => {
    let handle = null;
    return () => {
        if (handle !== null) timers.clearTimeout(handle);
        handle = timers.setTimeout(() => {
            handle = null;
            fn();
        }, ms);
    };
};

export {TRANSFER, debounce, startBridge};
