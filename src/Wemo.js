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
'use strict';

var WemoClient = new require('wemo-client');

export default class Wemo {

    // set up a timer to check everything
    clients = {};
    wemo = new WemoClient();
    listener = null;
    pollTimer = null;
    enabled = true;

    constructor(listener) {
        console.error('[Wemo Plugin] ✅ Constructor called - starting discovery');
        this.listener = listener;
        this.pollDevices();
        this.pollTimer = setInterval(this.pollDevices.bind(this), 10000);
        console.error('[Wemo Plugin] Discovery interval set to 10 seconds');
    }

    setEnabled(enabled) {
        console.error('[Wemo Plugin] setEnabled:', enabled);
        this.enabled = enabled;
        if (!enabled && this.pollTimer) {
            console.error('[Wemo Plugin] Stopping discovery timer');
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        } else if (enabled && !this.pollTimer) {
            console.error('[Wemo Plugin] Starting discovery timer');
            this.pollDevices();
            this.pollTimer = setInterval(this.pollDevices.bind(this), 10000);
        }
    }

    // need to call this a few times (and every so often) to discover all devices, and devices may change.
    pollDevices() {
        if (!this.enabled) {
            console.error('[Wemo Plugin] ⏸️  pollDevices() skipped - plugin disabled');
            return;
        }

        console.error('[Wemo Plugin] 🔍 pollDevices() called - starting SSDP discovery...');

        // the callback MAY be called if an existing device changes, so we need to cope with that.
        this.wemo.discover(function(err, deviceInfo) {

            if (err) {
                // Check if this is a Maker device being passed as an error (wemo-client quirk)
                if (err.deviceType && err.deviceType === 'urn:Belkin:device:Maker:1') {
                    console.error('[Wemo Plugin] ℹ️  Skipping unsupported Maker device:', err.friendlyName || 'Unknown');
                    return;
                }

                // Log other real errors
                console.error('[Wemo Plugin] ❌ Discovery error:', err);
                console.error('[Wemo Plugin] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                return;
            }

            // Wrap device setup in try-catch to prevent one device from blocking others
            try {
                console.error('[Wemo Plugin] ✅✅✅ DEVICE FOUND:', deviceInfo.friendlyName, deviceInfo.serialNumber);
                console.error('[Wemo Plugin] Device details:', JSON.stringify(deviceInfo, null, 2));
                console.log('Wemo Device Found', deviceInfo.friendlyName, deviceInfo.serialNumber);

                // Get the client for the found device
                var client = this.wemo.client(deviceInfo);

                console.error('[Wemo Plugin] Created client for UDN:', client.UDN);
                this.clients[client.UDN] = client;

                // Only pass serializable device info, not the client instance
                this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                    [client.UDN]: {
                        type: 'wemo',
                        UDN: client.UDN,
                        friendlyName: deviceInfo.friendlyName,
                        modelName: deviceInfo.modelName,
                        modelNumber: deviceInfo.modelNumber,
                        serialNumber: deviceInfo.serialNumber,
                        deviceType: deviceInfo.deviceType,
                        host: deviceInfo.host,
                        port: deviceInfo.port,
                        state: null
                    }
                });

                // todo: how do we correctly replace and clean up?
                //var existing = clients[deviceInfo.serialNumber];
                //if (existing) {
                //    existing.on('error', null);
                //    existing.on('binaryState', null);
                //    //existing.destroy();
                //}

                client.on('error', function(err) {
                    console.log(deviceInfo.friendlyName, deviceInfo.serialNumber, 'Error: %s', err.code);
                });

                // Handle BinaryState events
                client.on('binaryState', function(value) {
                    console.log(client.device.friendlyName, ' changed to', value == 1 ? 'on' : 'off');

                    // Only pass serializable device info, not the client instance
                    this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                        [client.UDN]: {
                            type: 'wemo',
                            UDN: client.UDN,
                            friendlyName: client.device.friendlyName,
                            modelName: client.device.modelName,
                            modelNumber: client.device.modelNumber,
                            serialNumber: client.device.serialNumber,
                            deviceType: client.deviceType,
                            host: client.host,
                            port: client.port,
                            state: ( value == 1 )
                        }
                    });

                }.bind(this));
            } catch (deviceError) {
                console.error('[Wemo Plugin] ❌ Error setting up device:', deviceInfo.friendlyName || 'Unknown');
                console.error('[Wemo Plugin] Device setup error:', deviceError);
                // Continue with discovery - don't throw, just log and move on
            }
        }.bind(this));
    }

    setBinaryState(udn, binaryState) {
	    return new Promise((resolve, reject) => {
		    let client = this.clients[udn];
		    if (!client) {
			    return callback && reject(new Error('not visible'));
		    }
		    client.setBinaryState(binaryState, (err, result) => {
		    	console.log(err, result);
		    	if (err) {
				    return reject(err);
			    }
		    	resolve(result);
		    });
	    });
    }

    /**
     * Load a device by IP address using wemo.load() instead of discovery
     * Tries common Wemo ports (49153, 49152) if no port specified
     * @param {string} ipAddress - IP address of the device (can include port like "192.168.1.100:49153")
     * @returns {Promise<{success: boolean, deviceInfo?: object, error?: string}>}
     */
    loadDeviceByIP(ipAddress) {
        return new Promise((resolve) => {
            if (!ipAddress) {
                return resolve({ success: false, error: 'IP address is required' });
            }

            // Parse IP and port
            let ip = ipAddress.trim();
            let ports = [49153, 49152]; // Common Wemo ports

            // Check if port is included in the IP
            if (ip.includes(':')) {
                const parts = ip.split(':');
                ip = parts[0];
                const specifiedPort = parseInt(parts[1], 10);
                if (!isNaN(specifiedPort)) {
                    ports = [specifiedPort, ...ports.filter(p => p !== specifiedPort)];
                }
            }

            console.error(`[Wemo Plugin] 🔌 Attempting to load device at IP: ${ip}, ports: ${ports.join(', ')}`);

            // Try each port in sequence
            const tryPort = (portIndex) => {
                if (portIndex >= ports.length) {
                    console.error(`[Wemo Plugin] ❌ Failed to connect to device at ${ip} on any port`);
                    return resolve({
                        success: false,
                        error: `Could not connect to Wemo device at ${ip}. Tried ports: ${ports.join(', ')}`
                    });
                }

                const port = ports[portIndex];
                const setupUrl = `http://${ip}:${port}/setup.xml`;
                console.error(`[Wemo Plugin] 🔍 Trying ${setupUrl}...`);

                this.wemo.load(setupUrl, (err, deviceInfo) => {
                    if (err) {
                        console.error(`[Wemo Plugin] ⚠️  Port ${port} failed:`, err.message || err);
                        // Try next port
                        return tryPort(portIndex + 1);
                    }

                    try {
                        console.error(`[Wemo Plugin] ✅ Device found at ${ip}:${port}:`, deviceInfo.friendlyName);
                        console.error('[Wemo Plugin] Device details:', JSON.stringify(deviceInfo, null, 2));

                        // Get the client for the found device
                        const client = this.wemo.client(deviceInfo);
                        console.error('[Wemo Plugin] Created client for UDN:', client.UDN);

                        // Check if we already have this device
                        if (this.clients[client.UDN]) {
                            console.error('[Wemo Plugin] ℹ️  Device already known, updating...');
                        }

                        this.clients[client.UDN] = client;

                        // Notify listener about the new device - only serializable data
                        this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                            [client.UDN]: {
                                type: 'wemo',
                                UDN: client.UDN,
                                friendlyName: deviceInfo.friendlyName,
                                modelName: deviceInfo.modelName,
                                modelNumber: deviceInfo.modelNumber,
                                serialNumber: deviceInfo.serialNumber,
                                deviceType: deviceInfo.deviceType,
                                host: ip,
                                port: port,
                                state: null,
                                addedManually: true
                            }
                        });

                        // Set up event handlers (same as discovery)
                        client.on('error', (err) => {
                            console.log(deviceInfo.friendlyName, deviceInfo.serialNumber, 'Error: %s', err.code);
                        });

                        client.on('binaryState', (value) => {
                            console.log(client.device.friendlyName, ' changed to', value == 1 ? 'on' : 'off');

                            // Only pass serializable device info
                            this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                                [client.UDN]: {
                                    type: 'wemo',
                                    UDN: client.UDN,
                                    friendlyName: client.device.friendlyName,
                                    modelName: client.device.modelName,
                                    modelNumber: client.device.modelNumber,
                                    serialNumber: client.device.serialNumber,
                                    deviceType: client.deviceType,
                                    host: ip,
                                    port: port,
                                    state: (value == 1),
                                    addedManually: true
                                }
                            });
                        });

                        resolve({
                            success: true,
                            deviceInfo: {
                                UDN: client.UDN,
                                friendlyName: deviceInfo.friendlyName,
                                modelName: deviceInfo.modelName,
                                modelNumber: deviceInfo.modelNumber,
                                serialNumber: deviceInfo.serialNumber,
                                ipAddress: ip,
                                port: port
                            }
                        });

                    } catch (setupError) {
                        console.error('[Wemo Plugin] ❌ Error setting up device:', setupError);
                        resolve({
                            success: false,
                            error: `Device found but setup failed: ${setupError.message}`
                        });
                    }
                });
            };

            // Start trying ports
            tryPort(0);
        });
    }

    /**
     * Get list of manually added devices (for persistence)
     * @returns {Array} List of manually added device info
     */
    getManualDevices() {
        return Object.values(this.clients)
            .filter(client => client.addedManually)
            .map(client => ({
                UDN: client.UDN,
                ipAddress: client.ipAddress,
                port: client.port
            }));
    }

}
