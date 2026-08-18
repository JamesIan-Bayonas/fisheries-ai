// index.js
require('dotenv').config();
const { checkSeaConditions } = require('./services/weather.service');
const TelegramBotRaw = require('node-telegram-bot-api');
const TelegramBot = TelegramBotRaw.default || TelegramBotRaw;
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ============================================================================
// 🛡️ PROCESS-LEVEL NETWORK RESILIENCE & EXCEPTION GUARDS
// ============================================================================
process.on('unhandledRejection', (reason) => {
    console.warn('⚠️ Unhandled Promise Rejection (Network/Telegram API):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught System Exception:', err?.message || err);
});

// ============================================================================
// 🧼 CLOUD WEBHOOK FLUSH & POLLING DEFENSE
// ============================================================================
bot.deleteWebhook()
    .then(() => console.log("🧼 Telegram Webhook cache purged."))
    .catch((err) => console.warn("⚠️ Webhook purge notice:", err.message));

bot.on('polling_error', (error) => {
    console.warn('⚠️ Polling Network Notice:', error.message);
});

// Session State Storage
const userSessions = {};

// Port Matrix & Coordinates
const PORT_COORDINATES = {
    'Galas Port': { lat: '8.5800', lon: '123.3300', tag: 'DIPOLOG NORTH' },
    'Dipolog Port': { lat: '8.5725', lon: '123.3211', tag: 'DIPOLOG CENTRAL' },
    'Sicayab Port': { lat: '8.5910', lon: '123.3450', tag: 'SICAYAB DOCK' },
    'Dapitan Port': { lat: '8.6512', lon: '123.4211', tag: 'DAPITAN HARBOR' },
};

console.log("🎣 IsdaLog Terminal Bot [Terminal UI & Interactive Edit Edition] is active.");

// ============================================================================
// 🛡️ INPUT SANITIZATION HELPERS
// ============================================================================
function sanitizeNumericInput(rawInput) {
    if (!rawInput) return null;
    const cleaned = rawInput.toString().toLowerCase()
        .replace(/₱|php|pesos|per\s*kg|\/kg|kg|kgs|kilos|kilo/g, '')
        .trim();

    const parsed = parseFloat(cleaned);
    return (!isNaN(parsed) && parsed > 0) ? Math.round(parsed * 100) / 100 : null;
}

// ============================================================================
// 🖼️ UI CARD GENERATORS (HTML Terminal Styling)
// ============================================================================
function renderSummaryCard(session) {
    const unitPrice = session.price_per_kg ? session.price_per_kg.toFixed(2) : '0.00';
    const totalPrice = session.starting_price ? session.starting_price.toFixed(2) : '0.00';
    const portTag = PORT_COORDINATES[session.location]?.tag || 'CUSTOM SITE';

    return `
<b>╔═════════════════════════════╗</b>
<b>║   ⚓ ISDALOG HARVEST TERMINAL   ║</b>
<b>╚═════════════════════════════╝</b>
<code>STATUS: [STAGED FOR AUCTION]</code>

<b>┌── CATCH SPECIFICATIONS ────────┐</b>
│ 🐟 <b>Species:</b>     <code>${session.species}</code>
│ ⚖️ <b>Gross Weight:</b> <code>${session.weight} kg</code>
│ 🏷️ <b>Asking Price:</b> <code>₱${unitPrice} / kg</code>
│ 💰 <b>Floor Value:</b>  <code>₱${totalPrice}</code>
│ 📍 <b>Landing Hub:</b>  <code>${session.location}</code> (${portTag})
<b>└────────────────────────────────┘</b>

<i>Verify harvest metrics before broadcasting to the trading floor. Tap any item below to modify.</i>`;
}

function getSummaryKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "🚀 Confirm & Publish to Floor", callback_data: "publish" }
            ],
            [
                { text: "✏️ Edit Species", callback_data: "edit_species" },
                { text: "✏️ Edit Weight", callback_data: "edit_weight" }
            ],
            [
                { text: "✏️ Edit Price/Kg", callback_data: "edit_price" },
                { text: "⚓ Change Port", callback_data: "edit_port" }
            ],
            [
                { text: "❌ Abort & Discard Listing", callback_data: "cancel" }
            ]
        ]
    };
}

function getPortSelectionKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "⚓ Galas Port", callback_data: "port_Galas Port" },
                { text: "⚓ Dipolog Port", callback_data: "port_Dipolog Port" }
            ],
            [
                { text: "⚓ Sicayab Port", callback_data: "port_Sicayab Port" },
                { text: "⚓ Dapitan Port", callback_data: "port_Dapitan Port" }
            ],
            [
                { text: "✍️ Type Custom Landing Site", callback_data: "port_custom" }
            ]
        ]
    };
}

