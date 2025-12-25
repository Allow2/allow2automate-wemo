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
        console.log('wemo.onload', state);
        state = loadState;

        devices = new Wemo({
            onDeviceUpdate: (data) => {
                console.log('deviceUpdate', data, state);
                const devices = Object.assign(state.devices, data);
                state = Object.assign(state, { devices: devices });
                context.configurationUpdate(state);
            }
        });

        console.log('context', context);
        context.ipcMain.on('setBinaryState', async function(event, params) {
            console.log('main setBinaryState', params);
            const { err, response } = devices.setBinaryState(params.UDN, params.state);

            console.log('response:', params.UDN, err, response);

            if (err) {
            	return [err];
            }
            if (response.BinaryState === undefined) {
            	return [new Error('Unknown Error')];
            }

            var device = state.devices[params.UDN];
            device.active = false;
            device.state = ( response.BinaryState != '0' );
            const devices = Object.assign(state.devices, {[params.UDN]: device} );
            state = Object.assign(state, { devices: devices });
            context.configurationUpdate(state);
			return [null, "ok"];
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
    TabContent
};