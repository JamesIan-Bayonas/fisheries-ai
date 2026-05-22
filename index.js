require('dotenv').config();
const { checkSeaConditions } = require('./services/weather.service');
const TelegramBot = require('node-telegram-bot-api');
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Temporary memory store for the conversational loop
const userSessions = {};

console.log("🎣 IsdaLog Telegram AI Bot is running...");

// Step 1: Listen for Photos
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, "📡 Checking local sea conditions in Dipolog City...");
    const seaCondition = await checkSeaConditions();
    
    if (!seaCondition.isSafe) {
        // If dangerous, send the red alert and STOP the function immediately
        bot.sendMessage(chatId, seaCondition.message);
        return; 
    }

    bot.sendMessage(chatId, "✅ Sea conditions safe. Scanning catch using Gemini AI...");

    try {
        const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
        
        // Download image buffer from Telegram
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // --- AUTOMATED VISION LAYER ---
        const aiResult = await aiService.identifyFish(imageBuffer, 'image/jpeg');
        const fishNameString = aiResult.species;

        // Initialize session matching both local UI values and Laravel API structures
        userSessions[chatId] = {
            telegram_chat_id: String(chatId), // Stored as string to find the user in Laravel
            species: fishNameString,           // Named 'species' to pass validation directly
            lat: "8.6512",                    // Default geospatial coordinates for Galas Port
            lon: "123.4211"
        };

        // Send the confirmation down to Telegram
        bot.sendMessage(chatId, `🎯 Identified: **${fishNameString}**!\n\nPlease type the total weight in kilograms (e.g., 15):`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "❌ Sorry, the AI vision service failed. Please try again.");
    }
});

// Step 2: Listen for the Weight Input
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || msg.photo || text.startsWith('/')) return;

    const session = userSessions[chatId];
    // Check if session exists and weight hasn't been assigned yet
    if (session && !session.weight) {
        const weight = parseFloat(text);

        if (isNaN(weight)) {
            return bot.sendMessage(chatId, "⚠️ Please enter a valid number (e.g., 15).");
        }

        // Apply dynamic baseline pricing calculations purely for the visual summary text
        let pricePerKg = 150;
        if (session.species.includes('Lapu-Lapu')) pricePerKg = 250;
        if (session.species.includes('Tuna') || session.species.includes('Ahi')) pricePerKg = 300;
        if (session.species.includes('Bangus')) pricePerKg = 120;

        session.weight = weight; // Named 'weight' to match Laravel's $request->weight payload
        const estimatedStartingPrice = pricePerKg * weight;

        // Step 3: The Zero-Typing Confirmation Button
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Publish to Marketplace", callback_data: "publish" }],
                    [{ text: "❌ Cancel", callback_data: "cancel" }]
                ]
            },
            parse_mode: 'Markdown'
        };

        const summary = `📋 **Catch Summary**\n\n🐟 Species: ${session.species}\n⚖️ Weight: ${session.weight} kg\n📍 Port Context: Galas Port\n💰 Est. Value: ₱${estimatedStartingPrice.toFixed(2)}\n\nIs this correct?`;
        bot.sendMessage(chatId, summary, options);
    }
});

// Step 4: Handle the Button Click
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const session = userSessions[chatId];

    if (!session) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired." });
    }

    if (action === 'publish') {
        bot.editMessageText("🚀 Publishing to IsdaLog Trading Floor...", { chat_id: chatId, message_id: msg.message_id });

        try {
            // Sends the compiled session object ({telegram_chat_id, species, weight, lat, lon}) to Laravel
            await isdalogApi.publishCatch(session);
            
            bot.editMessageText("✅ **Successfully Published!**\nMerchants are now viewing your catch on the trading floor.", { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' });
            delete userSessions[chatId];
        } catch (error) {
            console.error("API Error details:", error.message);
            bot.editMessageText("❌ Failed to drop catch metadata onto web nodes. Check server tunnel status.", { chat_id: chatId, message_id: msg.message_id });
        }
    } else if (action === 'cancel') {
        bot.editMessageText("❌ Cancelled.", { chat_id: chatId, message_id: msg.message_id });
        delete userSessions[chatId];
    }

    bot.answerCallbackQuery(callbackQuery.id);
});