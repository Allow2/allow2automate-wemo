import WemoPlugin from '@allow2/allow2automate-wemo';

const plugin = new WemoPlugin();

const devices = await plugin.actions.discover({
  timeout: 10000 // Discovery timeout in ms
});

console.log('Found devices:', devices);

