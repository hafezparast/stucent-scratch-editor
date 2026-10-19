/* eslint-disable no-console -- a command-line check that reports on the console */
/**
 * End-to-end check of the StuCent build (build-stucent/) and its bridge, in
 * headless Chromium: the editor is served at /emulators/scratch/ from one
 * origin and framed, sandboxed (no allow-same-origin), by a host page on
 * another. It drives every emu/1 request, checks the replies and events,
 * the exam mode, the locks and that the page makes no request to any other
 * server, and measures the time from adding the iframe to `ready`.
 *
 *   npm run build:stucent
 *   node test/stucent-e2e/run.mjs [editorPort=4711] [hostPort=4712] [otherPort=4713]
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
// STUCENT_E2E_BUILD: check another build (e.g. an earlier release's tarball, to see a new check fail first).
const build = path.resolve(process.env.STUCENT_E2E_BUILD || path.resolve(here, '../../build-stucent'));
const [editorPort = '4711', hostPort = '4712', otherPort = '4713'] = process.argv.slice(2);
const EDITOR = `http://127.0.0.1:${editorPort}`;
const HOST = `http://127.0.0.1:${hostPort}`;
const OTHER = `http://127.0.0.1:${otherPort}`;

const servers = [
    spawn(process.execPath, [path.join(here, 'server.mjs'), editorPort, build, '/emulators/scratch/', `${HOST} ${OTHER}`]),
    spawn(process.execPath, [path.join(here, 'server.mjs'), hostPort, here, '/']),
    spawn(process.execPath, [path.join(here, 'server.mjs'), otherPort, here, '/'])
];
const stopServers = () => servers.forEach(s => s.kill());

let failures = 0;
const check = (name, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const COSTUME = {
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    name: 'c1',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0
};
// A small "catch the apple" project: the bowl moves right on the green flag, the apple falls.
const PROJECT = {
    targets: [
        {isStage: true,
            name: 'Stage',
            variables: {v1: ['score', 0]},
            lists: {},
            broadcasts: {},
            blocks: {},
            currentCostume: 0,
            costumes: [COSTUME],
            sounds: [],
            volume: 100},
        {isStage: false,
            name: 'Bowl',
            variables: {},
            lists: {},
            broadcasts: {},
            currentCostume: 0,
            costumes: [COSTUME],
            sounds: [],
            volume: 100,
            visible: true,
            x: 0,
            y: -150,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around',
            blocks: {
                top: {opcode: 'event_whenflagclicked',
                    next: 'rep',
                    parent: null,
                    inputs: {},
                    fields: {},
                    shadow: false,
                    topLevel: true,
                    x: 0,
                    y: 0},
                rep: {opcode: 'control_repeat',
                    next: 'say',
                    parent: 'top',
                    inputs: {TIMES: [1, [6, '10']],
                        SUBSTACK: [2, 'mv']},
                    fields: {},
                    shadow: false,
                    topLevel: false},
                mv: {opcode: 'motion_changexby',
                    next: 'sc',
                    parent: 'rep',
                    inputs: {DX: [1, [4, '10']]},
                    fields: {},
                    shadow: false,
                    topLevel: false},
                sc: {opcode: 'data_changevariableby',
                    next: null,
                    parent: 'mv',
                    inputs: {VALUE: [1, [4, '1']]},
                    fields: {VARIABLE: ['score', 'v1']},
                    shadow: false,
                    topLevel: false},
                say: {opcode: 'looks_say',
                    next: null,
                    parent: 'rep',
                    inputs: {MESSAGE: [1, [10, 'done']]},
                    fields: {},
                    shadow: false,
                    topLevel: false}
            }},
        {isStage: false,
            name: 'Apple',
            variables: {},
            lists: {},
            broadcasts: {},
            currentCostume: 0,
            costumes: [COSTUME],
            sounds: [],
            volume: 100,
            visible: true,
            x: 50,
            y: 170,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around',
            blocks: {}}
    ],
    monitors: [],
    extensions: [],
    meta: {semver: '3.0.0', vm: '0.2.0', agent: ''}
};
const SCRIPT = {
    k1: {opcode: 'event_whenkeypressed',
        next: 'k2',
        parent: null,
        inputs: {},
        fields: {KEY_OPTION: ['right arrow', null]},
        shadow: false,
        topLevel: true,
        x: 300,
        y: 0},
    k2: {opcode: 'motion_changexby',
        next: null,
        parent: 'k1',
        inputs: {DX: [1, [4, '5']]},
        fields: {},
        shadow: false,
        topLevel: false}
};

// A solid red backdrop, sent with the project as {json, assets}: what a readonly stage must show at once.
const RED_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">' +
    '<rect width="480" height="360" fill="#e0301e"/></svg>';
const RED_ID = 'c209fb1b469ecd827b4e2c86317a8ebf';
const RED_PROJECT = {
    ...PROJECT,
    targets: PROJECT.targets.map(t => (t.isStage ?
        {...t,
            costumes: [{assetId: RED_ID,
                name: 'red',
                md5ext: `${RED_ID}.svg`,
                dataFormat: 'svg',
                rotationCenterX: 240,
                rotationCenterY: 180}]} :
        t))
};

/**
 * A colour of the editor's stage, read from a screenshot (a WebGL canvas cannot be read back).
 * @param {object} page the host page
 * @returns {Promise<number[]>} [r, g, b]
 */
