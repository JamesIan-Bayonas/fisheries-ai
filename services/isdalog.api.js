// file: jamesian-bayonas/fisheries-ai/services/isdalog.api.js
const axios = require('axios');

/**
 * Forwards Gemini AI catch extractions to Laravel, bypassing LocalTunnel security landing walls
 */
async function publishCatch(session) {
    const apiUrl = process.env.ISDALOG_API_URL;

    if (!apiUrl) {
        throw new Error("Integration Failure: ISDALOG_API_URL environment variable is missing.");
    }

    try {
        // AUTOMATION REINFORCEMENT: Adding custom headers to skip the tunnel splash screen completely
        const response = await axios.post(`${apiUrl}/catches`, {
            telegram_chat_id: String(session.telegram_chat_id),
            species: session.species,
            weight: parseFloat(session.weight),
            lat: String(session.lat),
            lon: String(session.lon)
        }, {
            headers: {
                // This specific header forces LocalTunnel to skip the warning page and forward raw data directly
                'bypass-tunnel-reminder': 'true',
                'User-Agent': 'IsdalogEcosystemBot/1.0'
            }
        });

        console.log("🚀 Automation Bridge Success:", response.data);
        return response.data;
    } catch (error) {
        // Detailed log error tracing to see exactly what response status the server is pushing back
        console.error("❌ Automation Bridge Broken:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = { publishCatch };