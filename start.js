const axios = require('axios');
const { integrateWithSignalRGB } = require('./signalrgb');

// Function to read configuration from SignalRGB
function getConfig() {
  return {
    apiKey: global.config.api_key,    // Access the configured API key
    deviceId: global.config.device_id,  // Access the configured Device ID
    model: global.config.device_model   // Access the configured Device Model
  };
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDevices(apiKey) {
  try {
    const response = await axios.get('https://api.govee.io/v1/devices', {
      headers: {
        'Govee-API-Key': apiKey
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching devices:', error.message);
    throw error;
  }
}

async function controlDevice(apiKey, deviceId, model, command) {
  try {
    const response = await axios.post(`https://api.govee.io/v1/devices/control`, {
      device: deviceId,
      model: model,
      ...command
    }, {
      headers: {
        'Govee-API-Key': apiKey
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error controlling device:', error.message);
    throw error;
  }
}

async function main() {
  let attempt = 1;
  let apiLimitReached = false;

  const { apiKey, deviceId, model } = getConfig(); // Get configuration values

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

      // Example: Control the device using the configuration values
      console.log('Controlling device...');
      const command = { name: 'turn', value: 'on' };
      const result = await controlDevice(apiKey, deviceId, model, command);
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

main();
