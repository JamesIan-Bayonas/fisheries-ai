const axios = require('axios');

class WeatherService {
    async getLocalWeather() {
        try {
            // Pre-configured coordinates for the Dipolog Port area
            const lat = 8.5869;
            const lon = 123.3406;
            
            // Open-Meteo requires no API key.
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m&wind_speed_unit=kmh`;
            
            const response = await axios.get(url);
            const current = response.data.current;

            return {
                temp: current.temperature_2m,
                wind: current.wind_speed_10m
            };
        } catch (error) {
            console.error("[Weather API] Fetch Failed:", error.message);
            return null; // Return null so the bot knows it failed gracefully
        }
    }
}

module.exports = new WeatherService();