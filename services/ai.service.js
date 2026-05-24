const axios = require('axios');
const http = require('http');

class AIService {
    constructor() {
        const rawUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        this.ollamaUrl = rawUrl.replace(/\/$/, '').replace('localhost', '127.0.0.1');
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        
        this.cloudTimeoutMs = 5000; 
        this.edgeTimeoutMs = 5000; 

        // Hardened HTTP Agent to handle massive loopback data serialization
        this.localAgent = new http.Agent({
            keepAlive: false,       // Force sockets to close cleanly after execution
            maxFreeSockets: 10,
            timeout: 60000          // Prevent internal socket pooling freezes
        });
    }

    async identifyFish(imageBuffer) {
        // Clean the base64 data to ensure it is a valid, uncorrupted data sequence
        const base64Image = imageBuffer.toString('base64').replace(/[\r\n]+/g, '').trim();
        const promptText = "Identify the fish species. Reply with ONLY the common name (e.g., Lapu-Lapu, Bangus, Yellowfin Tuna). No extra text.";

        try {
            console.log("🌐 Routing to Cloud Node (Google Gemini 1.5 Flash)...");
            
            const geminiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
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
                { timeout: this.cloudTimeoutMs }
            );

            const fishName = geminiResponse.data.candidates[0].content.parts[0].text.trim();
            console.log(`✅ Cloud Engine Success: ${fishName}`);
            return { species: fishName, engine: 'gemini' };

        } catch (error) {
            console.warn(`⚠️ Cloud Node Rejection/Timeout (${error.message}). Rerouting to Local RTX 4060 Edge...`);

            try {
                const targetEndpoint = `${this.ollamaUrl}/api/generate`;
                console.log(`🧠 Hardware Injection: Transmitting image matrix to ${targetEndpoint}...`);
                
                const ollamaResponse = await axios.post(targetEndpoint, {
                    // Target your clean, base local model tag directly
                    model: "llama3.2-vision:latest", 
                    prompt: promptText,
                    images: [base64Image],
                    stream: false,
                    
                    // OUT-OF-THE-BOX INJECTION: Control the hardware allocation directly from your application layer
                    options: {
                        num_ctx: 512,        // Dynamically forces the VRAM context cache down to free up ~1.5GB of GPU memory
                        temperature: 0.1     // Keeps the identification precise and deterministic
                    },
                    keep_alive: "30m"        // Directs the background daemon to keep the model warm in VRAM for 30 minutes
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
                console.error("❌ Infrastructure Failure: Both Cloud and Edge processing units failed.", localError.message);
                return { species: "Unknown Fish", engine: 'failed' };
            }
        }
    }
}

module.exports = new AIService();