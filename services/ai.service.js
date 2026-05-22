// file: jamesian-bayonas/fisheries-ai/services/ai.service.js
const axios = require('axios');

class AIService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.timeoutMs = 5000; 
    }

    async identifyFish(imageBuffer) {
        const base64Image = imageBuffer.toString('base64');
        const promptText = "Identify the fish species. Reply with ONLY the common name (e.g., Lapu-Lapu, Bangus, Yellowfin Tuna). No extra text.";

        try {
            console.log("🌐 Routing to Cloud Node (Google Gemini 1.5 Flash)...");
            
            const geminiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
                {
                    contents: [{
                        parts: [
                            // FIXED: Structural repositioning. Image data MUST sit at array index 0
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
                { timeout: this.timeoutMs }
            );

            const fishName = geminiResponse.data.candidates[0].content.parts[0].text.trim();
            console.log(`✅ Cloud Engine Success: ${fishName}`);
            return { species: fishName, engine: 'gemini' };

        } catch (error) {
            console.warn(`⚠️ Cloud Node Unreachable/Timed Out (${error.message}). Rerouting to Local RTX 4060 Edge...`);

            try {
                const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
                    // FIXED: Changed tag from "llava" to match the modern "llama3.2-vision" model core
                    model: "llama3.2-vision", 
                    prompt: promptText,
                    images: [base64Image],
                    stream: false 
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