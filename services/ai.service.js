const axios = require('axios');

class AIService {
  constructor() {
    // host.docker.internal allows the Docker container to escape its isolated network 
    // and talk directly to your Windows machine's localhost (where Ollama lives)
    this.ollamaUrl = 'http://host.docker.internal:11434/api/generate';
    this.modelName = 'llava'; 
  }

  async analyzeCatchImage(imageBuffer) {
    try {
      console.log(`[Edge-AI] Sending image to local RTX 4060 (${this.modelName})...`);

      const prompt = `
        Analyze this maritime fish catch image. 
        Identify the exact species and estimate the average adult weight in kilograms. 
        Respond ONLY with a valid JSON object in this exact format:
        {"species": "Fish Name", "weight": 0.0}
      `;

      // The payload structure specifically required by Ollama
      const payload = {
        model: this.modelName,
        prompt: prompt,
        images: [imageBuffer.toString('base64')],
        stream: false,
        format: 'json' // Forces Ollama to output strict JSON
      };

      const response = await axios.post(this.ollamaUrl, payload);
      
      const rawText = response.data.response;
      
      // Sanitize any markdown backticks the AI might accidentally include
      const cleanJson = rawText.replace(/```json|```/g, "").trim();
      
      return JSON.parse(cleanJson);

    } catch (error) {
      console.error("[Edge-AI] Local Analysis Failed:", error.message);
      // Failsafe to prevent the bot from entering a crash loop
      return { species: "Unknown (Local AI Error)", weight: 0.0 };
    }
  }
}

module.exports = new AIService();