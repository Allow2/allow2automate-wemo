// Copyright [2021] [Allow2 Pty Ltd]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

//
// designed to really only be used from the main process (though the renderer also loads this module in order to load the TabContent component).
//
'use strict';
import TabContent from './Components/TabContent';
import Wemo from './Wemo';

function plugin(context) {

    var wemo = {};

    var devices = null;
    var state = null;
    var usagePollingTimer = null;
    const USAGE_POLL_INTERVAL = 10000; // 10 seconds, same as legacy

    /**
     * Check device usage with Allow2 via main app conduit
     * Uses global.services.checkDeviceUsage() which is exposed by main.js
     * @param {string} UDN - Device unique identifier
     * @param {boolean} log - Whether to log usage (true) or just check (false)
     * @returns {Promise<{allowed: boolean, error?: string}>}
     */
    async function checkDeviceUsage(UDN, log = false) {
        try {
            // Use global.services.checkDeviceUsage() exposed by main.js
            // This is the conduit for plugins to report usage to Allow2
            if (!global.services || !global.services.checkDeviceUsage) {
                console.error('[Wemo Plugin] checkDeviceUsage service not available yet');
                return { allowed: true, error: 'Service not ready' }; // Allow on error
            }

            const result = await global.services.checkDeviceUsage({
                UDN: UDN,
                pluginName: 'allow2automate-wemo',
                activityId: 7,  // Activity ID for devices
                log: log
            });

            if (!result.success) {
                console.error(`[Wemo Plugin] checkDeviceUsage failed for ${UDN}:`, result.error);

                // If pairing is invalid, remove it
                if (result.invalidPairing && state.pairings && state.pairings[UDN]) {
                    console.error(`[Wemo Plugin] Removing invalid pairing for ${UDN}`);
                    const newPairings = { ...state.pairings };
                    delete newPairings[UDN];
                    state = { ...state, pairings: newPairings };
                    context.configurationUpdate(state);
                }

                return { allowed: true, error: result.error }; // Allow on error to avoid blocking user
            }

            return { allowed: result.allowed, result: result.result };
        } catch (err) {
            console.error(`[Wemo Plugin] checkDeviceUsage exception for ${UDN}:`, err);
            return { allowed: true, error: err.message }; // Allow on error
        }
    }

    /**
     * Enforce usage: turn off device if not allowed
     * @param {string} UDN - Device unique identifier
     */
    async function enforceUsage(UDN) {
        const device = state.devices && state.devices[UDN];
        if (!device) return;

        try {
            console.log(`[Wemo Plugin] Enforcing: turning off ${device.friendlyName}`);
            await devices.setBinaryState(UDN, 0);

            // Update local state
            if (state.devices[UDN]) {
                state.devices[UDN] = { ...state.devices[UDN], state: false };
                state = { ...state, devices: { ...state.devices } };
                context.configurationUpdate(state);
            }
        } catch (err) {
            console.error(`[Wemo Plugin] Failed to turn off ${device.friendlyName}:`, err);
        }
    }

    /**
     * Handle device state change - check Allow2 when device turns ON
     * @param {string} UDN - Device unique identifier
     * @param {object} deviceData - Device data including state
     */
    async function handleDeviceStateChange(UDN, deviceData) {
        // Only check when device turns ON
        if (!deviceData.state) return;

        // Only check if device is paired
        const pairing = state.pairings && state.pairings[UDN];
        if (!pairing) {
            console.log(`[Wemo Plugin] Device ${deviceData.friendlyName} turned ON but not paired, skipping usage check`);
            return;
        }

        console.log(`[Wemo Plugin] Device ${deviceData.friendlyName} turned ON, checking Allow2 (log: false)...`);

        // Initial check without logging
        const checkResult = await checkDeviceUsage(UDN, false);

        if (!checkResult.allowed) {
            console.log(`[Wemo Plugin] Device ${deviceData.friendlyName} NOT ALLOWED, enforcing...`);
            await enforceUsage(UDN);
        } else {
            console.log(`[Wemo Plugin] Device ${deviceData.friendlyName} is allowed`);
        }
    }

    /**
     * Poll usage for all ON devices with pairings
     * Called every 10 seconds to report usage and enforce limits
     */
    async function pollUsage() {
        if (!state || !state.devices || !state.pairings) return;

        // Find all ON devices that are paired
        const onDevices = Object.entries(state.devices).filter(([udn, device]) => {
            return device.state === true && state.pairings[udn];
        });

        if (onDevices.length === 0) return;

        console.log(`[Wemo Plugin] Polling usage for ${onDevices.length} ON device(s)...`);

        for (const [udn, device] of onDevices) {
            try {
                // Check AND log usage (log: true)
                const checkResult = await checkDeviceUsage(udn, true);

                if (!checkResult.allowed) {
                    console.log(`[Wemo Plugin] ${device.friendlyName} NOT ALLOWED during poll, enforcing...`);
                    await enforceUsage(udn);
                } else {
                    console.log(`[Wemo Plugin] ${device.friendlyName} usage logged, still allowed`);
                }
            } catch (err) {
                console.error(`[Wemo Plugin] Error polling usage for ${device.friendlyName}:`, err);
            }
        }
    }

    //
    // onLoad (advisable): called on the main process when this plugin is loaded, the existing configuration is supplied if it exists
    //
    wemo.onLoad = function(loadState) {
        console.error('[Wemo Plugin] ✅ onLoad called in main process');
        console.log('wemo.onload', loadState);

        // Initialize state with devices object
        state = loadState || {};
        if (!state.devices) {
            state.devices = {};
        }
        if (!state.pairings) {
            state.pairings = {};
        }

        console.error('[Wemo Plugin] Creating Wemo discovery instance...');
        devices = new Wemo({
            onDeviceUpdate: (data) => {
                console.error('[Wemo Plugin] 📡 Device update callback:', Object.keys(data));
                // Log the incoming state change and check for ON transitions
                for (const [udn, deviceData] of Object.entries(data)) {
                    const previousState = state.devices[udn] && state.devices[udn].state;
                    console.error(`[Wemo Plugin] Device ${deviceData.friendlyName} state update: ${previousState} -> ${deviceData.state}`);

                    // Check if device just turned ON (state changed from false/null to true)
                    if (deviceData.state === true && previousState !== true) {
                        // Handle state change asynchronously (don't block the update)
                        handleDeviceStateChange(udn, deviceData).catch(err => {
                            console.error(`[Wemo Plugin] Error handling state change for ${deviceData.friendlyName}:`, err);
                        });
                    }
                }
                // Create NEW objects to ensure React detects the state change
                const newDevices = { ...state.devices, ...data };
                state = { ...state, devices: newDevices };
                console.error('[Wemo Plugin] Calling configurationUpdate with state.devices:',
                    Object.entries(state.devices).map(([k,v]) => `${v.friendlyName}: state=${v.state}`).join(', '));
                context.configurationUpdate(state);
            }
        });

        // Start usage polling timer (every 10 seconds like legacy)
        console.error('[Wemo Plugin] Starting usage polling timer (every 10s)...');
        usagePollingTimer = setInterval(pollUsage, USAGE_POLL_INTERVAL);

        console.error('[Wemo Plugin] Wemo instance created, discovery should be running');

        // Reload any manually added devices from saved state
        if (state.manualDevices && state.manualDevices.length > 0) {
            console.error('[Wemo Plugin] 🔄 Reloading', state.manualDevices.length, 'manually added devices...');
            for (const manualDevice of state.manualDevices) {
                const ipWithPort = manualDevice.port
                    ? `${manualDevice.ipAddress}:${manualDevice.port}`
                    : manualDevice.ipAddress;
                console.error('[Wemo Plugin] Reloading device:', manualDevice.friendlyName || ipWithPort);
                devices.loadDeviceByIP(ipWithPort).then(result => {
                    if (result.success) {
                        console.error('[Wemo Plugin] ✅ Successfully reloaded:', result.deviceInfo.friendlyName);
                    } else {
                        console.error('[Wemo Plugin] ⚠️  Failed to reload device at', ipWithPort, ':', result.error);
                    }
                }).catch(err => {
                    console.error('[Wemo Plugin] ❌ Error reloading device:', err);
                });
            }
        }

        console.log('context', context);
        context.ipcMain.handle('setBinaryState', async function(event, params) {
            console.log('main setBinaryState', params);
            try {
                const response = await devices.setBinaryState(params.UDN, params.state);
                console.log('response:', params.UDN, response);

                if (!response || response.BinaryState === undefined) {
                    return [new Error('Unknown Error')];
                }

                // Update device state (devices now store serializable info only)
                if (state.devices[params.UDN]) {
                    state.devices[params.UDN].state = (response.BinaryState != '0');
                    context.configurationUpdate(state);
                }
                return [null, "ok"];
            } catch (err) {
                console.log('error:', params.UDN, err);
                return [err.message || err];
            }
        });

        // Handler for adding a device by IP address
        context.ipcMain.handle('addDeviceByIP', async function(event, params) {
            console.log('[Wemo Plugin] addDeviceByIP called with:', params);

            if (!params || !params.ipAddress) {
                return [null, { success: false, error: 'IP address is required' }];
            }

            try {
                const result = await devices.loadDeviceByIP(params.ipAddress);
                console.log('[Wemo Plugin] loadDeviceByIP result:', result);

                if (result.success) {
                    // Store the manual device info for persistence
                    if (!state.manualDevices) {
                        state.manualDevices = [];
                    }

                    // Check if already in manual devices list
                    const existingIndex = state.manualDevices.findIndex(
                        d => d.ipAddress === result.deviceInfo.ipAddress
                    );
                    if (existingIndex >= 0) {
                        state.manualDevices[existingIndex] = {
                            ipAddress: result.deviceInfo.ipAddress,
                            port: result.deviceInfo.port,
                            UDN: result.deviceInfo.UDN,
                            friendlyName: result.deviceInfo.friendlyName
                        };
                    } else {
                        state.manualDevices.push({
                            ipAddress: result.deviceInfo.ipAddress,
                            port: result.deviceInfo.port,
                            UDN: result.deviceInfo.UDN,
                            friendlyName: result.deviceInfo.friendlyName
                        });
                    }

                    context.configurationUpdate(state);
                }

                return [null, result];
            } catch (error) {
                console.error('[Wemo Plugin] Error in addDeviceByIP:', error);
                return [null, { success: false, error: error.message }];
            }
        });

        // Handler to remove a manually added device
        context.ipcMain.handle('removeManualDevice', async function(event, params) {
            console.log('[Wemo Plugin] removeManualDevice called with:', params);

            if (!params || !params.ipAddress) {
                return [null, { success: false, error: 'IP address is required' }];
            }

            if (state.manualDevices) {
                state.manualDevices = state.manualDevices.filter(
                    d => d.ipAddress !== params.ipAddress
                );
                context.configurationUpdate(state);
            }

            return [null, { success: true }];
        });

        // Handler to get list of manually added devices
        context.ipcMain.handle('getManualDevices', async function(event) {
            return [null, { devices: state.manualDevices || [] }];
        });
    };

    //
    // newState (advisable): called on the main process when the persisted state is updated
    //
    wemo.newState = function(newState) {
        state = newState;
        console.log('wemo.newState', newState);
    };

    //
    // onSetEnabled (optional): called by the electron main process when this plugin is enabled/disabled
    //
    wemo.onSetEnabled = function(enabled) {
        console.log('wemo.onSetEnabled', enabled);

        if (enabled) {
            // Start usage polling if not already running
            if (!usagePollingTimer) {
                console.log('[Wemo Plugin] Starting usage polling timer');
                usagePollingTimer = setInterval(pollUsage, USAGE_POLL_INTERVAL);
            }
            // Enable device discovery
            if (devices) {
                devices.setEnabled(true);
            }
        } else {
            // Stop usage polling
            if (usagePollingTimer) {
                console.log('[Wemo Plugin] Stopping usage polling timer');
                clearInterval(usagePollingTimer);
                usagePollingTimer = null;
            }
            // Disable device discovery
            if (devices) {
                devices.setEnabled(false);
            }
        }
    };

    //
    // onUnload (optional): called if the user is (removing) deleting the plugin, use this to clean up before the plugin disappears
    //
    wemo.onUnload = function(callback) {
        console.log('wemo.onUnload');

        // Stop usage polling timer
        if (usagePollingTimer) {
            console.log('[Wemo Plugin] Cleaning up usage polling timer');
            clearInterval(usagePollingTimer);
            usagePollingTimer = null;
        }

        callback(null);
    };

    return wemo;
}

module.exports = {
    plugin,
    TabContent,
    requiresMainProcess: true  // Wemo needs main process for SSDP device discovery
};