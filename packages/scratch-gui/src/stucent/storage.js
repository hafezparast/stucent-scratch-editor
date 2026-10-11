/**
 * Storage for the editor in StuCent. Nothing is fetched from or saved to
 * Scratch's servers: the project comes from the host over the bridge, the
 * blank project and its assets are built in, and the music extension's
 * sounds are bundled. With an `assetHost` URL parameter (a self-hosted
 * library mirror, `<assetHost>/<md5>.<ext>`), assets and library thumbnails
 * are read from there; without one the libraries stay hidden (policy.js).
 */
import {ScratchStorage} from '@scratch/scratch-storage';
import {blankProjectAssets} from './blank-project';

/** project.json data formats → storage asset types. */
const ASSET_KINDS = Object.freeze({
    svg: ['ImageVector', 'SVG'],
    png: ['ImageBitmap', 'PNG'],
    jpg: ['ImageBitmap', 'JPG'],
    jpeg: ['ImageBitmap', 'JPG'],
    wav: ['Sound', 'WAV'],
    mp3: ['Sound', 'MP3']
});

class StucentStorage {
    constructor ({assetHost = null} = {}) {
        this.assetHost = assetHost;
        this.scratchStorage = new ScratchStorage();
        blankProjectAssets().forEach(asset => this.scratchStorage.cache(
            this.scratchStorage.AssetType[asset.assetType],
            this.scratchStorage.DataFormat[asset.dataFormat],
            asset.data,
            asset.id
        ));
        if (assetHost) {
            const s = this.scratchStorage;
            s.addWebSource(
                [s.AssetType.ImageVector, s.AssetType.ImageBitmap, s.AssetType.Sound],
                asset => `${assetHost}/${asset.assetId}.${asset.dataFormat}`
            );
        }
    }

    /**
     * Put the host's assets (md5ext → bytes) in storage before a project that uses them loads.
     * @param {Record<string, ArrayBuffer|Uint8Array>} assets assets by md5ext ("<md5>.<ext>")
     * @returns {number} how many were cached
     */
    cacheAssets (assets) {
        let n = 0;
        Object.keys(assets || {}).forEach(md5ext => {
            const match = /^([0-9a-f]{32})\.([a-z0-9]+)$/i.exec(md5ext);
            const kind = match && ASSET_KINDS[match[2].toLowerCase()];
            if (!kind) return;
            const s = this.scratchStorage;
            const data = assets[md5ext] instanceof Uint8Array ? assets[md5ext] : new Uint8Array(assets[md5ext]);
            s.cache(s.AssetType[kind[0]], s.DataFormat[kind[1]], data, match[1].toLowerCase());
            n++;
        });
        return n;
    }

    getLibraryAssetUrl (assetId, dataFormat) {
        return this.assetHost ? `${this.assetHost}/${assetId}.${dataFormat}` : '';
    }

    // The GUI calls these with Scratch's hosts; they are ignored on purpose.
    setProjectHost () {}
    setProjectToken () {}
    setProjectMetadata () {}
    setAssetHost () {}
    setTranslatorFunction () {}
    setBackpackHost () {}

    saveProject () {
        return Promise.reject(new Error('Projects are saved by StuCent, not to a server'));
    }
}

export {ASSET_KINDS, StucentStorage};
