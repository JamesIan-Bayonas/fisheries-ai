require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const axios = require('axios');
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- TRANSLATION DICTIONARY ---
const locales = {
    en: {
        connecting: "🔄 Connecting your maritime identity to IsdaLog...",
        welcome: "✅ Welcome aboard, $NAME! Send me a photo of your catch to begin.",
        errorConn: "⚠️ Error connecting to the maritime database. Please try again.",
        scanning: "🐟 Scanning catch with Edge-AI...",
        identified: (species, weight, conf) => `I identified a ${species} weighing ~${weight}kg (${conf}% confident).`,
        verify: "\n⚠️ Confidence is low. Please verify this visually.",
        askLocation: "Please share your current GPS location to finalize the log.",
        btnLocation: "📍 Send Catch Location",
        errorImg: "⚠️ Failed to process. Please ensure the image clearly shows the fish.",
        needPhoto: "⚠️ Please send a photo of the fish first before sending your location.",
        syncing: "📡 Syncing securely to IsdaLog Database...",
        success: "✅ Logged Successfully with GPS Coordinates!",
        errorSync: "⚠️ Database sync failed. Please try again.",
        langMenu: "Please choose your language / Palihug pagpili sa imong pinulongan:",
        langChanged: "✅ Language set to English."
    },
    ceb: {
        connecting: "🔄 Nagkonekta sa imong identity ngadto sa IsdaLog...",
        welcome: "✅ Maayong pag-abot, $NAME! Padalhi ko og litrato sa imong kuha aron makasugod.",
        errorConn: "⚠️ Naay sipyat sa pagkonekta sa database. Palihug sulayi pag-usab.",
        scanning: "🐟 Gina-scan ang kuha gamit ang Edge-AI...",
        identified: (species, weight, conf) => `Nailhan nako nga kini usa ka ${species} nga may gibug-aton nga ~${weight}kg (${conf}% sigurado).`,
        verify: "\n⚠️ Ubos ang kaseguradohan. Palihug i-verify kini gamit ang imong mga mata.",
        askLocation: "Palihug ipaambit ang imong kasamtangang GPS location aron ma-finalize ang log.",
        btnLocation: "📍 Ipadala ang Lokasyon sa Kuha",
        errorImg: "⚠️ Napakyas sa pagproseso. Palihug siguroha nga klaro ang isda sa litrato.",
        needPhoto: "⚠️ Palihug padala una og litrato sa isda una ipadala ang lokasyon.",
        syncing: "📡 Nag-sync nga luwas ngadto sa IsdaLog Database...",
        success: "✅ Luwas nga na-log uban sa GPS Coordinates!",
        errorSync: "⚠️ Napakyas ang pag-sync sa database. Palihug sulayi pag-usab.",
        langMenu: "Please choose your language / Palihug pagpili sa imong pinulongan:",
        langChanged: "✅ Ang pinulongan gibutang sa Binisaya."
    }
};

// --- MIDDLEWARE ---
bot.use(session());

// Set default language to English if the user is new
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.lang) ctx.session.lang = 'en'; 
    return next();
});

// --- LANGUAGE TOGGLE COMMAND ---
bot.command('language', (ctx) => {
    const lang = ctx.session.lang;
    return ctx.reply(locales[lang].langMenu, 
        Markup.inlineKeyboard([
            Markup.button.callback('English', 'SET_LANG_EN'),
            Markup.button.callback('Bisaya', 'SET_LANG_CEB')
        ])
    );
});

bot.action('SET_LANG_EN', (ctx) => {
    ctx.session.lang = 'en';
    ctx.reply(locales.en.langChanged);
});

bot.action('SET_LANG_CEB', (ctx) => {
    ctx.session.lang = 'ceb';
    ctx.reply(locales.ceb.langChanged);
});


// --- CORE WORKFLOW ---
bot.start(async (ctx) => {
    const lang = ctx.session.lang;
    try {
        await ctx.reply(locales[lang].connecting);
        await isdalogApi.handshake(ctx.from.id, ctx.from.first_name);
        
        // Replace $NAME placeholder dynamically
        const welcomeMsg = locales[lang].welcome.replace('$NAME', ctx.from.first_name);
        await ctx.reply(welcomeMsg);
    } catch (error) {
        console.error(`Handshake Error Details: ${error.message || error}`);
        await ctx.reply(locales[lang].errorConn);
    }
});

// Step 1: Receive Photo
bot.on('photo', async (ctx) => {
    const lang = ctx.session.lang;
    try {
        await ctx.reply(locales[lang].scanning);
        
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        // Analyze image and get the new confidence score
        const aiData = await aiService.analyzeCatchImage(imageBuffer);
        
        ctx.session.pendingCatch = aiData;
        
        // Build dynamic reply based on language and confidence score
        let replyText = locales[lang].identified(aiData.species, aiData.weight, aiData.confidence || 0);
        
        if ((aiData.confidence || 0) < 70) {
            replyText += locales[lang].verify;
        }

        await ctx.reply(`${replyText}\n\n${locales[lang].askLocation}`,
            Markup.keyboard([
                Markup.button.locationRequest(locales[lang].btnLocation)
            ]).resize().oneTime()
        );
    } catch (error) {
        console.error(error);
        await ctx.reply(locales[lang].errorImg);
    }
});

// Step 2: Receive Location
bot.on('location', async (ctx) => {
    const lang = ctx.session.lang;
    try {
        if (!ctx.session.pendingCatch) {
            return ctx.reply(locales[lang].needPhoto, Markup.removeKeyboard());
        }

        const lat = ctx.message.location.latitude;
        const lon = ctx.message.location.longitude;
        const aiData = ctx.session.pendingCatch;

        await ctx.reply(locales[lang].syncing);

        await isdalogApi.logCatch(aiData, ctx.from.id, lat, lon);
        
        ctx.session.pendingCatch = null;
        
        await ctx.reply(`${locales[lang].success}\n\nSpecies: ${aiData.species}\nWeight: ${aiData.weight} kg`, Markup.removeKeyboard());
    } catch (error) {
        console.error(error);
        await ctx.reply(locales[lang].errorSync);
    }
});

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log('[Bot] Telegram connection established. Multi-language & AI Confidence active.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));