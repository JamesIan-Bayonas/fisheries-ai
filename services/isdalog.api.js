// File: fishery-ai/services/isdalog.api.js
const axios = require('axios');
const { randomUUID } = require('crypto');

function apiBase() {
    const url = process.env.ISDALOG_API_URL || process.env.LARAVEL_API_URL;
    if (!url) throw new Error('Backend URL is not configured.');
    const base = url.replace(/\/$/, '');
    return base.endsWith('/api') ? base : base + '/api';
}
function botHeaders() {
    if (!process.env.ISDALOG_BOT_SECRET) throw new Error('Bot authentication is not configured.');
    return { 'X-Isdalog-Bot-Secret': process.env.ISDALOG_BOT_SECRET, Accept: 'application/json' };
}
async function linkAccount(payload) {
    try { return await axios.post(apiBase() + '/telegram/link', payload, { headers: botHeaders(), timeout: 15000 }); }
    catch (error) { console.error('Account linking failed.', { status: error.response?.status }); throw error; }
}

/**
 * Forwards Gemini AI catch extractions, images, and environmental context to Laravel API
 */
async function publishCatch(session) {
    const apiUrl = process.env.ISDALOG_API_URL || process.env.LARAVEL_API_URL;

    if (!apiUrl) {
        throw new Error("Integration Failure: ISDALOG_API_URL or LARAVEL_API_URL environment variable is missing.");
    }

    // Ensure endpoint URL handles trailing slash or /api pathing cleanly
    const baseUrl = apiUrl.replace(/\/$/, '');
    const endpoint = baseUrl.endsWith('/api') ? `${baseUrl}/catches` : `${baseUrl}/api/catches`;

    try {
        session.submission_id ||= randomUUID();
        const payload = {
            submission_id: session.submission_id,
            telegram_chat_id: String(session.telegram_chat_id),
            species: session.species,
            weight: parseFloat(session.weight),
            price_per_kg: session.price_per_kg ? parseFloat(session.price_per_kg) : null,
            location: session.location || 'Galas Port',
            lat: parseFloat(session.lat || 8.58),
            lon: parseFloat(session.lon || 123.33),
            image_base64: session.image_base64 || null,
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

        const response = await axios.post(endpoint, payload, {
            headers: {
                ...botHeaders(),
                'bypass-tunnel-reminder': 'true',
                'User-Agent': 'IsdalogEcosystemBot/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 30000,
            maxContentLength: 1024 * 1024,
            maxBodyLength: 8 * 1024 * 1024
        });

        console.log("Catch published.");
        return response.data;
    } catch (error) {
        console.error('Catch publication failed.', { status: error.response?.status });
        throw error;
    }
}

module.exports = { publishCatch, linkAccount };