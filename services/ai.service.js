const axios = require('axios');

class AIService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.timeoutMs = 8000; // Raised to 8 seconds to allow large image uploads to complete safely
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
                            // FIXED: The base64 inlineData object MUST be placed first at index 0 for validation to pass
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
            console.warn(`⚠️ Cloud Node Rejection/Timeout (${error.message}). Rerouting to Local RTX 4060 Edge...`);

            try {
                const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
                    // FIXED: Changed from "llava" to "llama3.2-vision" to match your modern local model store
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