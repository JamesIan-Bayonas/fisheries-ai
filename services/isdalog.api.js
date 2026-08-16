// file: jamesian-bayonas/fisheries-ai/services/isdalog.api.js
const axios = require('axios');

/**
 * Forwards Gemini AI catch extractions and environmental context to Laravel API
 */
async function publishCatch(session) {
    const apiUrl = process.env.ISDALOG_API_URL;

    if (!apiUrl) {
        throw new Error("Integration Failure: ISDALOG_API_URL environment variable is missing.");
    }

    try {
        const payload = {
            telegram_chat_id: String(session.telegram_chat_id),
            species: session.species,
            weight: parseFloat(session.weight),
            lat: parseFloat(session.lat || 8.58),
            lon: parseFloat(session.lon || 123.33)
        };

        if (session.wind_speed !== undefined) {
            payload.wind_speed = parseFloat(session.wind_speed);
        }
        if (session.temperature !== undefined) {
            payload.temperature = parseFloat(session.temperature);
        }
        if (session.weather_condition) {
            payload.weather_condition = String(session.weather_condition);
        }

        const response = await axios.post(`${apiUrl}/catches`, payload, {
            headers: {
                'bypass-tunnel-reminder': 'true',
                'User-Agent': 'IsdalogEcosystemBot/1.0',
                'Accept': 'application/json'
            }
        });

        console.log("🚀 Automation Bridge Success:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Automation Bridge Broken:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = { publishCatch };