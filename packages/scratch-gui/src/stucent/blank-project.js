/**
 * The project the editor opens with in StuCent (a `load` with `project: null`,
 * and File > New): an empty backdrop and one sprite drawn as a plain ball.
 * It deliberately has no Scratch Cat: the Scratch TRADEMARK file reserves it.
 */
import popWav from '!arraybuffer-loader!../lib/default-project/83a9787d4cb6f3b7632b4ddfebf74367.wav?';
import backdrop from '!raw-loader!../lib/default-project/cd21514d0531fdffb22204e0ec5ed84a.svg?';
import ball from '!raw-loader!./ball.svg?';

const BALL_ID = 'ad132f16fce96666aab3ee5efed462b7';
const BACKDROP_ID = 'cd21514d0531fdffb22204e0ec5ed84a';
const POP_ID = '83a9787d4cb6f3b7632b4ddfebf74367';

/**
 * The blank project's project.json.
 * @returns {object} project.json
 */
const blankProjectJson = () => ({
    targets: [
        {
            isStage: true,
            name: 'Stage',
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {},
            comments: {},
            currentCostume: 0,
            costumes: [{
                assetId: BACKDROP_ID,
                name: 'backdrop1',
                md5ext: `${BACKDROP_ID}.svg`,
                dataFormat: 'svg',
                rotationCenterX: 240,
                rotationCenterY: 180
            }],
            sounds: [{
                assetId: POP_ID,
                name: 'pop',
                dataFormat: 'wav',
                format: '',
                rate: 11025,
                sampleCount: 258,
                md5ext: `${POP_ID}.wav`
            }],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: 'off',
            textToSpeechLanguage: null
        },
        {
            isStage: false,
            name: 'Sprite1',
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {},
            comments: {},
            currentCostume: 0,
            costumes: [{
                assetId: BALL_ID,
                name: 'ball',
                bitmapResolution: 1,
                md5ext: `${BALL_ID}.svg`,
                dataFormat: 'svg',
                rotationCenterX: 32,
                rotationCenterY: 32
            }],
            sounds: [{
                assetId: POP_ID,
                name: 'pop',
                dataFormat: 'wav',
                format: '',
                rate: 11025,
                sampleCount: 258,
                md5ext: `${POP_ID}.wav`
            }],
            volume: 100,
            layerOrder: 1,
            visible: true,
            x: 0,
            y: 0,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around'
        }
    ],
    monitors: [],
    extensions: [],
    meta: {semver: '3.0.0', vm: '0.2.0', agent: ''}
});

/**
 * The blank project and its assets, in the shape storage caches them.
 * @returns {Array<{id: (string|number), assetType: string, dataFormat: string, data: (string|Uint8Array)}>} assets
 */
const blankProjectAssets = () => {
    const encoder = new TextEncoder();
    return [
        {id: 0, assetType: 'Project', dataFormat: 'JSON', data: JSON.stringify(blankProjectJson())},
        {id: POP_ID, assetType: 'Sound', dataFormat: 'WAV', data: new Uint8Array(popWav)},
        {id: BACKDROP_ID, assetType: 'ImageVector', dataFormat: 'SVG', data: encoder.encode(backdrop)},
        {id: BALL_ID, assetType: 'ImageVector', dataFormat: 'SVG', data: encoder.encode(ball)}
    ];
};

export {blankProjectAssets, blankProjectJson};
