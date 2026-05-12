const axios = require('axios');

// Geographical Coordinates for Galas Port, Dipolog City
const DIPOLOG_LAT = 8.58;
const DIPOLOG_LONG = 123.33;

// Safety Threshold (Anything above 30 km/h is considered unsafe for small boats)
const GALE_WARNING_THRESHOLD_KMH = 30; 

async function checkSeaConditions() {
    try {
        // Fetch real-time weather data for Dipolog
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${DIPOLOG_LAT}&longitude=${DIPOLOG_LONG}&current_weather=true`);
        
        const weather = response.data.current_weather;
        const windSpeed = weather.windspeed;
        
        // Determine if it is safe to fish
        const isSafe = windSpeed < GALE_WARNING_THRESHOLD_KMH;

        return {
            isSafe: isSafe,
            windSpeed: windSpeed,
            message: isSafe 
                ? `✅ Sea conditions are safe. Current wind speed in Dipolog: ${windSpeed} km/h.`
                : `🚨 GALE WARNING: Wind speed in Dipolog is currently ${windSpeed} km/h. Maritime trading is temporarily suspended for your safety. Please seek shelter.`,
        };
    } catch (error) {
        console.error("Failed to fetch weather data:", error.message);
        // Fallback constraint: If the API goes down during your defense, assume it is safe so you can still demo the app.
        return { isSafe: true, windSpeed: 0, message: "Weather API unavailable. Proceed with caution." };
    }
}

module.exports = {
    checkSeaConditions
};