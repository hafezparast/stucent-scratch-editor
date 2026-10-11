/**
 * The editor page StuCent embeds ("Block game studio", compatible with
 * Scratch 3 projects). Built by `BUILD_TYPE=stucent` (webpack.config.js) into
 * a static folder served at any path. See PROTOCOL.md for the bridge.
 */
// Polyfills
import 'es6-object-assign/auto';
import 'core-js/fn/array/includes';
import 'core-js/fn/promise/finally';
import 'intl'; // For Safari 9

import React from 'react';
import {createRoot} from 'react-dom/client';
import locales from 'scratch-l10n';

import './stucent.raw.css';
import {setPolicy} from './policy';
import {parseParams} from './params';
import {StucentStorage} from './storage';
import supportedBrowser from '../lib/supported-browser';

const params = parseParams(window.location.search, Object.keys(locales));

setPolicy({active: true, mode: params.mode, libraries: !!params.assetHost});

const appTarget = document.createElement('div');
appTarget.className = 'stucent-app';
document.body.appendChild(appTarget);

if (supportedBrowser()) {
    // Required here, not imported: the VM must not load in a browser that cannot run it.
    const {mountEditor} = require('./mount.jsx');
    mountEditor(appTarget, params, new StucentStorage({assetHost: params.assetHost}));
} else {
    createRoot(appTarget).render(
        <p style={{fontFamily: 'sans-serif', padding: '2rem'}}>
            {'This browser cannot run the block editor. Please use a recent Chrome, Edge, Firefox or Safari.'}
        </p>
    );
}
