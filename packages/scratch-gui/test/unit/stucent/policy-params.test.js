import {
    filterActionMenu,
    isExtensionAllowed,
    projectReplaceAllowed,
    setPolicy,
    uploadsAllowed
} from '../../../src/stucent/policy';
import {mapLocale, parseOrigin, parseParams} from '../../../src/stucent/params';

const SUPPORTED = ['en', 'ar', 'de', 'es', 'fa', 'fr', 'id', 'ja', 'ko', 'pt', 'pt-br', 'ru', 'sw', 'tr', 'vi', 'zh-cn'];

const library = () => {};
const paint = () => {};
const upload = () => {};
const surprise = () => {};
const menu = {
    img: 'library.svg',
    title: 'Choose a Sprite',
    onClick: library,
    moreButtons: [
        {title: 'Upload', img: 'u.svg', onClick: upload, stucentKind: 'upload'},
        {title: 'Surprise', img: 's.svg', onClick: surprise, stucentKind: 'surprise'},
        {title: 'Paint', img: 'p.svg', onClick: paint, stucentKind: 'paint'},
        {title: 'Choose a Sprite', img: 'l.svg', onClick: library, stucentKind: 'library'}
    ]
};

const policy = patch => ({active: true, mode: 'edit', libraries: false, locks: {sprites: [], scripts: []}, ...patch});

describe('StuCent policy', () => {
    afterEach(() => setPolicy({active: false, mode: 'edit', libraries: false, locks: {sprites: [], scripts: []}}));

    test('outside StuCent nothing is filtered', () => {
        expect(filterActionMenu(menu, policy({active: false}))).toBe(menu);
        expect(isExtensionAllowed('translate', policy({active: false}))).toBe(true);
    });

    test('without a library mirror the library and surprise buttons go and paint becomes the main button', () => {
        const out = filterActionMenu(menu, policy());
        expect(out.onClick).toBe(paint);
        expect(out.title).toBe('Paint');
        expect(out.moreButtons.map(b => b.stucentKind)).toEqual(['upload', 'paint']);
    });

    test('an exam also removes uploads', () => {
        const out = filterActionMenu(menu, policy({mode: 'exam'}));
        expect(out.moreButtons.map(b => b.stucentKind)).toEqual(['paint']);
        expect(uploadsAllowed(policy({mode: 'exam'}))).toBe(false);
    });

    test('a menu with nothing left is not shown', () => {
        const onlyLibrary = {...menu, moreButtons: [menu.moreButtons[3]]};
        expect(filterActionMenu(onlyLibrary, policy())).toBeNull();
    });

    test('only pen and music load; online and hardware extensions are refused', () => {
        ['pen', 'music'].forEach(id => expect(isExtensionAllowed(id, policy())).toBe(true));
        ['translate', 'text2speech', 'videoSensing', 'faceSensing', 'microbit', 'ev3', 'wedo2', 'boost', 'gdxfor',
            'https://example.com/ext.js', null].forEach(id => expect(isExtensionAllowed(id, policy())).toBe(false));
    });

    test('the project cannot be replaced in an exam or over locked items', () => {
        expect(projectReplaceAllowed(policy())).toBe(true);
        expect(projectReplaceAllowed(policy({mode: 'exam'}))).toBe(false);
        expect(projectReplaceAllowed(policy({locks: {sprites: ['Bowl'], scripts: []}}))).toBe(false);
    });

    test('setPolicy refuses an unknown mode', () => {
        expect(() => setPolicy({mode: 'admin'})).toThrow('Unknown mode');
    });
});

describe('StuCent URL parameters', () => {
    test('host must be a bare http(s) origin', () => {
        expect(parseOrigin('https://stucent.example')).toBe('https://stucent.example');
        expect(parseOrigin('http://localhost:5222')).toBe('http://localhost:5222');
        expect(parseOrigin('https://stucent.example/path')).toBeNull();
        expect(parseOrigin('ftp://stucent.example')).toBeNull();
        expect(parseOrigin('*')).toBeNull();
        expect(parseOrigin(null)).toBeNull();
    });

    test('StuCent locales map to the nearest editor locale', () => {
        expect(mapLocale('zh', SUPPORTED)).toBe('zh-cn');
        expect(mapLocale('pt', SUPPORTED)).toBe('pt-br');
        expect(mapLocale('ms', SUPPORTED)).toBe('id');
        expect(mapLocale('ta', SUPPORTED)).toBe('en');
        expect(mapLocale('fa', SUPPORTED)).toBe('fa');
        expect(mapLocale('xx', SUPPORTED)).toBe('en');
        expect(mapLocale(null, SUPPORTED)).toBe('en');
    });

    test('parseParams reads host, mode and locale', () => {
        expect(parseParams('?host=https%3A%2F%2Fa.example&mode=exam&locale=ar', SUPPORTED)).toEqual({
            host: 'https://a.example', mode: 'exam', locale: 'ar', assetHost: null
        });
        expect(parseParams('?mode=root', SUPPORTED).mode).toBe('edit');
    });
});