// ============================================================================
// 🔗 /start HANDLER (Deep Linking & Handshake)
// ============================================================================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startPayload = match && match[1] ? match[1].trim() : '';

    if (startPayload.startsWith('link_')) {
        const token = startPayload.replace('link_', '');
        const username = msg.from.username || msg.from.first_name || '';

        try {
            const response = await axios.post(`${process.env.LARAVEL_API_URL}/api/telegram/link`, {
                token: token,
                telegram_chat_id: String(chatId),
                telegram_username: username,
            });

            if (response.data.status === 'success') {
                return await bot.sendMessage(
                    chatId,
                    `<b>✅ [AUTHENTICATION CLEARED]</b>\n\nWelcome operator <b>${response.data.user.name}</b>.\nYour cellular terminal is linked to IsdaLog Core.\n\n<i>📸 Transmit catch photos directly to initiate classification.</i>`,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Authorization token expired.';
            return await bot.sendMessage(chatId, `<b>❌ [LINKING REJECTED]</b>\n${message}`, { parse_mode: 'HTML' });
        }
    }

    return await bot.sendMessage(
        chatId,
        `<b>⚓ ISDALOG HARBOR AI CONSOLE</b>\n<code>TELEMETRY NODE: READY</code>\n\n📸 <b>Send a photo</b> of your catch to start AI analysis.\n⌨️ Use /manual to record a catch without camera image.`,
        { parse_mode: 'HTML' }
    );
});

// ============================================================================
// ⌨️ /manual OVERRIDE HANDLER
// ============================================================================
bot.onText(/\/manual/, async (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = {
        telegram_chat_id: String(chatId),
        species: null,
        image_base64: null,
        state: 'AWAITING_SPECIES'
    };

    await bot.sendMessage(
        chatId,
        `<b>[MANUAL HARVEST REGISTRATION]</b>\n\n🐟 <b>Step 1/3:</b> Type the common fish species (e.g. <i>Lapu-Lapu, Bangus, Yellowfin Tuna</i>):`,
        { parse_mode: 'HTML' }
    );
});

// ============================================================================
// 📸 VISION PIPELINE (Photo Capture & OCR)
// ============================================================================
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        await bot.sendMessage(chatId, "<code>[TELEMETRY] Probing maritime sea conditions in Zamboanga del Norte...</code>", { parse_mode: 'HTML' });
        const seaCondition = await checkSeaConditions();

        if (!seaCondition.isSafe) {
            await bot.sendMessage(chatId, `<b>⚠️ [WEATHER WARNING]</b>\n${seaCondition.message}`, { parse_mode: 'HTML' });
            return;
        }

        await bot.sendMessage(chatId, "<code>[VISION ENGINE] Analyzing biological catch matrix via Gemini Flash...</code>", { parse_mode: 'HTML' });

        const photo = msg.photo.length > 1 ? msg.photo[msg.photo.length - 2] : msg.photo[0];
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        const aiResult = await aiService.identifyFish(imageBuffer);

        if (!aiResult || aiResult.species === "Unknown Fish" || aiResult.engine === "failed") {
            throw new Error("Resolution Inconclusive");
        }

        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            species: aiResult.species,
            image_base64: imageBuffer.toString('base64'),
            state: 'AWAITING_WEIGHT'
        };

        await bot.sendMessage(
            chatId,
            `<b>🎯 SPECIES IDENTIFIED:</b> <code>${aiResult.species}</code>\n<i>Engine: ${aiResult.engine.toUpperCase()}</i>\n\n⚖️ <b>Step 2/3:</b> Enter total catch weight in <b>kilograms</b> (e.g. <code>12.5</code> or <code>15kg</code>):`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.warn(`⚠️ Vision/Transport Alert: ${error.message}`);
        userSessions[chatId] = {
            telegram_chat_id: String(chatId),
            state: 'AWAITING_SPECIES'
        };

        try {
            await bot.sendMessage(
                chatId,
                `<b>⚠️ [VISION CLASSIFICATION NOTICE]</b>\nAI could not confidently identify the species from this angle.\n\n🐟 <b>Please type the fish species name manually:</b>`,
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "⌨️ Manual Species Input", callback_data: "trigger_manual" }]]
                    },
                    parse_mode: 'HTML'
                }
            );
        } catch (sendErr) {
            console.error('Failed to dispatch error fallback message:', sendErr.message);
        }
    }
});

