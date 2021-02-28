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

import React, { Component, PropTypes } from 'react';
const createReactClass = require('create-react-class');
import path from 'path';
import {
    Table,
    TableBody,
    // TableHeader,
    // TableHeaderColumn,
    TableRow,
    TableRowColumn,
} from 'material-ui/Table';
import {deviceTokens, deviceImages} from '../constants';

// import Dialogs from 'dialogs';
// import RaisedButton from 'material-ui/RaisedButton';
// import TextField from 'material-ui/TextField';
// import Avatar from 'material-ui/Avatar';
// import AppBar from 'material-ui/AppBar';
// import Person from 'material-ui/svg-icons/social/person';

// var dialogs = Dialogs({});

export default createReactClass({
//class TabContent extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };
    //var loadedPlugin = { missing: true, enabled: false };

    // getInitialState: function() {
    //     // return {
    //     //     pluginPath: this.props.pluginPath
    //     // };
    // },

    toggleCheckbox: (device, isChecked) => {
        // this.props.onDeviceActive( device.device.UDN, true );
        this.props.ipc.send('setBinaryState', {
            UDN: device.device.UDN,
            state: isChecked ? 1 : 0
        });
    },

    // componentDidMount: () => {
    //     this.props.ipc.on('setBinaryStateResponse', function (event, UDN, err, response) {
    //         let device = this.props.devices[UDN];
    //         this.props.onDeviceActive(UDN, false);
    //         if (err || ( response.BinaryState == undefined )) {
    //             return;
    //         }
    //         device.active = false;
    //         device.state = ( response.BinaryState != '0' );
    //         this.props.onDeviceUpdate({[UDN]: device});
    //     }.bind(this));
    // };


    assign: (device, token) => {
        //let onPaired = this.props.onPaired;
        //function openModal() {
        const remote = this.props.remote;
        let win = new remote.BrowserWindow({
            parent: remote.getCurrentWindow(),
            modal: true,
            width: 500,
            height: 600,
            minWidth: 500,
            maxWidth: 500,
            minHeight: 600,
            maxHeight: 800
        });

        //win.loadURL(theUrl);
        win.loadURL(url.format({
            pathname: path.join(__dirname, '../pairModal.html'),
            protocol: 'file:',
            slashes: true
        }));

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('device', { device: device, token: token });
        });

        //win.webContents.openDevTools();
    },


    render: function() {
        if (!this.props || !this.props.plugin || !this.props.data) {
            return (
                <div>
                    Loading...
                </div>
            );
        }

        var key = null;
        var savedDevices = {};
        var pairings = {};
        const allow2 = this.props.allow2;
        // get the data set, this plugin only uses one data set
        Object.entries(this.props.data || {}).forEach(([value, index]) => {
            console.log('entries', value, index);
            key = index;
            savedDevices = value.devices || {};
            pairings = value.pairings || {};
        });

        let devices = Object
            .values(savedDevices)
            .sort((a,b) => a.device.device.friendlyName.localeCompare(b.device.device.friendlyName))
            .reduce(function(memo, device) {

            let token = deviceTokens[device.device.device.modelName];
            if (token) {
                memo.supported.push(device);
            } else {
                memo.notSupported.push(device);
            }
            return memo;
        }, { supported: [], notSupported: [] });
        console.log('wemo TabContent', key, devices, pairings);

        const plugin = this.props.plugin;
        return (
            <div>
                { devices.supported.length < 1 &&
                <div style={{ textAlign: "center" }}>
                    <h1>No Devices Found</h1>
                    <p style={{ width:"75%", margin: "auto" }}>Allow2Automate will auto-discover Wemo devices on your network and list them here when found.</p>
                </div>
                }
                { devices.supported.length > 0 &&
                <Table>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { devices.supported.map(function (device) {
                                let token = deviceTokens[device.device.device.modelName];
                                let imageName = deviceImages[device.device.device.modelName];
                                let paired = pairings[device.device.UDN];
                                let child = paired && paired.ChildId && this.props.children[paired.ChildId];
                                let detail = child ? (
                                    <b>{child.name}</b>
                                ) : <b>Paired</b>;
                                let url = child && allow2.avatarURL(null, child);
                                return (
                                    <TableRow
                                        key={device.device.UDN}
                                        selectable={false}>
                                        <TableRowColumn>
                                            { imageName &&
                                            <img width="40" height="40"
                                                 src={ path.join(this.props.pluginPath, 'img', imageName + '.png') }/>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn>
                                            { token &&
                                            <span>{ device.device.device.friendlyName }</span>
                                            }
                                            { !token &&
                                            <span><i
                                                style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'center'}}>
                                            <Checkbox
                                                label=''
                                                isChecked={device.state}
                                                isDisabled={!token || device.active ? true : false}
                                                handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
                                            />
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'right'}}>
                                            { child &&
                                            <Avatar src={url}/>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'left'}}>
                                            { paired && detail }
                                            { !paired &&
                                            <FlatButton label="Assign"
                                                        onClick={this.assign.bind(this, device.device, token)}/>
                                            }
                                        </TableRowColumn>
                                    </TableRow>
                                );
                            }.bind(this)
                        )}
                    </TableBody>
                </Table>
                }

                {devices.notSupported.length > 0 &&
                <div>
                    <h2>Unsupported Devices</h2>
                    If you would like any of these devices supported, please contact us at support@allow2.com.
                    <div>
                        <Table>
                            <TableBody
                                displayRowCheckbox={false}
                                showRowHover={false}
                                stripedRows={true}>
                                {devices.notSupported.map((device) => {
                                    let imageName = deviceImages[device.device.device.modelName];
                                    return (
                                        <TableRow key={device.device.UDN}
                                                  selectable={false}>
                                            <TableRowColumn>
                                                {imageName &&
                                                <img width="40" height="40" src={'assets/img/' + imageName + '.png'}/>
                                                }
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                {device.device.device.friendlyName}
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                {device.device.device.modelName}
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                {device.device.device.modelNumber}
                                            </TableRowColumn>
                                        </TableRow>
                                    );
                                })
                                }
                            </TableBody>
                        </Table>
                    </div>
                </div>
                }
            </div>
        );
    }
});

//export default TabContent;

