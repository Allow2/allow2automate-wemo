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

import React, { Component } from 'react';

import path from 'path';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import Button from '@material-ui/core/Button';
import {deviceTokens, deviceImages} from '../constants';
import Checkbox from './Checkbox';
// import Avatar from '@material-ui/core/Avatar';

// var dialogs = Dialogs({});

class TabContent extends Component {

    constructor(...args) {
        super(...args);

        // this.props.ipc.on('setBinaryStateResponse', function (event, UDN, err, response) {
        //     console.log('setBinaryStateResponse', event, UDN, err, response);
        //     // let device = this.props.devices[UDN];
        //     // this.props.onDeviceActive(UDN, false);
        //     // if (err || ( response.BinaryState == undefined )) {
        //     //     return;
        //     // }
        //     // device.active = false;
        //     // device.state = ( response.BinaryState != '0' );
        //     // this.props.onDeviceUpdate({[UDN]: device});
        // }.bind(this));
    };

    toggleCheckbox(device, isChecked) {
        //this.props.onDeviceActive( device.device.UDN, true );
        let newData = Object.assign({}, this.props.data);
        var newDevices = (this.props.data.devices || {});
        newDevices[device.device.UDN] = newDevices[device.device.UDN] || {};
        newDevices[device.device.UDN].active = isChecked;
        newData.devices = newDevices;
        this.props.configurationUpdate(newData);
        this.props.ipc.send('setBinaryState', {
            UDN: device.device.UDN,
            state: isChecked ? 1 : 0
        });
    }

    assign(device, token) {
        console.log(device, token);
        this.props.assign(device, token);
    }

    render() {
        if (!this.props || !this.props.plugin || !this.props.data) {
            return (
                <div>
                    Loading...
                </div>
            );
        }

        var key = null;
        const allow2 = this.props.allow2;
        // get the data set, this plugin only uses one data set

        let devices = Object
            .values(this.props.data.devices || [])
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
        //console.log('wemo TabContent', key, this.props.data.devices, this.props.data.pairings);
        let pairings = this.props.data.pairings;
        const plugin = this.props.plugin;
        const pluginPath = this.props.pluginPath;
        // const Checkbox = this.props.Checkbox;
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
                    <TableBody>
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
                                    <TableRow key={device.device.UDN}>
                                        <TableCell>
                                            { imageName &&
                                            <img width="40" height="40"
                                                 src={ path.join(pluginPath, 'img', imageName + '.png') }/>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            { token &&
                                            <span>{ device.device.device.friendlyName }</span>
                                            }
                                            { !token &&
                                            <span><i
                                                style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
                                            }
                                        </TableCell>
                                        <TableCell style={{textAlign: 'center'}}>
                                            <Checkbox
                                            label=''
                                            isChecked={device.state}
                                            isDisabled={!token || device.active ? true : false}
                                            handleCheckboxChange={this.toggleCheckbox.bind(this, device)} />
                                        </TableCell>
                                        <TableCell style={{textAlign: 'right'}}>
                                            { child &&
                                            <Avatar src={url}/>
                                            }
                                        </TableCell>
                                        <TableCell style={{textAlign: 'left'}}>
                                            { paired && detail }
                                            { !paired &&
                                            <Button label="Assign"
                                                    onClick={this.assign.bind(this, device.device, token)} >Assign</Button>
                                            }
                                        </TableCell>
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
                            <TableBody>
                                {devices.notSupported.map((device) => {
                                    let imageName = deviceImages[device.device.device.modelName];
                                    return (
                                        <TableRow key={device.device.UDN}>
                                            <TableCell>
                                                {imageName &&
                                                <img width="40" height="40" src={ path.join(pluginPath, 'img', imageName + '.png') }/>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {device.device.device.friendlyName}
                                            </TableCell>
                                            <TableCell>
                                                {device.device.device.modelName}
                                            </TableCell>
                                            <TableCell>
                                                {device.device.device.modelNumber}
                                            </TableCell>
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
}

export default TabContent;

