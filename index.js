require('dotenv').config();
const { checkSeaConditions } = require('./services/weather.service');
const TelegramBotRaw = require('node-telegram-bot-api');
// Dynamic CommonJS/ESM Interop Unwrapping (Node v24+ Compatibility)
const TelegramBot = TelegramBotRaw.default || TelegramBotRaw;
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ============================================================================
// 🧼 EMERGENCY DEFENSE AUTO-CLEAR
// Forces Telegram to wipe its webhook memory on boot so long-polling won't crash
// ============================================================================
bot.deleteWebHook()
    .then(() => {
        console.log("🧼 Telegram Cloud Webhook Cache successfully wiped clean!");
    })
    .catch((err) => {
        console.error("⚠️ Failed to clear webhook cache:", err.message);
    });
// ============================================================================

// In-memory session state dictionary across conversational loops
const userSessions = {};

console.log("🎣 IsdaLog Telegram AI Bot [Defense-Ready Edition] is running...");

// Command Handler: Manual entry workflow bypassing automated vision model
bot.onText(/\/manual/, (msg) => {
    const chatId = msg.chat.id;
    
    userSessions[chatId] = {
        telegram_chat_id: String(chatId),
        lat: "8.6512", // Default geospatial coordinates for Galas Port
        lon: "123.4211",
        state: 'AWAITING_SPECIES'
    };

    bot.sendMessage(
        chatId, 
        "⌨️ **Manual Override Mode Activated.**\n\nPlease type the common name of the fish caught (e.g., Lapu-Lapu, Bangus, Tuna):", 
        { parse_mode: 'Markdown' }
    );
});

// Step 1: Vision Entry Point (Photo Listener)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, "📡 Checking local sea conditions in Dipolog City...");
    const seaCondition = await checkSeaConditions();
    
    if (!seaCondition.isSafe) {
        bot.sendMessage(chatId, seaCondition.message);
        return; 
    }

    bot.sendMessage(chatId, "✅ Sea conditions safe. Scanning catch using IsdaLog AI Matrix...");

    try {
        const photo = msg.photo.length > 1 ? msg.photo[msg.photo.length - 2] : msg.photo[0];
        
        // Fetch image binary buffer from Telegram CDN
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Dispatch image buffer to dual AI inference pipeline (Gemini Cloud -> Ollama Edge)
        const aiResult = await aiService.identifyFish(imageBuffer, 'image/jpeg');
        
        if (!aiResult || aiResult.species === "Unknown Fish" || aiResult.engine === "failed") {
            throw new Error("AI Engine Resolution Failed.");
        }

        const fishNameString = aiResult.species;

        // Populate session state
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            species: fishNameString,
            lat: "8.6512",
            lon: "123.4211",
            state: 'AWAITING_WEIGHT'
        };

        bot.sendMessage(
            chatId, 
            `🎯 Identified: **${fishNameString}**!\n\nPlease type the total weight in kilograms (e.g., 15):`, 
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        console.warn(`⚠️ Vision Pipeline Choke: ${error.message}. Routing user to graceful manual fallback.`);
        
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            lat: "8.6512",
            lon: "123.4211",
            state: 'AWAITING_SPECIES'
        };

        const fallbackOptions = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⌨️ Enter Species Manually", callback_data: "trigger_manual" }]
                ]
            }
        };

        bot.sendMessage(
            chatId, 
            "⚠️ The automated vision server is currently busy computing heavy image layers. Let's process your catch manually to ensure zero listing downtime!", 
            fallbackOptions
        );
    }
});

// Step 2 & 3: Consolidated State-Driven Text Listener
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Guard clause against non-text components or commands
    if (!text || msg.photo || text.startsWith('/')) return;

    const session = userSessions[chatId];
    if (!session) return;

    // State A: Capturing manual species text input
    if (session.state === 'AWAITING_SPECIES') {
        session.species = text.trim();
        session.state = 'AWAITING_WEIGHT';
        
        return bot.sendMessage(
            chatId, 
            `✅ Saved species as: **${session.species}**\n\nNow, please type the total weight in kilograms (e.g., 15):`, 
            { parse_mode: 'Markdown' }
        );
    }

    // State B: Capturing numerical weight value
    if (session.state === 'AWAITING_WEIGHT') {
        const weight = parseFloat(text);

        if (isNaN(weight)) {
            return bot.sendMessage(chatId, "⚠️ Please enter a valid numerical value for weight (e.g., 15).");
        }

        // Local baseline pricing heuristic
        let pricePerKg = 150;
        if (session.species.toLowerCase().includes('lapu')) pricePerKg = 250;
        if (session.species.toLowerCase().includes('tuna') || session.species.toLowerCase().includes('ahi')) pricePerKg = 300;
        if (session.species.toLowerCase().includes('bangus')) pricePerKg = 120;

        session.weight = weight;
        session.state = 'AWAITING_CONFIRMATION';
        
        const estimatedStartingPrice = pricePerKg * weight;

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Publish to Marketplace", callback_data: "publish" }],
                    [{ text: "❌ Cancel", callback_data: "cancel" }]
                ]
            },
            parse_mode: 'Markdown'
        };

        const summary = `📋 **Catch Summary [Manual Override Mode]**\n\n🐟 Species: ${session.species}\n⚖️ Weight: ${session.weight} kg\n📍 Port Context: Galas Port\n💰 Est. Value: ₱${estimatedStartingPrice.toFixed(2)}\n\nIs this correct?`;
        bot.sendMessage(chatId, summary, options);
    }
});

// Step 4: Callback Query Listener (Inline Action Buttons)
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    // Direct route for manual override button before checking active session
    if (action === 'trigger_manual') {
        console.log(`🛠️ Manual fallback trigger engaged for Chat ID: ${chatId}. Initializing clean state...`);
        
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            lat: "8.6512",
            lon: "123.4211",
            state: 'AWAITING_SPECIES'
        };

        try {
            await bot.editMessageText(
                "⌨️ **Manual Override Mode Active.**\n\nPlease type the common name of the fish caught directly into the chat box below (e.g., Lapu-Lapu, Bangus):", 
                { 
                    chat_id: chatId, 
                    message_id: msg.message_id,
                    parse_mode: 'Markdown'
                }
            );
        } catch (uiError) {
            bot.sendMessage(chatId, "⌨️ Please type the common name of the fish caught directly into the chat box below:");
        }

        return bot.answerCallbackQuery(callbackQuery.id);
    }

    const session = userSessions[chatId];   
    if (!session) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Please use /manual or send a new photo." });
    }

    if (action === 'publish') {
        bot.editMessageText("🚀 Publishing data onto IsdaLog live trading floor...", { chat_id: chatId, message_id: msg.message_id });

        try {
            await isdalogApi.publishCatch(session);
            bot.editMessageText(
                "✅ **Successfully Published!**\nYour item allocation is live on the marketplace trading floor.", 
                { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' }
            );
            delete userSessions[chatId];
        } catch (error) {
            console.error("API Tunnel Broadcast Failure:", error.message);
            bot.editMessageText("❌ Failed to register catch details on web nodes. Check server tunnel status.", { chat_id: chatId, message_id: msg.message_id });
        }
    } else if (action === 'cancel') {
        bot.editMessageText("❌ Session closed. Metadata flushed.", { chat_id: chatId, message_id: msg.message_id });
        delete userSessions[chatId];
    }

    bot.answerCallbackQuery(callbackQuery.id);
});