require('dotenv').config();
const { checkSeaConditions } = require('./services/weather.service');
const TelegramBot = require('node-telegram-bot-api');
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ============================================================================
// 🧼 EMERGENCY DEFENSE AUTO-CLEAR: PLACED EXACTLY HERE
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

// Memory store for managing conversational states across user loops
const userSessions = {};

console.log("🎣 IsdaLog Telegram AI Bot [Defense-Ready Edition] is running...");

// Command Helper: Start manual workflow bypassing the scanner entirely
bot.onText(/\/manual/, (msg) => {
    const chatId = msg.chat.id;
    
    userSessions[chatId] = {
        telegram_chat_id: String(chatId),
        lat: "8.6512", // Default geospatial coordinates for Galas Port
        lon: "123.4211",
        state: 'AWAITING_SPECIES' // Set the state context flag
    };

    bot.sendMessage(chatId, "⌨️ **Manual Override Mode Activated.**\n\nPlease type the common name of the fish caught (e.g., Lapu-Lapu, Bangus, Tuna):", { parse_mode: 'Markdown' });
});

// Step 1: Listen for Photos (Automated Vision Entry Point)
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
        
        // Download image buffer from Telegram
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Run automated vision request
        const aiResult = await aiService.identifyFish(imageBuffer, 'image/jpeg');
        
        // If the AI fails to parse cleanly, manually trigger the fallback router
        if (!aiResult || aiResult.species === "Unknown Fish" || aiResult.engine === "failed") {
            throw new Error("AI Engine Resolution Failed.");
        }

        const fishNameString = aiResult.species;

        // Initialize state context mapping
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            species: fishNameString,
            lat: "8.6512",
            lon: "123.4211",
            state: 'AWAITING_WEIGHT' // Direct routing to standard weight assignment step
        };

        bot.sendMessage(chatId, `🎯 Identified: **${fishNameString}**!\n\nPlease type the total weight in kilograms (e.g., 15):`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.warn(`⚠️ Vision Pipeline Choke: ${error.message}. Routing user to graceful manual fallback.`);
        
        // Initialize an emergency session payload mapping
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

        bot.sendMessage(chatId, "⚠️ The automated vision server is currently busy computing heavy image layers. Let's process your catch manually to ensure zero listing downtime!", fallbackOptions);
    }
});

// Step 2 & 3: Consolidated State-Driven Text Listener
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Guard closures against non-text components or routing commands
    if (!text || msg.photo || text.startsWith('/')) return;

    const session = userSessions[chatId];
    if (!session) return;

    // BRANCH A: Handling manual species entry string
    if (session.state === 'AWAITING_SPECIES') {
        session.species = text.trim();
        session.state = 'AWAITING_WEIGHT'; // Shift memory focus to weight phase
        
        return bot.sendMessage(chatId, `✅ Saved species as: **${session.species}**\n\nNow, please type the total weight in kilograms (e.g., 15):`, { parse_mode: 'Markdown' });
    }

    // BRANCH B: Handling catch weight assignment processing
    if (session.state === 'AWAITING_WEIGHT') {
        const weight = parseFloat(text);

        if (isNaN(weight)) {
            return bot.sendMessage(chatId, "⚠️ Please enter a valid numerical value for weight (e.g., 15).");
        }

        // Apply fallback visual summary baseline pricing checks
        let pricePerKg = 150;
        if (session.species.toLowerCase().includes('lapu')) pricePerKg = 250;
        if (session.species.toLowerCase().includes('tuna') || session.species.toLowerCase().includes('ahi')) pricePerKg = 300;
        if (session.species.toLowerCase().includes('bangus')) pricePerKg = 120;

        session.weight = weight;
        session.state = 'AWAITING_CONFIRMATION'; // Set final confirmation lock state
        
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

// Step 4: Handle Inline Buttons Actions (Hardened Defense Variant)
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    // DIRECT INTERCEPTION: Route the manual override trigger BEFORE enforcing session validation walls
    if (action === 'trigger_manual') {
        console.log(`🛠️ Manual fallback button clicked for Chat ID: ${chatId}. Injecting clean state...`);
        
        // Force-initialize or heal the user session object directly on the fly
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            lat: "8.6512", // Standard default geospatial coordinates for Galas Port
            lon: "123.4211",
            state: 'AWAITING_SPECIES' // Lock the conversational loop context to accept a text string name
        };

        try {
            // Update the UI message to give the fisherman instant confirmation feedback
            await bot.editMessageText("⌨️ **Manual Override Mode Active.**\n\nPlease type the common name of the fish caught directly into the chat box below (e.g., Lapu-Lapu, Bangus):", { 
                chat_id: chatId, 
                message_id: msg.message_id,
                parse_mode: 'Markdown'
            });
        } catch (uiError) {
            // Fallback backup notice if Telegram throws a message-not-modified anomaly
            bot.sendMessage(chatId, "⌨️ Please type the common name of the fish caught directly into the chat box below:");
        }

        // Cleanly dismiss Telegram's UI loading indicator flag
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    // Standard structural sessions check for subsequent steps ('publish' or 'cancel')
    const session = userSessions[chatId];   
    if (!session) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Please use /manual or drop a new photo." });
    }

    if (action === 'publish') {
        bot.editMessageText("🚀 Publishing data onto IsdaLog live trading floor...", { chat_id: chatId, message_id: msg.message_id });

        try {
            await isdalogApi.publishCatch(session);
            bot.editMessageText("✅ **Successfully Published!**\nYour item allocation is live on the marketplace trading floor.", { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' });
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