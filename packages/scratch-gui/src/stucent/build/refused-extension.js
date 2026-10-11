// The StuCent build replaces every extension that calls an outside server or
// hardware (translate, text to speech, video and face sensing, LEGO, micro:bit,
// Go Direct) with this, so their code (and machine-learning models) is not even
// shipped. The policy refuses to load them before this is ever reached.
class RefusedExtension {
    constructor () {
        throw new Error('This extension is not available in this editor');
    }
}

module.exports = RefusedExtension;