// ============================================================================
// 💬 STATE-DRIVEN TEXT LISTENER WITH INPUT GUARDRAILS
// ============================================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || msg.photo || text.startsWith('/')) return;

    const session = userSessions[chatId];
    if (!session) return;

    try {
        // 1. AWAITING / EDITING SPECIES
        if (session.state === 'AWAITING_SPECIES' || session.state === 'EDITING_SPECIES') {
            if (text.trim().length < 2) {
                return await bot.sendMessage(chatId, "<b>⚠️ Invalid Name:</b> Please type a valid fish species name.", { parse_mode: 'HTML' });
            }

            session.species = text.trim();

            if (session.state === 'EDITING_SPECIES') {
                session.state = 'AWAITING_CONFIRMATION';
                return await bot.sendMessage(chatId, renderSummaryCard(session), { reply_markup: getSummaryKeyboard(), parse_mode: 'HTML' });
            }

            session.state = 'AWAITING_WEIGHT';
            return await bot.sendMessage(
                chatId,
                `<b>✓ Species Logged:</b> <code>${session.species}</code>\n\n⚖️ <b>Step 2/3:</b> Enter weight in <b>kg</b> (e.g. <code>25</code> or <code>15.5 kg</code>):`,
                { parse_mode: 'HTML' }
            );
        }

        // 2. AWAITING / EDITING WEIGHT (Guardrail Protected)
        if (session.state === 'AWAITING_WEIGHT' || session.state === 'EDITING_WEIGHT') {
            const parsedWeight = sanitizeNumericInput(text);

            if (!parsedWeight) {
                return await bot.sendMessage(
                    chatId,
                    `<b>⚠️ Non-Numerical Weight Detected!</b>\n\nYou entered: <code>"${text}"</code>\nPlease input a valid positive number.\n<i>Examples:</i> <code>15</code>, <code>24.5</code>, or <code>30kg</code>.`,
                    { parse_mode: 'HTML' }
                );
            }

            session.weight = parsedWeight;

            if (session.price_per_kg) {
                session.starting_price = Math.round((session.weight * session.price_per_kg) * 100) / 100;
            }

            if (session.state === 'EDITING_WEIGHT') {
                session.state = 'AWAITING_CONFIRMATION';
                return await bot.sendMessage(chatId, renderSummaryCard(session), { reply_markup: getSummaryKeyboard(), parse_mode: 'HTML' });
            }

            session.state = 'AWAITING_PRICE';
            return await bot.sendMessage(
                chatId,
                `<b>✓ Weight Logged:</b> <code>${session.weight} kg</code>\n\n💰 <b>Step 3/3:</b> Enter your asking price per kilogram in <b>₱</b> (e.g. <code>180</code> or <code>₱220/kg</code>):`,
                { parse_mode: 'HTML' }
            );
        }

        // 3. AWAITING / EDITING PRICE (Guardrail Protected)
        if (session.state === 'AWAITING_PRICE' || session.state === 'EDITING_PRICE') {
            const parsedPrice = sanitizeNumericInput(text);

            if (!parsedPrice) {
                return await bot.sendMessage(
                    chatId,
                    `<b>⚠️ Non-Numerical Price Detected!</b>\n\nYou entered: <code>"${text}"</code>\nPlease input a valid numeric amount per kilogram.\n<i>Examples:</i> <code>150</code>, <code>220.50</code>, or <code>₱180/kg</code>.`,
                    { parse_mode: 'HTML' }
                );
            }

            session.price_per_kg = parsedPrice;
            session.starting_price = Math.round((session.weight * parsedPrice) * 100) / 100;

            if (session.state === 'EDITING_PRICE') {
                session.state = 'AWAITING_CONFIRMATION';
                return await bot.sendMessage(chatId, renderSummaryCard(session), { reply_markup: getSummaryKeyboard(), parse_mode: 'HTML' });
            }

            session.state = 'AWAITING_PORT_CHOICE';
            return await bot.sendMessage(
                chatId,
                `<b>✓ Valuation Calculated:</b>\n💰 Unit: <code>₱${session.price_per_kg.toFixed(2)}/kg</code>\n💵 Starting Floor: <code>₱${session.starting_price.toFixed(2)}</code>\n\n📍 <b>Select Destination Landing Port:</b>`,
                { reply_markup: getPortSelectionKeyboard(), parse_mode: 'HTML' }
            );
        }

        // 4. AWAITING CUSTOM PORT NAME
        if (session.state === 'AWAITING_CUSTOM_PORT') {
            if (text.trim().length < 2) {
                return await bot.sendMessage(chatId, "<b>⚠️ Invalid Site:</b> Please type a valid location or port name.", { parse_mode: 'HTML' });
            }

            session.location = text.trim();
            session.lat = '8.5800';
            session.lon = '123.3300';
            session.state = 'AWAITING_CONFIRMATION';

            return await bot.sendMessage(chatId, renderSummaryCard(session), { reply_markup: getSummaryKeyboard(), parse_mode: 'HTML' });
        }
    } catch (msgErr) {
        console.error('Message routing failure:', msgErr.message);
    }
});

