require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Initialize the new Gemini client properly
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. The AI Reasoning Function (Updated to actually talk to Gemini)
async function analyzeCatch(photoUrl) {
    console.log("🧠 Fetching image and sending to AI...");

    // Fetch the image from Telegram's servers
    const response = await fetch(photoUrl);
    const buffer = await response.arrayBuffer();

    const promptText = "Analyze this fish catch photo. Return ONLY JSON with: {\"freshness_grade\": \"Fresh\"|\"Fermentation\", \"primary_species\": \"string\", \"contains_bycatch\": true|false}. Do not include markdown formatting or backticks.";

    // Use the NEW SDK syntax to send the image and prompt
    const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            promptText,
            {
                inlineData: {
                    data: Buffer.from(buffer).toString("base64"),
                    mimeType: "image/jpeg",
                },
            },
        ],
    });

    // Parse the AI's text response back into a JSON object
    const text = result.text;
    console.log("✅ AI Response received:", text);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// 2. The Telegram Listener
// 2. The Telegram Listener (DEBUG MODE)
bot.on('photo', async (ctx) => {
    try {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const fileUrl = await ctx.telegram.getFileLink(fileId);

        console.log("👀 New photo detected!");
        await ctx.reply("🕒 Analyzing your catch... please wait.");

        const result = await analyzeCatch(fileUrl);

        if (result.freshness_grade === "Fresh") {
            await ctx.reply(`✅ GRADE A: ${result.primary_species} detected. Sending to Fresh Market...`);
        } else {
            await ctx.reply(`⚠️ GRADE B: Found ${result.primary_species}. Routing to Processors.`);
        }
    } catch (error) {
        // Force the terminal to print a massive error
        console.error("🔥 CRITICAL ERROR 🔥\n", error);
        
        // THE MAGIC TRICK: Send the error straight to the fisherman's phone!
        await ctx.reply(`🛠️ DEV DEBUG MODE:\nI crashed! The reason is: ${error.message}`);
    }
});

// 3. The Webhook Middleware (The "Doorbell")
// This MUST match the path you used in your browser handshake
app.use(bot.webhookCallback('/secret-path'));

// 4. Start the Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Isdalog Connect is live on port ${PORT}`);
    console.log(`🔗 Listening for data from: https://omnivorously-unobjectified-herlinda.ngrok-free.dev/secret-path`);
});

// DO NOT USE bot.launch() here. Express handles the "launching" now.