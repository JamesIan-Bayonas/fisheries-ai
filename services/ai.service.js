// services/ai.service.js
const { GoogleGenAI } = require('@google/genai');


class AIService {
  constructor() {
    const genAI = new GoogleGenAI(process.env.GEMINI_KEY);
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async analyzeCatchImage(imageBuffer) {
    const prompt = "Analyze this fish catch. Identify the species and estimate the weight in kilograms. Return JSON: {species: string, weight: number}";
    
    const result = await this.model.generateContent([
      prompt,
      { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" } }
    ]);

    const response = await result.response;
    return JSON.parse(response.text());
  }
}

module.exports = new AIService();