const stagePixel = async page => {
    const frame = page.frames().find(f => f.url().includes('/emulators/scratch/'));
    const png = (await frame.locator('canvas').first()
        .screenshot()).toString('base64');
    return page.evaluate(async b64 => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        // Off the centre: the sprites sit on the centre line.
        return Array.from(ctx.getImageData(Math.floor(img.width * 0.2), Math.floor(img.height * 0.2), 1, 1).data.slice(0, 3));
    }, png);
};
// Red, also under the player's green flag overlay (which dims the stage); the blank project is grey.
const isRed = ([r, g, b]) => r > 120 && r > 3 * g && r > 3 * b;

const openHost = async (browser, query) => {
    const context = await browser.newContext({viewport: {width: 1300, height: 820}});
    const page = await context.newPage();
    const outside = [];
    const problems = [];
    page.on('request', r => {
        const u = new URL(r.url());
        if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !['data:', 'blob:'].includes(u.protocol)) outside.push(r.url());
    });
    page.on('console', m => {
        const t = m.text();
        if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(t)) problems.push(t);
    });
    await page.goto(`${HOST}/host.html?${query}`);
    return {context, page, outside, problems};
};

const waitReady = async page => {
    await page.waitForFunction(() => window.timing.ready !== null, null, {timeout: 60000});
    return page.evaluate(() => window.timing.ready - window.timing.start);
};

const emu = (page, type, payload = {}) => page.evaluate(([t, p]) => window.emu(t, p), [type, payload]);
const events = (page, type) => page.evaluate(t => window.events.filter(e => e.type === t), type);
const editorFrame = page => page.frames().find(f => f.url().includes('/emulators/scratch/'));

