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

    constructor(listener) {
        this.listener = listener;
        this.pollDevices();
        setInterval(this.pollDevices.bind(this), 10000);
    }

    // need to call this a few times (and every so often) to discover all devices, and devices may change.
    pollDevices() {

        // the callback MAY be called if an existing device changes, so we need to cope with that.
        this.wemo.discover(function(err, deviceInfo) {

            if (err) {
                console.log('discovery error', err);
                return;
            }

            console.log('Wemo Device Found', deviceInfo.friendlyName, deviceInfo.serialNumber);

            // Get the client for the found device
            var client = this.wemo.client(deviceInfo);

            this.clients[client.UDN] = client;

            this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                [client.UDN]: {
                    type: 'wemo',
                    device: client,
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

                this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                    [client.UDN]: {
                        type: 'wemo',
                        device: client,
                        state: ( value == 1 )
                    }
                });

            }.bind(this));
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

}
