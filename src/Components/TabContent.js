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
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Box from '@material-ui/core/Box';
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import Badge from '@material-ui/core/Badge';
import {deviceTokens, deviceImages} from '../constants';
import Checkbox from './Checkbox';
import Avatar from '@material-ui/core/Avatar';

// var dialogs = Dialogs({});

class TabContent extends Component {

    constructor(...args) {
        super(...args);

        this.state = {
            currentTab: 0,
            manualIP: '',
            isAddingDevice: false,
            addDeviceError: null,
            addDeviceSuccess: null
        };

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

    handleTabChange = (event, newValue) => {
        this.setState({ currentTab: newValue });
    };

    handleIPChange = (event) => {
        this.setState({
            manualIP: event.target.value,
            addDeviceError: null,
            addDeviceSuccess: null
        });
    };

    handleAddDeviceByIP = async () => {
        const { manualIP } = this.state;

        if (!manualIP || !manualIP.trim()) {
            this.setState({ addDeviceError: 'Please enter an IP address' });
            return;
        }

        // Basic IP validation
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
        if (!ipPattern.test(manualIP.trim())) {
            this.setState({ addDeviceError: 'Please enter a valid IP address (e.g., 192.168.1.100 or 192.168.1.100:49153)' });
            return;
        }

        this.setState({
            isAddingDevice: true,
            addDeviceError: null,
            addDeviceSuccess: null
        });

        try {
            const [err, result] = await this.props.ipc.invoke('addDeviceByIP', {
                ipAddress: manualIP.trim()
            });

            if (err) {
                this.setState({
                    isAddingDevice: false,
                    addDeviceError: err.message || 'Failed to add device'
                });
                return;
            }

            if (result && result.success) {
                this.setState({
                    isAddingDevice: false,
                    addDeviceSuccess: `Successfully added: ${result.deviceInfo.friendlyName} (${result.deviceInfo.modelName})`,
                    manualIP: ''
                });

                // Clear success message after 5 seconds
                setTimeout(() => {
                    this.setState({ addDeviceSuccess: null });
                }, 5000);
            } else {
                this.setState({
                    isAddingDevice: false,
                    addDeviceError: (result && result.error) || 'Failed to connect to device'
                });
            }
        } catch (error) {
            console.error('[Wemo TabContent] Error adding device:', error);
            this.setState({
                isAddingDevice: false,
                addDeviceError: error.message || 'An error occurred'
            });
        }
    };

    handleKeyPress = (event) => {
        if (event.key === 'Enter' && !this.state.isAddingDevice) {
            this.handleAddDeviceByIP();
        }
    };

    async toggleCheckbox(device, isChecked) {
        let newData = Object.assign({}, this.props.data);
        var newDevices = (this.props.data.devices || {});
        newDevices[device.UDN] = newDevices[device.UDN] || {};
        newDevices[device.UDN].active = isChecked;
        newData.devices = newDevices;
        this.props.configurationUpdate(newData);
        console.log('ipcRenderer', this.props.ipc);
	    const { err, result } = await this.props.ipc.invoke('setBinaryState', {
            UDN: device.UDN,
            state: isChecked ? 1 : 0
        });
	    console.log(err, result);
        if (err) {
        	console.log(err);
        }
    }

    async assign(device, token) {
        console.log('[Wemo TabContent] assign called', device, token);

        // Get current pairing for this device
        const pairings = this.props.data.pairings || {};
        const currentPairing = pairings[device.UDN];
        const currentChildId = (currentPairing && currentPairing.ChildId) || null;

        // Open child picker with current selection
        const result = await this.props.assign(device, token, {
            currentSelection: currentChildId,
            allowClear: !!currentPairing  // Only show clear if already paired
        });

        console.log('[Wemo TabContent] Child picker result:', result);

        if (result.cancelled) {
            // User cancelled - do nothing
            return;
        }

        if (result.cleared) {
            // User cleared the assignment - remove pairing
            try {
                const unpairResult = await this.props.globalIpc.invoke('unpairDevice', {
                    deviceId: device.UDN
                });

                if (unpairResult.success) {
                    // Update local plugin config
                    const newPairings = { ...pairings };
                    delete newPairings[device.UDN];

                    const newData = {
                        ...this.props.data,
                        pairings: newPairings
                    };
                    this.props.configurationUpdate(newData);
                    console.log('[Wemo TabContent] Pairing cleared for', device.friendlyName);
                } else {
                    console.error('[Wemo TabContent] Failed to unpair:', unpairResult.error);
                }
            } catch (error) {
                console.error('[Wemo TabContent] Error clearing pairing:', error);
            }
            return;
        }

        if (result.selected && result.childId) {
            // User selected a child - create pairing
            try {
                const pairResult = await this.props.globalIpc.invoke('pairDevice', {
                    deviceId: device.UDN,
                    deviceName: device.friendlyName,
                    token: token,
                    childId: result.childId
                });

                if (pairResult.success) {
                    // Update local plugin config with new pairing
                    const newPairings = {
                        ...pairings,
                        [device.UDN]: pairResult.pairing
                    };

                    const newData = {
                        ...this.props.data,
                        pairings: newPairings
                    };
                    this.props.configurationUpdate(newData);
                    console.log('[Wemo TabContent] Paired', device.friendlyName, 'to', result.childName);
                } else {
                    console.error('[Wemo TabContent] Failed to pair:', pairResult.error);
                    // TODO: Show error toast
                }
            } catch (error) {
                console.error('[Wemo TabContent] Error creating pairing:', error);
            }
        }
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
            .filter(device => device && device.friendlyName) // Filter out invalid devices
            .sort((a,b) => (a.friendlyName || '').localeCompare(b.friendlyName || ''))
            .reduce(function(memo, device) {

            let token = deviceTokens[device.modelName];
            if (token) {
                memo.supported.push(device);
            } else {
                memo.notSupported.push(device);
            }
            return memo;
        }, { supported: [], notSupported: [] });
        //console.log('wemo TabContent', key, this.props.data.devices, this.props.data.pairings);
        let pairings = this.props.data.pairings || {};
        const plugin = this.props.plugin;
        const pluginDir = this.props.pluginDir;
        const { currentTab, manualIP, isAddingDevice, addDeviceError, addDeviceSuccess } = this.state;
        // const Checkbox = this.props.Checkbox;

        // Calculate tab index for Unsupported - it shifts based on whether there are unsupported devices
        const unsupportedTabIndex = 1;
        const addDeviceTabIndex = devices.notSupported.length > 0 ? 2 : 1;

        return (
            <div>
                {/* Tabs for Devices, Unsupported, and Add Device */}
                <Tabs
                    value={currentTab}
                    onChange={this.handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                >
                    <Tab label={
                        <Badge
                            badgeContent={devices.supported.length}
                            color="primary"
                            showZero
                            style={{ paddingRight: devices.supported.length > 0 ? '12px' : '0' }}
                        >
                            Devices
                        </Badge>
                    } />
                    {devices.notSupported.length > 0 && (
                        <Tab label={
                            <Badge
                                badgeContent={devices.notSupported.length}
                                color="secondary"
                                style={{ paddingRight: '12px' }}
                            >
                                Unsupported
                            </Badge>
                        } />
                    )}
                    <Tab label="Add Device" />
                </Tabs>

                {/* Devices Tab */}
                {currentTab === 0 && (
                    <Box p={3}>
                        { devices.supported.length < 1 && (
                            <div style={{ textAlign: "center" }}>
                                <h1>No Devices Found</h1>
                                <p style={{ width:"75%", margin: "auto" }}>Allow2Automate will auto-discover Wemo devices on your network and list them here when found.</p>
                                <p style={{ width:"75%", margin: "auto", marginTop: "10px", color: "#666" }}>
                                    You can also manually add devices by IP address in the "Add Device" tab.
                                </p>
                            </div>
                        )}
                        { devices.supported.length > 0 && (
                        <Table>
                    <TableBody>
                        { devices.supported.map(function (device) {
                                let token = deviceTokens[device.modelName];
                                let imageName = deviceImages[device.modelName];
                                let paired = pairings[device.UDN];
                                let child = paired && paired.ChildId && this.props.children[paired.ChildId];
                                let detail = child ? (
                                    <b>{child.name}</b>
                                ) : <b>Paired</b>;
                                let url = child && allow2.avatarURL(null, child);
                                return (
                                    <TableRow key={device.UDN}>
                                        <TableCell>
                                            { imageName &&
                                            <img width="40" height="40"
                                                 src={ `file://${path.join(pluginDir, 'img', imageName + '.png')}` }/>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            { token &&
                                            <span>{ device.friendlyName }</span>
                                            }
                                            { !token &&
                                            <span><i
                                                style={{ color: '#555555' }}>{ device.friendlyName }</i></span>
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
                                                    onClick={this.assign.bind(this, device, token)} >Assign</Button>
                                            }
                                        </TableCell>
                                    </TableRow>
                                );
                            }.bind(this)
                        )}
                    </TableBody>
                </Table>
                        )}
                    </Box>
                )}

                {/* Unsupported Tab */}
                {currentTab === unsupportedTabIndex && devices.notSupported.length > 0 && (
                    <Box p={3}>
                        <h2>Unsupported Devices</h2>
                        <p>If you would like any of these devices supported, please contact us at support@allow2.com.</p>
                        <Table>
                            <TableBody>
                                {devices.notSupported.map((device) => {
                                    let imageName = deviceImages[device.modelName];
                                    return (
                                        <TableRow key={device.UDN}>
                                            <TableCell>
                                                {imageName &&
                                                <img width="40" height="40" src={ `file://${path.join(pluginDir, 'img', imageName + '.png')}` }/>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {device.friendlyName}
                                            </TableCell>
                                            <TableCell>
                                                {device.modelName}
                                            </TableCell>
                                            <TableCell>
                                                {device.modelNumber}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                                }
                            </TableBody>
                        </Table>
                    </Box>
                )}

                {/* Add Device Tab */}
                {currentTab === addDeviceTabIndex && (
                    <Box p={3}>
                        <Typography variant="h5" gutterBottom>
                            Add Device by IP Address
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            If auto-discovery doesn't find your Wemo device, you can add it manually by entering its IP address.
                            The device will be added to the appropriate list based on whether it's a supported model.
                        </Typography>

                        <Box
                            display="flex"
                            alignItems="center"
                            style={{ marginTop: '20px', marginBottom: '20px' }}
                        >
                            <TextField
                                label="IP Address"
                                placeholder="e.g., 192.168.1.100 or 192.168.1.100:49153"
                                variant="outlined"
                                value={manualIP}
                                onChange={this.handleIPChange}
                                onKeyPress={this.handleKeyPress}
                                disabled={isAddingDevice}
                                style={{ width: '300px', marginRight: '16px' }}
                                helperText="Enter IP address, optionally with port (default: 49153)"
                            />
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={this.handleAddDeviceByIP}
                                disabled={isAddingDevice || !manualIP.trim()}
                            >
                                {isAddingDevice ? (
                                    <>
                                        <CircularProgress size={20} style={{ marginRight: '8px' }} color="inherit" />
                                        Connecting...
                                    </>
                                ) : (
                                    'Add Device'
                                )}
                            </Button>
                        </Box>

                        {addDeviceError && (
                            <Alert severity="error" style={{ marginBottom: '16px' }}>
                                {addDeviceError}
                            </Alert>
                        )}

                        {addDeviceSuccess && (
                            <Alert severity="success" style={{ marginBottom: '16px' }}>
                                {addDeviceSuccess}
                            </Alert>
                        )}

                        <Box style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Tips for finding your Wemo's IP address:
                            </Typography>
                            <Typography variant="body2" component="ul" style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>Check your router's admin page for connected devices</li>
                                <li>Use the Wemo app to view device information</li>
                                <li>Use a network scanner app to find devices on your network</li>
                                <li>Common Wemo ports are 49153 and 49152</li>
                            </Typography>
                        </Box>

                        {/* Show manually added devices */}
                        {this.props.data.manualDevices && this.props.data.manualDevices.length > 0 && (
                            <Box style={{ marginTop: '24px' }}>
                                <Typography variant="h6" gutterBottom>
                                    Manually Added Devices
                                </Typography>
                                <Table size="small">
                                    <TableBody>
                                        {this.props.data.manualDevices.map((device) => (
                                            <TableRow key={device.ipAddress}>
                                                <TableCell>{device.friendlyName || 'Unknown'}</TableCell>
                                                <TableCell>{device.ipAddress}:{device.port}</TableCell>
                                                <TableCell>{device.UDN}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Box>
                )}
            </div>
        );
    }
}

export default TabContent;

