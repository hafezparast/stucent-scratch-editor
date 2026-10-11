import React from 'react';
import PropTypes from 'prop-types';
import {SOURCE_URL} from './constants';

const labelStyle = {fontWeight: 'bold', whiteSpace: 'nowrap'};
const sourceStyle = {color: 'inherit', fontSize: '0.7rem', marginLeft: '0.5rem', opacity: 0.85};

/**
 * The menu bar's name in StuCent: a plain label (no Scratch logo, per the
 * Scratch TRADEMARK file) and the link to this modified version's source.
 * @param {object} props component props
 * @param {string} props.className class for the wrapper
 * @returns {React.ReactElement} the brand
 */
const StucentBrand = ({className}) => (
    <div className={className}>
        <span style={labelStyle}>{'Block game studio'}</span>
        <a
            href={SOURCE_URL}
            rel="noopener noreferrer"
            style={sourceStyle}
            target="_blank"
            title={`Source code (AGPL-3.0): ${SOURCE_URL}`}
        >
            {'Source (AGPL)'}
        </a>
    </div>
);

StucentBrand.propTypes = {
    className: PropTypes.string
};

export default StucentBrand;
