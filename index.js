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

        // Pass to Gemini
        const fishName = await aiService.identifyFish(imageBuffer, 'image/jpeg');

        // Initialize session
        userSessions[chatId] = {
            user_id: 1, // Hardcoded to Fisherman ID 1 for prototype
            fish_name: fishName,
            location: 'Galas Port',
        };

        bot.sendMessage(chatId, `🎯 Identified: **${fishName}**!\n\nPlease type the total weight in kilograms (e.g., 15):`, { parse_mode: 'Markdown' });

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
    if (session && !session.weight_kg) {
        const weight = parseFloat(text);

        if (isNaN(weight)) {
            return bot.sendMessage(chatId, "⚠️ Please enter a valid number (e.g., 15).");
        }

        // Apply dynamic baseline pricing for the UI
        let basePrice = 1000;
        if (session.fish_name.includes('Lapu-Lapu')) basePrice = 1500;
        if (session.fish_name.includes('Tuna')) basePrice = 2500;
        if (session.fish_name.includes('Bangus')) basePrice = 800;

        session.weight_kg = weight;
        session.starting_price = basePrice;

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

        const summary = `📋 **Catch Summary**\n\n🐟 Species: ${session.fish_name}\n⚖️ Weight: ${session.weight_kg} kg\n📍 Location: ${session.location}\n💰 Est. Starting Bid: ₱${session.starting_price}\n\nIs this correct?`;
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
            await isdalogApi.publishCatch(session);
            bot.editMessageText("✅ **Successfully Published!**\nMerchants are now viewing your catch.", { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' });
            delete userSessions[chatId];
        } catch (error) {
            bot.editMessageText("❌ Failed to connect to Laravel Server. Make sure it is running.", { chat_id: chatId, message_id: msg.message_id });
        }
    } else if (action === 'cancel') {
        bot.editMessageText("❌ Cancelled.", { chat_id: chatId, message_id: msg.message_id });
        delete userSessions[chatId];
    }

    bot.answerCallbackQuery(callbackQuery.id);
});