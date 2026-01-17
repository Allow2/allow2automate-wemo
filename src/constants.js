/**
 * Allow2 Developer Portal Device Token
 *
 * This token identifies the WeMo plugin in the Allow2 system.
 * Each plugin must register as a separate "device type" in the
 * Allow2 Developer Portal (https://developer.allow2.com) to
 * receive their own unique token.
 *
 * The token enables:
 * - Tracking device usage per plugin
 * - Plugin-specific analytics in the developer dashboard
 * - Proper device categorization in Allow2
 */
const PLUGIN_TOKEN = '2ndlJj1Mg2Pw8iHi';

/**
 * Device-specific tokens (legacy, for backwards compatibility)
 * New plugins should use a single PLUGIN_TOKEN for all device types.
 */
const deviceTokens = {
    LightSwitch: PLUGIN_TOKEN,
    Socket: PLUGIN_TOKEN,
    Maker: PLUGIN_TOKEN,
    Smart: PLUGIN_TOKEN,
    Bulb: PLUGIN_TOKEN
};

const deviceImages = {
    LightSwitch: 'wemo_lightswitch',
    Socket: 'wemo_switch',
    Maker: 'wemo_maker',
    Smart: 'wemo_smart_switch',
    Bulb: 'wemo_bulb'
};

export {
    deviceTokens,
    deviceImages
};