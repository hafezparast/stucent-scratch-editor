/**
 * Draw the stage of a VM that is not running.
 *
 * The VM redraws the stage on every step, but a player-only GUI (readonly)
 * does not start the VM until its green flag. The GUI's own project loading
 * (lib/vm-manager-hoc.jsx) draws once by hand for that case; the bridge's
 * `load` calls vm.loadProject directly, so without this the stage kept showing
 * the blank project (the ball) until the green flag (#10736). Costume images
 * load asynchronously, so it draws for a few frames, and stops as soon as the
 * VM runs (it draws itself then).
 */

/** Frames to draw after a load: about half a second at 60 fps. */
const REDRAW_FRAMES = 30;

/**
 * @param {object} vm the VM (vm.renderer may be missing in a headless VM)
 * @param {{frames?: number, schedule?: function(function): void}} [opts] frame count and scheduler
 */
const redrawWhileStopped = (vm, opts = {}) => {
    const frames = opts.frames || REDRAW_FRAMES;
    const schedule = opts.schedule || (fn => requestAnimationFrame(fn));
    const stopped = () => !vm.runtime || !vm.runtime._steppingInterval;
    let left = frames;
    const tick = () => {
        if (!vm.renderer || !stopped()) return;
        vm.renderer.draw();
        if (--left > 0) schedule(tick);
    };
    schedule(tick);
};

export {REDRAW_FRAMES, redrawWhileStopped};