// ============================================================================
// 🔘 CALLBACK QUERY MATRIX (Actions, Field Edits, Port Select)
// ============================================================================
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    if (action === 'trigger_manual') {
        userSessions[chatId] = { telegram_chat_id: String(chatId), state: 'AWAITING_SPECIES' };
        await bot.sendMessage(chatId, "🐟 <b>Please type the fish species name:</b>", { parse_mode: 'HTML' });
        return await bot.answerCallbackQuery(callbackQuery.id);
    }

    const session = userSessions[chatId];
    if (!session) {
        return await bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Send a new photo or type /manual." });
    }

    try {
        // --- FIELD EDIT BUTTONS ---
        if (action === 'edit_species') {
            session.state = 'EDITING_SPECIES';
            await bot.sendMessage(chatId, "✏️ <b>Enter the revised fish species name:</b>", { parse_mode: 'HTML' });
            return await bot.answerCallbackQuery(callbackQuery.id);
        }

        if (action === 'edit_weight') {
            session.state = 'EDITING_WEIGHT';
            await bot.sendMessage(chatId, `✏️ Current weight is <code>${session.weight} kg</code>.\n<b>Type the new weight in kg:</b>`, { parse_mode: 'HTML' });
            return await bot.answerCallbackQuery(callbackQuery.id);
        }

        if (action === 'edit_price') {
            session.state = 'EDITING_PRICE';
            await bot.sendMessage(chatId, `✏️ Current price is <code>₱${session.price_per_kg}/kg</code>.\n<b>Type the new price per kg in ₱:</b>`, { parse_mode: 'HTML' });
            return await bot.answerCallbackQuery(callbackQuery.id);
        }

        if (action === 'edit_port') {
            session.state = 'AWAITING_PORT_CHOICE';
            await bot.sendMessage(chatId, "⚓ <b>Select your revised landing port:</b>", {
                reply_markup: getPortSelectionKeyboard(),
                parse_mode: 'HTML'
            });
            return await bot.answerCallbackQuery(callbackQuery.id);
        }

        // --- PORT SELECTION MATRIX ---
        if (action.startsWith('port_')) {
            const portChoice = action.replace('port_', '');

            if (portChoice === 'custom') {
                session.state = 'AWAITING_CUSTOM_PORT';
                await bot.editMessageText("✍️ <b>Type the specific landing site or barangay port name:</b>", {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'HTML'
                });
                return await bot.answerCallbackQuery(callbackQuery.id);
            }

            session.location = portChoice;
            session.lat = PORT_COORDINATES[portChoice]?.lat || '8.5800';
            session.lon = PORT_COORDINATES[portChoice]?.lon || '123.3300';
            session.state = 'AWAITING_CONFIRMATION';

            await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            await bot.sendMessage(chatId, renderSummaryCard(session), { reply_markup: getSummaryKeyboard(), parse_mode: 'HTML' });
            return await bot.answerCallbackQuery(callbackQuery.id);
        }

        // --- MARKETPLACE PUBLICATION & CANCELLATION ---
        if (action === 'publish') {
            await bot.editMessageText("<code>[BROADCASTING] Transmitting payload to IsdaLog WebSocket floor...</code>", {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'HTML'
            });

            try {
                await isdalogApi.publishCatch(session);
                await bot.editMessageText(
                    `<b>✅ [AUCTION BROADCAST LIVE]</b>\n\nYour catch of <b>${session.species}</b> (${session.weight} kg) is now live on the trading floor at <code>₱${session.starting_price.toFixed(2)}</code>.\n\n<i>Buyers and logistics couriers can now submit bids.</i>`,
                    { chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML' }
                );
                delete userSessions[chatId];
            } catch (error) {
                console.error("API Transmission Error:", error.message);
                await bot.editMessageText("<b>❌ [REGISTRATION FAILED]</b>\nCould not persist listing to the core database. Verify Laravel API connectivity.", {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'HTML'
                });
            }
        } else if (action === 'cancel') {
            await bot.editMessageText("<b>❌ [SESSION PURGED]</b>\nListing discarded. Send a new photo or type /manual to restart.", {
                chat_id: chatId,
                message_id: msg.message_id, 
                parse_mode: 'HTML'
            });
            delete userSessions[chatId];
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (cbErr) {
        console.error('Callback execution failure:', cbErr.message);
    }
});