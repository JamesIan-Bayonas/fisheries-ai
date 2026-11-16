// File: fishery-ai/tests/ingestion.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { publishCatch, linkAccount } = require('../services/isdalog.api');

test('bridge authenticates linking and preserves publication identity after an uncertain result', async () => {
    process.env.ISDALOG_API_URL = 'https://backend.example/api/';
    process.env.ISDALOG_BOT_SECRET = 'synthetic-test-secret';
    const originalPost = axios.post;
    const requests = [];
    let fail = true;
    axios.post = async (url, payload, options) => {
        requests.push({ url, payload, options });
        if (url.endsWith('/catches') && fail) { fail = false; throw new Error('Synthetic timeout'); }
        return { data: { status: 'success' } };
    };
    try {
        const session = { telegram_chat_id: '123', species: 'Bangus', weight: 5 };
        await assert.rejects(publishCatch(session));
        await publishCatch(session);
        assert.equal(requests[0].payload.submission_id, requests[1].payload.submission_id);
        assert.ok(requests[0].payload.submission_id);
        assert.equal(requests[1].options.headers['X-Isdalog-Bot-Secret'], 'synthetic-test-secret');
        await linkAccount({ token: 'synthetic-token', telegram_chat_id: '123' });
        assert.equal(requests[2].url, 'https://backend.example/api/telegram/link');
        assert.equal(requests[2].options.headers['X-Isdalog-Bot-Secret'], 'synthetic-test-secret');
        delete process.env.ISDALOG_BOT_SECRET;
        await assert.rejects(publishCatch(session), /authentication is not configured/);
        assert.equal(requests.length, 3);
    } finally {
        axios.post = originalPost;
        delete process.env.ISDALOG_API_URL;
        delete process.env.ISDALOG_BOT_SECRET;
    }
});
