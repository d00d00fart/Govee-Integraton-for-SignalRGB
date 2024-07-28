const { getDevices, controlDevice } = require('./govee');
const axios = require('axios');

function getConfig() {
  return {
    apiKey: global.config.api_key,
    deviceId: global.config.device_id,
    model: global.config.device_model
  };
}

async function main() {
  const { apiKey, deviceId, model } = getConfig();

  if (!apiKey || !deviceId || !model) {
    console.error('API Key, Device ID, or Device Model is missing.');
    return;
  }

  console.log('Starting script with config:', { apiKey, deviceId, model });

  let attempt = 1;
  let apiLimitReached = false;

  while (true) {
    try {
      if (apiLimitReached) {
        console.log('API limit reached. Waiting for 24 hours before retrying...');
        await wait(86400 * 1000); // Wait for 24 hours
        apiLimitReached = false;
        attempt = 1;
      }

      console.log(`Attempt ${attempt}: Fetching Govee devices...`);
      const devices = await getDevices(apiKey);

      if (!devices) {
        throw new Error('Failed to fetch devices');
      }

      console.log('Govee Devices:', devices);

      // Control a device
      console.log('Controlling device...');
      const result = await controlDevice(apiKey, deviceId, model, { name: 'turn', value: 'on' });
      console.log('Control Result:', result);

      // Integrate with SignalRGB
      console.log('Integrating with SignalRGB...');
      integrateWithSignalRGB(devices);

      break; // Break the loop if everything goes well

    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] ? parseInt(error.response.headers['retry-after'], 10) : 60;
        console.log('Rate limited! Please wait before making more requests.');
        console.log(`Retry after: ${retryAfter} seconds.`);

        if (retryAfter >= 86400) {
          apiLimitReached = true;
        } else {
          await wait(retryAfter * 1000); // Wait for the specified retry period
        }

        attempt++;
      } else {
        console.error('Error:', error.message);
        break; // Break the loop if there's an error other than rate limiting
      }
    }
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
