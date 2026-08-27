// File: fishery-ai/test-ai.js
require('dotenv').config();
const axios = require('axios');
const aiService = require('./services/ai.service');

// 1x1 Pixel Transparent JPEG Base64 for zero-latency API matrix testing
const TEST_IMAGE_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const testBuffer = Buffer.from(TEST_IMAGE_BASE64, 'base64');

async function runDiagnostics() {
    console.log("==================================================");
    console.log("🧪 ISDALOG EDGE & CLOUD AI DIAGNOSTIC SUITE");
    console.log("==================================================");

    // 1. Check Environment Variables
    console.log("\n[1/3] Checking Key Declarations...");
    const geminiKey = process.env.GEMINI_API_KEY;
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    console.log(`- GEMINI_API_KEY: ${geminiKey ? `${geminiKey.substring(0, 8)}... (Configured)` : '❌ MISSING'}`);
    console.log(`- OLLAMA_BASE_URL: ${ollamaUrl}`);

    // 2. Test Direct Cloud Gemini 2.5 Flash Endpoint
    console.log("\n[2/3] Probing Google Gemini 2.5 Flash REST API directly...");
    if (geminiKey && geminiKey !== 'your_gemini_api_key') {
        try {
            const geminiRes = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
                {
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: "image/jpeg", data: TEST_IMAGE_BASE64 } },
                            { text: "Reply with the word 'CONNECTED' if you receive this test." }
                        ]
                    }]
                },
                { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
            );

            const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`✅ Gemini Cloud API is FULLY FUNCTIONAL! Response: "${reply?.trim()}"`);
        } catch (err) {
            console.error(`❌ Gemini API Error (${err.response?.status || 'Network'}):`, err.response?.data?.error?.message || err.message);
        }
    } else {
        console.warn("⚠️ Skipping Gemini test: GEMINI_API_KEY not configured.");
    }

    // 3. Test ai.service.js End-to-End Fallback Architecture
    console.log("\n[3/3] Testing Unified Dual-Tier AI Service Pipeline...");
    try {
        const result = await aiService.identifyFish(testBuffer);
    console.log(`✅ Pipeline Execution Success! Result:`, result);
    } catch (err) {
        console.error("❌ Pipeline Failure:", err.message);
    }

    console.log("\n==================================================");
}

runDiagnostics();