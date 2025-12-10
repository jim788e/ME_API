require('dotenv').config();
const axios = require('axios');

// Test the new API endpoint to see response structure
async function testAPI() {
  const collectionAddress = process.env.COLLECTION_ADDRESS || '0xa6423b238f3936c3922b375f8ebf42005fecc40b';
  const chain = process.env.CHAIN || 'ethereum';
  const apiKey = process.env.API_KEY;

  const config = {
    method: 'GET',
    url: 'https://api-mainnet.magiceden.dev/v4/evm-public/assets/collection-assets',
    params: {
      chain: chain,
      collectionId: collectionAddress,
      limit: '20',
      sortBy: 'price',
      sortDir: 'asc'
    },
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/json'
    }
  };

  if (apiKey) {
    config.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    console.log('Testing API endpoint...');
    console.log('URL:', config.url);
    console.log('Params:', config.params);
    console.log('\n--- Response Structure ---\n');
    
    const response = await axios(config);
    
    console.log('Response type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
    console.log('Response keys:', typeof response.data === 'object' && !Array.isArray(response.data) ? Object.keys(response.data) : 'N/A (array)');
    
    if (Array.isArray(response.data)) {
      console.log('Array length:', response.data.length);
      if (response.data.length > 0) {
        console.log('\nFirst item structure:');
        console.log(JSON.stringify(response.data[0], null, 2));
      }
    } else if (response.data && typeof response.data === 'object') {
      console.log('\nResponse object structure:');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 2000)); // First 2000 chars
    }
    
    console.log('\n--- Full Response (first 5000 chars) ---\n');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 5000));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPI();

