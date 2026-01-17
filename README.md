# Wemo Smart Devices Plugin

Enable Allow2Automate the ability to control Wemo smart devices for IoT-based parental controls and home automation.

## Description

This plugin integrates Belkin Wemo smart devices with Allow2 parental controls, allowing parents to automate device control based on time quotas, schedules, and parental rules. Control smart plugs, switches, and other Wemo devices to manage access to TVs, gaming consoles, computers, and more.

## Features

- Automatic Wemo device discovery on local network
- Manual device addition by IP address
- Turn devices on/off remotely
- Real-time device state monitoring
- Event-driven triggers for device changes
- Support for multiple Wemo devices
- Integration with Allow2 quota system
- Seamless smart home automation
- Device offline detection

---

## Important: Device Discovery Limitations

**Some older Wemo devices may not be discovered automatically** due to changes in Wemo's SSDP/UPnP implementation over time. Belkin has made changes to the Wemo firmware and discovery protocols that can prevent older devices from responding to standard discovery broadcasts.

### Workaround for Undiscovered Devices

If your Wemo devices are not appearing in the device list:

1. **Assign a Static IP Address to Your Wemo Device**
   - Log into your router's admin panel
   - Find the DHCP or LAN settings
   - Create a DHCP reservation (static lease) for your Wemo device's MAC address
   - This ensures your Wemo always has the same IP address

2. **Manually Add the Device by IP**
   - In the Wemo plugin, go to the **"Add Device"** tab
   - Enter your Wemo device's IP address (e.g., `192.168.1.100` or `192.168.1.100:49153`)
   - Click **"Add Device"**
   - The device will be added and will persist across restarts

### Finding Your Wemo's IP Address

- Check your router's connected devices list
- Use the official Wemo app to view device information
- Use a network scanner app to find devices on your network
- Common Wemo ports are 49153 and 49152

### Why Static IPs Are Recommended

Without a static IP, your Wemo device may get a different IP address after a power cycle or router restart, causing the manual connection to fail. Setting a static IP ensures reliable long-term connectivity.

---

## Installation

1. Run allow2automate on your machine:
- [https://apps.apple.com/au/app/allow2automate/id1369546793?mt=12](Mac App Store)
- Windows App Store (to be completed)
- [https://snapcraft.io/allow2automate](Linux Snap Store)

2. Log in using your Allow2 Parent Account

3. 

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

## Architecture

### Main Process Execution

This plugin requires **main process execution** for SSDP device discovery. The plugin declares this requirement via:

```javascript
module.exports = {
    plugin,
    TabContent,
    requiresMainProcess: true  // SSDP discovery needs main process
};
```

When loaded in the main process, the plugin:
1. Initializes Wemo client for SSDP network discovery
2. Polls for devices every 10 seconds
3. Persists discovered devices via `context.configurationUpdate()`
4. Sends device updates to renderer via `context.sendToRenderer()`

### Plugin Context API

The main process receives a rich context object:

```javascript
function plugin(context) {
    context.isMain              // true in main process
    context.ipcMain             // Electron ipcMain for IPC handlers
    context.configurationUpdate(state)  // Persist plugin configuration
    context.statusUpdate(status)        // Update plugin status
    context.sendToRenderer(channel, data)  // Send updates to UI
}
```

### Device Discovery Flow

1. **Main Process**: `Wemo.js` performs SSDP discovery
2. **Device Found**: Device info persisted to state
3. **UI Update**: Renderer notified via IPC
4. **User Control**: UI sends commands via `setBinaryState` IPC handler

For detailed main process documentation, see:
- [Main Process Plugin Guide](/plugins/MAIN_PROCESS_PLUGINS.md)
- [Template Documentation](/plugins/allow2automate-plugin/docs/MAIN_PROCESS.md)

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
- **Try manual IP addition** - Go to the "Add Device" tab and enter the device's IP address directly (see "Device Discovery Limitations" section above)
- Assign a static IP to your Wemo device in your router settings
- Ensure Wemo devices are powered on
- Verify devices are on the same network as Allow2Automate
- Check firewall settings allow SSDP discovery (UDP port 1900)
- Older Wemo firmware may have incompatible discovery protocols

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
