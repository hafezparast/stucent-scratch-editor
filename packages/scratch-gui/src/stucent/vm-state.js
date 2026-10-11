/**
 * The VM's runtime state for the bridge's `getState`: each original sprite's
 * position, look and speech, every variable and list by name, and whether the
 * project is running. Plain JSON, so the host can post it on as it is.
 */

/**
 * A target's variables and lists, by name.
 * @param {object} target VM target
 * @returns {{variables: Record<string, *>, lists: Record<string, Array>}} values
 */
const variablesOf = target => {
    const variables = {};
    const lists = {};
    Object.keys(target.variables).forEach(id => {
        const v = target.variables[id];
        if (v.type === '') variables[v.name] = v.value;
        else if (v.type === 'list') lists[v.name] = Array.isArray(v.value) ? v.value.slice() : [];
    });
    return {variables, lists};
};

/**
 * What a sprite is saying or thinking, or null.
 * @param {object} target VM target
 * @returns {string|null} the bubble text
 */
const sayOf = target => {
    const bubble = target.getCustomState('Scratch.looks');
    return bubble && bubble.text ? String(bubble.text) : null;
};

/**
 * Is a thread running that the player started (not a monitor update)?
 * @param {object} runtime VM runtime
 * @returns {boolean} running
 */
const isRunning = runtime => runtime.threads.some(t => !t.updateMonitor && t.status !== 4 /* STATUS_DONE */);

/**
 * The runtime state.
 * @param {object} vm the VM
 * @returns {object} {running, timer, stage, sprites}
 */
const vmState = vm => {
    const runtime = vm.runtime;
    const stage = runtime.getTargetForStage();
    const originals = runtime.targets.filter(t => t.isOriginal && !t.isStage);
    const costumeName = t => {
        const c = t.getCostumes()[t.currentCostume];
        return c ? c.name : '';
    };
    return {
        running: isRunning(runtime),
        timer: runtime.ioDevices.clock.projectTimer(),
        stage: stage ? {costume: costumeName(stage), ...variablesOf(stage)} : {costume: '', variables: {}, lists: {}},
        sprites: originals.map(t => ({
            name: t.getName(),
            x: t.x,
            y: t.y,
            direction: t.direction,
            costume: costumeName(t),
            costumeIndex: t.currentCostume,
            visible: t.visible,
            size: t.size,
            layer: t.renderer ? t.getLayerOrder() : null,
            say: sayOf(t),
            ...variablesOf(t),
            clones: t.sprite.clones.filter(c => !c.isOriginal).length
        }))
    };
};

export {isRunning, sayOf, variablesOf, vmState};
