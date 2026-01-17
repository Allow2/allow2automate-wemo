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

        console.error('[Wemo Plugin] Creating Wemo discovery instance...');
        devices = new Wemo({
            onDeviceUpdate: (data) => {
                console.error('[Wemo Plugin] 📡 Device update callback:', Object.keys(data));
                console.log('deviceUpdate', data, state);
                const devices = Object.assign(state.devices, data);
                state = Object.assign(state, { devices: devices });
                context.configurationUpdate(state);
            }
        });

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
            const { err, response } = devices.setBinaryState(params.UDN, params.state);

            console.log('response:', params.UDN, err, response);

            if (err) {
            	return [err];
            }
            if (response.BinaryState === undefined) {
            	return [new Error('Unknown Error')];
            }

            // Update device state (devices now store serializable info only)
            if (state.devices[params.UDN]) {
                state.devices[params.UDN].state = ( response.BinaryState != '0' );
                context.configurationUpdate(state);
            }
			return [null, "ok"];
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
        // nop
    };

    //
    // onUnload (optional): called if the user is (removing) deleting the plugin, use this to clean up before the plugin disappears
    //
    wemo.onUnload = function(callback) {
        console.log('wemo.onUnload');
        // nop
        callback(null);
    };

    return wemo;
}

module.exports = {
    plugin,
    TabContent,
    requiresMainProcess: true  // Wemo needs main process for SSDP device discovery
};