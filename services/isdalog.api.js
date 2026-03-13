const axios = require('axios');

class IsdaLogAPI {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.ISDALOG_API_URL || 'http://isdalog-app/api',
      headers: {
        'Authorization': `Bearer ${process.env.ISDALOG_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  // Executes Phase 1 Handshake
  async handshake(telegramId, name) {
    try {
      const response = await this.client.post('/handshake', {
        telegram_chat_id: telegramId.toString(),
        name: name || 'Fisherman'
      });
      return response.data;
    } catch (error) {
      console.error('Handshake Failed:', error.response?.data || error.message);
      throw new Error('Failed to synchronize identity with IsdaLog.');
    }
  }

  // Logs the Catch with Identity Attached
  async logCatch(aiData, telegramId) {
    try {
      let cleanWeight = typeof aiData.weight === 'string' 
          ? parseFloat(aiData.weight.replace(/[^0-9.]/g, ''))
          : aiData.weight;

      const payload = {
        telegram_chat_id: telegramId.toString(),
        species: aiData.species || 'Unknown',
        weight: cleanWeight || 0,
        location: 'Dipolog City Port'
      };

      const response = await this.client.post('/catches', payload);
      return response.data;
    } catch (error) {
      console.error('Data Sync Failed:', error.response?.data || error.message);
      throw new Error('Failed to synchronize catch with IsdaLog database.');
    }
  }
}

module.exports = new IsdaLogAPI();