const main = async () => {
    await sleep(500);
    const browser = await chromium.launch();
    try {
        // ── Cold load time: a fresh context (empty cache) each time ─────────
        const times = [];
        for (let i = 0; i < 3; i++) {
            const {context, page} = await openHost(browser, `editor=${encodeURIComponent(EDITOR)}`);
            times.push(await waitReady(page));
            await context.close();
        }
        times.sort((a, b) => a - b);
        console.log(`load to ready (cold, ms): ${times.map(t => Math.round(t)).join(', ')}; median ${Math.round(times[1])}`);

        const {page, outside, problems} = await openHost(browser, `editor=${encodeURIComponent(EDITOR)}`);
        await waitReady(page);
        const [ready] = await events(page, 'ready');
        check('ready announces version, upstream commit and features',
            ready.version && ready.upstream && ready.upstream.length === 40 && ready.features.includes('applyBlocks'));

        let r = await emu(page, 'getState');
        check('getState on the blank project: one ball sprite, no cat',
            r.ok && r.sprites.length === 1 && r.sprites[0].name === 'Sprite1' && r.sprites[0].costume === 'ball');

        r = await emu(page, 'load', {project: PROJECT, locks: {sprites: [], scripts: [{sprite: 'Bowl', topId: 'top'}]}});
        check('load project.json with a locked script', r.ok, r.error);
        r = await emu(page, 'getState');
        check('getState after load', r.ok && r.sprites.map(s => s.name).join() === 'Bowl,Apple' && r.sprites[0].y === -150);

        await emu(page, 'greenFlag');
        await sleep(1500);
        r = await emu(page, 'getState');
        check('greenFlag runs the project', r.sprites[0].x === 100 && r.stage.variables.score === 10 &&
            r.sprites[0].say === 'done', JSON.stringify(r.sprites[0]));
        const running = await events(page, 'running');
        check('running events', running.some(e => e.running === true) && running.some(e => e.running === false));
        r = await emu(page, 'stop');
        check('stop', r.ok);

        r = await emu(page, 'applyBlocks', {target: 'Bowl', blocks: SCRIPT, x: 300, y: 10});
        check('applyBlocks adds a script', r.ok && typeof r.topId === 'string' && typeof r.undo === 'string', r.error);
        const added = r;
        let p = await emu(page, 'getProject');
        const bowlBlocks = p.json.targets.find(t => t.name === 'Bowl').blocks;
        check('the added script is in the project', !!bowlBlocks[added.topId] &&
            bowlBlocks[added.topId].opcode === 'event_whenkeypressed');
        const hostEdit = (await events(page, 'edit')).find(e => e.detail === 'host');
        check('applyBlocks is logged as a host edit', hostEdit && hostEdit.kind === 'block.create' && hostEdit.target === 'Bowl');
        r = await emu(page, 'undo', {token: added.undo});
        p = await emu(page, 'getProject');
        check('undo removes it', r.ok && !p.json.targets.find(t => t.name === 'Bowl').blocks[added.topId]);
        r = await emu(page, 'applyBlocks', {target: 'Bowl', blocks: SCRIPT, replace: 'top'});
        check('a locked script is never replaced', !r.ok && /locked/.test(r.error), r.error);

        check('getProject gives .sb3 bytes, project.json and assets by md5ext',
            p.ok && p.sb3 instanceof Object && p.json.targets.length === 3 &&
            Object.keys(p.assets).includes('cd21514d0531fdffb22204e0ec5ed84a.svg'));
        const sizes = await page.evaluate(async () => {
            const res = await window.emu('getProject');
            return {sb3: res.sb3.byteLength, assets: Object.values(res.assets).map(a => a.byteLength)};
        });
        check('the .sb3 and assets arrive as bytes', sizes.sb3 > 200 && sizes.assets.every(n => n > 0), JSON.stringify(sizes));

        // Reload from each form the host may store.
        const reloads = await page.evaluate(async () => {
            const res = await window.emu('getProject');
            const out = {};
            out.sb3 = (await window.emu('load', {project: res.sb3})).ok;
            out.sb3State = (await window.emu('getState')).sprites.map(s => s.name).join();
            out.jsonAssets = (await window.emu('load', {project: {json: res.json, assets: res.assets}})).ok;
            out.missingAssets = (await window.emu('load', {project: {json: res.json, assets: {}}})).ok;
            out.missingState = (await window.emu('getState')).sprites.length;
            out.blank = (await window.emu('load', {project: null})).ok;
            out.bad = await window.emu('load', {project: 'not a project'});
            return out;
        });
        check('load .sb3 bytes', reloads.sb3 && reloads.sb3State === 'Bowl,Apple');
        check('load {json, assets}', reloads.jsonAssets);
        check('load {json, assets} with assets missing uses placeholders', reloads.missingAssets && reloads.missingState === 2);
        check('load null gives the blank project', reloads.blank);
        check('a bad project is refused with ok: false', reloads.bad.ok === false && !!reloads.bad.error);

        // ── Locks and the edit log through the editor's own UI ─────────────
        await emu(page, 'load', {project: PROJECT, locks: {sprites: ['Apple'], scripts: [{sprite: 'Bowl', topId: 'top'}]}});
        const frame = editorFrame(page);
        await frame.locator('[class*="sprite-selector-item_sprite-name"]', {hasText: 'Apple'}).first()
            .click();
        await sleep(300);
        check('a locked sprite is marked on its tile',
            await frame.locator('[class*="sprite-selector-item_sprite-name"]', {hasText: '\u{1F512}'}).count() === 1);
        const nameInput = frame.locator('input[class*="sprite-info_sprite-input"]').first();
        await nameInput.fill('Pear');
        await nameInput.press('Enter');
        await sleep(700);
        r = await emu(page, 'getState');
        const edits = await events(page, 'edit');
        check('renaming a locked sprite is refused and logged',
            r.sprites.some(s => s.name === 'Apple') && edits.some(e => e.kind === 'locked.refused' && e.target === 'Apple'));
        await frame.locator('[class*="sprite-selector-item_sprite-name"]', {hasText: 'Bowl'}).first()
            .click();
        await sleep(300);
        await nameInput.fill('Basket');
        await nameInput.press('Enter');
        await sleep(900);
        const edits2 = await events(page, 'edit');
        check('renaming an unlocked sprite is logged', edits2.some(e => e.kind === 'sprite.rename' && e.target === 'Basket'));
        check('changed is sent after an edit', (await events(page, 'changed')).length > 0);
        await sleep(300);
        check('locked script marked in the workspace', await frame.locator('.stucent-locked').count() > 0);

        // ── Modes ──────────────────────────────────────────────────────────
        const uploadsEdit = await frame.locator('input[type="file"]').count();
        r = await emu(page, 'setMode', {mode: 'exam'});
        await sleep(300);
        const uploadsExam = await frame.locator('input[type="file"]').count();
        check('exam mode removes every upload', r.ok && uploadsEdit > 0 && uploadsExam === 0, `${uploadsEdit} → ${uploadsExam}`);
        check('no library, tutorials or backpack', await frame.locator('[class*="backpack"]').count() === 0 &&
            await frame.locator('.tutorials-button').count() === 0);
        await emu(page, 'setMode', {mode: 'readonly'});
        await sleep(300);
        check('readonly shows the player only', await frame.locator('.blocklyWorkspace').count() === 0);
        await emu(page, 'setMode', {mode: 'edit'});
        r = await emu(page, 'fullscreen', {on: true});
        await sleep(300);
        check('fullscreen request and event', r.ok && (await events(page, 'fullscreen')).some(e => e.on === true));
        await emu(page, 'fullscreen', {on: false});
        r = await emu(page, 'setStageSize', {size: 'small'});
        await sleep(300);
        const smallBox = await frame.locator('canvas').first().boundingBox();
        check('a small stage is 240 px wide', r.ok && smallBox && Math.round(smallBox.width) === 240, JSON.stringify(smallBox));
        r = await emu(page, 'setStageSize', {size: 'huge'});
        check('an unknown stage size is refused', !r.ok);
        await emu(page, 'setStageSize', {size: 'normal'});
        r = await emu(page, 'setMode', {mode: 'root'});
        check('an unknown mode is refused', !r.ok);
        r = await emu(page, 'nonsense');
        check('an unknown request is refused', !r.ok);

        check('no request left the two local servers (no Scratch servers, no analytics)', outside.length === 0,
            outside.slice(0, 5).join(' '));
        check('no CSP violation or console error', problems.length === 0, problems.slice(0, 5).join(' | '));

        // ── Readonly (the review): a loaded project is drawn without the green flag (#10736) ──
        {
            const ro = await openHost(browser, `editor=${encodeURIComponent(EDITOR)}&mode=readonly`);
            await waitReady(ro.page);
            const loaded = await ro.page.evaluate(([json, svg, id]) => {
                const bytes = new TextEncoder().encode(svg).buffer;
                return window.emu('load', {project: {json, assets: {[`${id}.svg`]: bytes}}, mode: 'readonly'});
            }, [RED_PROJECT, RED_SVG, RED_ID]);
            await sleep(1200);
            const state = await emu(ro.page, 'getState');
            check('readonly load: the VM has the loaded sprites',
                loaded.ok && state.sprites.map(s => s.name).join() === 'Bowl,Apple', loaded.error);
            const colour = await stagePixel(ro.page);
            check('readonly load: the stage shows the loaded project before the green flag, not the blank one',
                isRed(colour), `stage pixel ${colour.join(',')}`);
            await ro.context.close();
        }

        // ── Exam: no File menu, so no Save to your computer (#10736) ───────
        {
            const ex = await openHost(browser, `editor=${encodeURIComponent(EDITOR)}&mode=exam`);
            await waitReady(ex.page);
            const f = editorFrame(ex.page);
            const fileMenus = await f.locator('[class*="menu-bar_menu-bar-item"]', {hasText: /^File$/}).count();
            check('exam mode has no File menu (no Save to your computer)', fileMenus === 0, `${fileMenus} File menu(s)`);
            await ex.context.close();
        }

        // ── Another origin cannot drive it ─────────────────────────────────
        const other = await openHost(browser, `editor=${encodeURIComponent(EDITOR)}&hostParam=${encodeURIComponent(OTHER)}`);
        // The editor waits for OTHER's messages; this page (HOST) is not it.
        await sleep(6000);
        const silent = await other.page.evaluate(() => Promise.race([
            window.emu('getState').then(() => 'answered'),
            new Promise(res => setTimeout(() => res('silent'), 1500))
        ]));
        check('a page at another origin gets no answer and no events', silent === 'silent' &&
            (await other.page.evaluate(() => window.events.length)) === 0);
    } finally {
        await browser.close();
        stopServers();
    }
    console.log(failures === 0 ? 'ALL PASSED' : `${failures} FAILED`);
    process.exit(failures === 0 ? 0 : 1);
};

main().catch(e => {
    console.error(e);
    stopServers();
    process.exit(1);
});
