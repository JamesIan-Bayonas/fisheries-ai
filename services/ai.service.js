const axios = require('axios');

class AIService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.timeoutMs = 5000; // 5-second threshold for maritime network drops
    }

    async identifyFish(imageBuffer) {
        const base64Image = imageBuffer.toString('base64');
        const promptText = "Identify the exact species of the fish in this image. Respond with ONLY the common name (e.g., Lapu-Lapu, Bangus, Yellowfin Tuna). No extra text.";

        try {
            console.log("🌐 Attempting Cloud Identification (Google Gemini)...");
            
            // Phase 1: The Cloud Attempt
            const geminiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
                {
                    contents: [{
                        parts: [
                            { text: promptText },
                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: base64Image
                                }
                            }
                        ]
                    }]
                },
                { timeout: this.timeoutMs } // Strict timeout guardrail
            );

            const fishName = geminiResponse.data.candidates[0].content.parts[0].text.trim();
            console.log(`✅ Cloud Success: Identified as ${fishName}`);
            return { species: fishName, engine: 'gemini' };

        } catch (error) {
            // Phase 2: The Offline Edge Fallback
            console.warn(`⚠️ Cloud API Failed or Timed Out (${error.message}). Rerouting to Local Edge AI (RTX 4060)...`);

            try {
                const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
                    model: "llava", 
                    prompt: promptText,
                    images: [base64Image],
                    stream: false 
                });

                const fishName = ollamaResponse.data.response.trim();
                console.log(`✅ Edge Fallback Success: Identified as ${fishName}`);
                return { species: fishName, engine: 'ollama' };
                
            } catch (localError) {
                console.error("❌ Critical Failure: Both Cloud and Edge AI failed.", localError.message);
                return { species: "Unknown Fish", engine: 'failed' };
            }
        }
    }
}

module.exports = new AIService();