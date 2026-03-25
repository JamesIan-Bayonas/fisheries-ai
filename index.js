require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const axios = require('axios');
const aiService = require('./services/ai.service');
const isdalogApi = require('./services/isdalog.api');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Initialize Session Middleware to remember data between messages
bot.use(session());

bot.start(async (ctx) => {
    try {
        await ctx.reply("🔄 Connecting your maritime identity to IsdaLog...");
        await isdalogApi.handshake(ctx.from.id, ctx.from.first_name);
        await ctx.reply(`✅ Welcome aboard, ${ctx.from.first_name}! Send me a photo of your catch to begin.`);
    } catch (error) {
        // Log the actual technical error to the Docker console
        console.error("Handshake Error Details:", error.message || error);
        await ctx.reply("⚠️ Error connecting to the maritime database. Please try again.");
    }
});

// Step 1 of Workflow: Receive Photo
bot.on('photo', async (ctx) => {
    try {
        await ctx.reply("🐟 Scanning catch with Edge-AI...");
        
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        const aiData = await aiService.analyzeCatchImage(imageBuffer);
        
        // Save the AI result to the user's session memory
        ctx.session ??= {};
        ctx.session.pendingCatch = aiData;
        
        // Ask for location using a native Telegram UI button
        await ctx.reply(
            `I identified a ${aiData.species} weighing ~${aiData.weight}kg.\n\nPlease share your current GPS location to finalize the log.`,
            Markup.keyboard([
                Markup.button.locationRequest('📍 Send Catch Location')
            ]).resize().oneTime()
        );
    } catch (error) {
        console.error(error);
        await ctx.reply("⚠️ Failed to process. Please ensure the image clearly shows the fish.");
    }
});

// Step 2 of Workflow: Receive Location
bot.on('location', async (ctx) => {
    try {
        // Check if they sent a photo first
        if (!ctx.session || !ctx.session.pendingCatch) {
            return ctx.reply("⚠️ Please send a photo of the fish first before sending your location.", Markup.removeKeyboard());
        }

        const lat = ctx.message.location.latitude;
        const lon = ctx.message.location.longitude;
        const aiData = ctx.session.pendingCatch;

        await ctx.reply("📡 Syncing securely to IsdaLog Database...");

        // Send combined data to Laravel
        await isdalogApi.logCatch(aiData, ctx.from.id, lat, lon);
        
        // Clear the session memory
        ctx.session.pendingCatch = null;
        
        await ctx.reply(`✅ Logged Successfully with GPS Coordinates!\n\nSpecies: ${aiData.species}\nWeight: ${aiData.weight} kg`, Markup.removeKeyboard());
    } catch (error) {
        console.error(error);
        await ctx.reply("⚠️ Database sync failed. Please try again.");
    }
});

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log('[Bot] Telegram connection established. Geospatial Module active.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));