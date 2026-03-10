const axios = require('axios');

class IsdaLogAPI {
  constructor() {
    this.client = axios.create({
      // Points to the service name 'app' as defined in your docker-compose.yml
      baseURL: process.env.ISDALOG_API_URL || 'http://isdalog-app/api',
      headers: {
        'Authorization': `Bearer ${process.env.ISDALOG_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async logCatch(aiData) {
    try {
      // Sanitize weight to ensure it is a number
      let cleanWeight = typeof aiData.weight === 'string' 
          ? parseFloat(aiData.weight.replace(/[^0-9.]/g, ''))
          : aiData.weight;

      const payload = {
        species: aiData.species || 'Unknown',
        weight: cleanWeight || 0,
        location: 'Dipolog City Port'
      };

      const response = await this.client.post('/catches', payload);
      return response.data;
    } catch (error) {
      console.error('Handshake Failed:', error.response?.data || error.message);
      throw new Error('Failed to synchronize with IsdaLog database.');
    }
  }
}

module.exports = new IsdaLogAPI();