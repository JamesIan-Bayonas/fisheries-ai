const axios = require('axios');

class AIService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    }

    async identifyFish(imageBuffer) {
        try {
            const base64Image = imageBuffer.toString('base64');

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: "llava", // Using the local vision model on your RTX 4060
                prompt: "Identify the exact species of the fish in this image. Respond with ONLY the common name (e.g., Lapu-Lapu, Bangus, Yellowfin Tuna). No extra text.",
                images: [base64Image],
                stream: false // Set to false to get a single clean string back
            });

            return response.data.response.trim();
            
        } catch (error) {
            console.error("Local AI Inference Error:", error.message);
            return "Unknown Fish";
        }
    }
}

module.exports = new AIService();