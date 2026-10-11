// The StuCent editor runs in a sandboxed frame with no web storage: the GUI's
// small key-value preferences live in memory for the session instead.
const maps = new Map();

export const getLocalStorageValue = (key, id) => (maps.get(key) || {})[id];

export const setLocalStorageValue = (key, id, value) => {
    maps.set(key, {...(maps.get(key) || {}), [id]: value});
};
