# Wemo Smart Devices Plugin

Enable Allow2Automate the ability to control Wemo smart devices for IoT-based parental controls and home automation.

## Description

This plugin integrates Belkin Wemo smart devices with Allow2 parental controls, allowing parents to automate device control based on time quotas, schedules, and parental rules. Control smart plugs, switches, and other Wemo devices to manage access to TVs, gaming consoles, computers, and more.

## Features

- Automatic Wemo device discovery on local network
- Turn devices on/off remotely
- Real-time device state monitoring
- Event-driven triggers for device changes
- Support for multiple Wemo devices
- Integration with Allow2 quota system
- Seamless smart home automation
- Device offline detection

## Installation

### Via NPM

```bash
npm install @allow2/allow2automate-wemo
```

### Via Git

```bash
git clone https://github.com/Allow2/allow2automate-wemo.git
cd allow2automate-wemo
npm install
npm run build
```

## Configuration

1. Install the plugin in your Allow2Automate application
2. Ensure Wemo devices are on the same network
3. Run device discovery to find Wemo devices
4. Configure device mappings and rules
5. Set up quota-based automation

### Required Permissions

This plugin requires the following permissions:

- **network**: To discover and communicate with Wemo devices on the local network
- **configuration**: To read and modify plugin settings, including device mappings and automation rules

These permissions are necessary for the plugin to:
- Discover Wemo devices using SSDP protocol on the local network
- Send control commands to turn devices on/off
- Monitor device state changes in real-time
- Store device configurations and automation rules

## Usage

### Discover Devices

```javascript
import WemoPlugin from '@allow2/allow2automate-wemo';

const plugin = new WemoPlugin();

const devices = await plugin.actions.discover({
  timeout: 10000 // Discovery timeout in ms
});

console.log('Found devices:', devices);
```

### Turn Device On

```javascript
await plugin.actions.turnOn({
  deviceId: 'wemo-switch-001',
  deviceName: 'Gaming Console'
});
```

### Turn Device Off

```javascript
await plugin.actions.turnOff({
  deviceId: 'wemo-switch-001',
  deviceName: 'Gaming Console'
});
```

### Get Device State

```javascript
const state = await plugin.actions.getState({
  deviceId: 'wemo-switch-001'
});

console.log('Device is:', state.isOn ? 'ON' : 'OFF');
```

### Automation Example

```javascript
// Automatically turn off gaming console when quota exceeded
plugin.on('quotaExceeded', async (event) => {
  await plugin.actions.turnOff({
    deviceId: 'wemo-switch-gaming'
  });
});

// Turn on device when quota renewed
plugin.on('quotaRenewed', async (event) => {
  await plugin.actions.turnOn({
    deviceId: 'wemo-switch-gaming'
  });
});
```

## API Documentation

### Actions

#### `discover`
- **Name**: Discover Devices
- **Description**: Discover Wemo devices on the network
- **Parameters**:
  - `timeout` (number, optional): Discovery timeout in milliseconds (default: 10000)
- **Returns**: Array of discovered devices

#### `turnOn`
- **Name**: Turn On
- **Description**: Turn on a Wemo device
- **Parameters**:
  - `deviceId` (string): Wemo device identifier
  - `deviceName` (string, optional): Device name for logging

#### `turnOff`
- **Name**: Turn Off
- **Description**: Turn off a Wemo device
- **Parameters**:
  - `deviceId` (string): Wemo device identifier
  - `deviceName` (string, optional): Device name for logging

#### `getState`
- **Name**: Get State
- **Description**: Get current state of Wemo device
- **Parameters**:
  - `deviceId` (string): Wemo device identifier
- **Returns**: Device state object with `isOn` boolean

### Triggers

#### `deviceDiscovered`
- **Name**: Device Discovered
- **Description**: Triggered when a new Wemo device is discovered
- **Payload**:
  - `deviceId` (string): Device identifier
  - `deviceName` (string): Device friendly name
  - `deviceType` (string): Type of Wemo device
  - `ipAddress` (string): Device IP address

#### `deviceStateChanged`
- **Name**: Device State Changed
- **Description**: Triggered when Wemo device state changes
- **Payload**:
  - `deviceId` (string): Device identifier
  - `previousState` (boolean): Previous on/off state
  - `currentState` (boolean): Current on/off state
  - `timestamp` (date): Time of state change

#### `deviceOffline`
- **Name**: Device Offline
- **Description**: Triggered when Wemo device goes offline
- **Payload**:
  - `deviceId` (string): Device identifier
  - `deviceName` (string): Device name
  - `lastSeen` (date): Last communication timestamp

## Supported Devices

- Wemo Switch
- Wemo Insight Switch
- Wemo Light Switch
- Wemo Mini
- Wemo Dimmer

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Allow2/allow2automate-wemo.git
cd allow2automate-wemo

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Common Use Cases

- Automatically control gaming consoles based on quotas
- Schedule TV access for specific times
- Control computer power based on homework completion
- Manage smart home devices as parental controls
- Monitor and restrict device usage patterns
- Create time-based automation rules

## Troubleshooting

### Devices Not Discovered
- Ensure Wemo devices are powered on
- Verify devices are on the same network
- Check firewall settings allow SSDP discovery
- Try increasing discovery timeout

### Device Control Fails
- Verify device is online and responsive
- Check network connectivity
- Ensure device firmware is up to date
- Restart Wemo device if necessary

## Requirements

- Node.js 12.0 or higher
- Allow2Automate 2.0.0 or higher
- Belkin Wemo devices
- Local network connectivity

## License

MIT - See [LICENSE](LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/Allow2/allow2automate-wemo/issues)
- **Documentation**: [Allow2 Documentation](https://www.allow2.com/docs)
- **Community**: [Allow2 Community Forums](https://community.allow2.com)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Author

Allow2

## Keywords

allow2automate, allow2, wemo, plugin, iot, parental-controls, smart-home
