const axios = require('axios');

// Create a single, configured axios instance for all IsdaLog API calls.
const apiClient = axios.create({
  baseURL: process.env.ISDALOG_API_URL, // e.g., http://webserver/api
  timeout: 8000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ISDALOG_API_TOKEN}`
  }
});

/**
 * Performs the initial handshake with the IsdaLog API.
 * @param {number} telegramId The user's unique Telegram ID.
 * @param {string} name The user's first name.
 * @returns {Promise<any>}
 */
const handshake = async (telegramId, name) => {
  try {
    // 1. Endpoint is just '/handshake' since baseURL already includes '/api'
    // 2. We map the JavaScript 'telegramId' to the Laravel 'telegram_chat_id'
    const response = await apiClient.post('/handshake', { 
        telegram_chat_id: telegramId.toString(), // Force to string for Laravel
        name: name || 'Fisherman'
    });
    return response.data;
  } catch (error) {
    // This will print the EXACT Laravel validation error if it fails again
    const serverMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error('[IsdaLog API] Handshake Failed:', serverMessage);
    throw error;
  }
};

const logCatch = async (catchData, telegramId, lat, lon) => {
  try {
    const response = await apiClient.post('/catches', { 
        ...catchData, 
        telegram_chat_id: telegramId.toString(), 
        lat: lat, 
        lon: lon 
    });
    return response.data;
  } catch (error) {
    const serverMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error('[IsdaLog API] Catch Logging Failed:', serverMessage);
    throw error;
  }
};

module.exports = {
  handshake,
  logCatch,
};  