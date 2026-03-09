const axios = require('axios');

class IsdaLogAPI {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.ISDALOG_API_URL || 'http://isdalog-webserver/api',
      headers: {
        'Authorization': `Bearer ${process.env.ISDALOG_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Logs catch data into the IsdaLog system.
   * @param {Object} aiData { species, weight }
   */
  async logCatch(aiData) {
    try {
      // 1. Sanitize the data to match the strict JSON contract
      // This strips out text like "kg" or "kilos" leaving only the float number
      let cleanWeight = typeof aiData.weight === 'string' 
          ? parseFloat(aiData.weight.replace(/[^0-9.]/g, ''))
          : aiData.weight;

      // 2. Build the exact payload Laravel expects
      const payload = {
        species: aiData.species || 'Unknown',
        weight: cleanWeight || 0,
        location: 'Dipolog City Port' // Defaulting to local maritime context
      };

      // 3. Send the payload across the internal Docker network to Laravel
      const response = await this.client.post('/catches', payload);
      return response.data;
    } catch (error) {
      console.error('Handshake Failed:', error.response?.data || error.message);
      throw new Error('Failed to synchronize with IsdaLog database.');
    }
  }
}

module.exports = new IsdaLogAPI();