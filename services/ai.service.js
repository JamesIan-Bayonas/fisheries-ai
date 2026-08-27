// File: fishery-ai/services/ai.service.js
const axios = require('axios');
const http = require('http');

class AIService {
    constructor() {
        const rawUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        this.ollamaUrl = rawUrl.replace(/\/$/, '').replace('localhost', '127.0.0.1');
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        
        // Extended timeouts for maritime cellular connectivity and high-resolution base64 payloads
        this.cloudTimeoutMs = 15000; 
        this.edgeTimeoutMs = 10000; 

        // Hardened HTTP Agent for local socket recycling
        this.localAgent = new http.Agent({
            keepAlive: false,
            maxFreeSockets: 10,
            timeout: 60000
        });
    }

    async identifyFish(imageBuffer) {
        const base64Image = imageBuffer.toString('base64').replace(/[\r\n]+/g, '').trim();
        const promptText = "Identify the fish species. Reply with ONLY the common name (e.g., Lapu-Lapu, Bangus, Yellowfin Tuna, Tilapia). No extra text.";

        // --- 1. CLOUD INFERENCE: Google Gemini (REST API) ---
        if (this.geminiApiKey && this.geminiApiKey !== 'your_gemini_api_key') {
            try {
                console.log("🌐 Routing to Cloud Node (Google Gemini 2.5 Flash)...");
                
                const geminiResponse = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`,
                    {
                        contents: [{
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: "image/jpeg",
                                        data: base64Image
                                    }
                                },
                                { text: promptText }
                            ]
                        }]
                    },
                    { 
                        timeout: this.cloudTimeoutMs,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );

                const candidate = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (candidate) {
                    const fishName = candidate.trim().replace(/^["']|["']$/g, '');
                    console.log(`✅ Cloud Engine Success: ${fishName}`);
                    return { species: fishName, engine: 'gemini' };
                }
            } catch (error) {
                const status = error.response?.status;
                const errDetail = error.response?.data?.error?.message || error.message;
                console.warn(`⚠️ Cloud Node Rejection/Timeout (Status: ${status}): ${errDetail}. Rerouting to Local Edge...`);
            }
        } else {
            console.warn("⚠️ GEMINI_API_KEY is missing or unconfigured in .env. Skipping cloud layer...");
        }

        // --- 2. LOCAL EDGE INFERENCE: Ollama (llama3.2-vision) ---
        try {
            const targetEndpoint = `${this.ollamaUrl}/api/generate`;
            console.log(`🧠 Hardware Injection: Transmitting image matrix to ${targetEndpoint}...`);
            
            const ollamaResponse = await axios.post(targetEndpoint, {
                model: "llama3.2-vision:latest", 
                prompt: promptText,
                images: [base64Image],
                stream: false,
                options: {
                    num_ctx: 512,
                    temperature: 0.1
                },
                keep_alive: "30m"
            }, { 
                timeout: this.edgeTimeoutMs,
                httpAgent: this.localAgent,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const fishName = ollamaResponse.data.response.trim();
            console.log(`✅ Local Edge Success: ${fishName}`);
            return { species: fishName, engine: 'ollama' };
            
        } catch (localError) {
            console.error("❌ Infrastructure Failure: Both Cloud and Edge processing units failed:", localError.message);
            return { species: "Unknown Fish", engine: 'failed' };
        }
    }
}

module.exports = new AIService();