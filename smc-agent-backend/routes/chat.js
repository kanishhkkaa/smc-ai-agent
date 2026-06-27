const express = require('express');
const router = express.Router();
const axios = require('axios');
const { loadTestData } = require('../dataLoader');
const cache = require('../cache');
require('dotenv').config();

// ─────────────────────────────────────────────────
// Data query — reads from test files (or swap in DB)
// ─────────────────────────────────────────────────
function queryData(intent, params) {
  const calls = loadTestData();

  if (intent === 'get_summary') {
    const companies = [...new Set(calls.map(c => c.company).filter(Boolean))];
    const agents    = [...new Set(calls.map(c => c.agent_name).filter(Boolean))];
    const dates     = [...new Set(calls.map(c => c.date).filter(Boolean))].sort();
    return {
      total_calls:      calls.length,
      unique_agents:    agents.length,
      unique_companies: companies.length,
      date_range: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'N/A',
      companies,
      agents: agents.slice(0, 10)
    };
  }

  if (intent === 'get_calls_by_date') {
    return calls
      .filter(c => c.date === params.date)
      .slice(0, 15)
      .map(c => ({ agent: c.agent_name, company: c.company, phone: c.phone, date: c.date, time: c.time }));
  }

  if (intent === 'get_calls_by_agent') {
    return calls
      .filter(c => c.agent_name && c.agent_name.toLowerCase().includes(params.agent_name.toLowerCase()))
      .slice(0, 15)
      .map(c => ({ agent: c.agent_name, company: c.company, phone: c.phone, date: c.date, time: c.time }));
  }

  if (intent === 'get_calls_by_company') {
    return calls
      .filter(c => c.company && c.company.toLowerCase().includes(params.company.toLowerCase()))
      .slice(0, 15)
      .map(c => ({ agent: c.agent_name, company: c.company, phone: c.phone, date: c.date, time: c.time }));
  }

  if (intent === 'get_recent_calls') {
    return calls.slice(0, 10).map(c => ({
      agent: c.agent_name, company: c.company, phone: c.phone, date: c.date, time: c.time
    }));
  }

  return null;
}

// ─────────────────────────────────────────────────
// POST /api/chat
// ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  try {
    // ── STEP 1: Detect intent (cached) ──────────────
    let intent = 'general_question';
    let params = {};

    // Check intent cache first — same message = same intent
    const cachedIntent = cache.getIntentCache(message);
    if (cachedIntent) {
      intent = cachedIntent.intent;
      params = cachedIntent.params;
    } else {
      // Call GLM for intent detection
      const intentRes = await axios.post(process.env.GLM_URL, {
        model: process.env.GLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a data router. Based on user message, respond with ONLY a valid JSON object like these examples:
{"intent": "get_summary", "params": {}}
{"intent": "get_calls_by_date", "params": {"date": "2026-05-12"}}
{"intent": "get_calls_by_agent", "params": {"agent_name": "Gaurav"}}
{"intent": "get_calls_by_company", "params": {"company": "TATA"}}
{"intent": "get_recent_calls", "params": {}}
{"intent": "general_question", "params": {}}
Only respond with the JSON. No explanation.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 100,
        temperature: 0.1,
        chat_template_kwargs: { enable_thinking: false }
      });

      try {
        const raw     = intentRes.data.choices[0].message.content.trim();
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed  = JSON.parse(cleaned);
        intent = parsed.intent || 'general_question';
        params = parsed.params || {};
      } catch (e) {
        intent = 'general_question';
      }

      // Save intent to cache (30 min TTL)
      cache.setIntentCache(message, { intent, params });
    }

    // ── STEP 2: Fetch data (cached) ──────────────────
    let dbData = null;

    if (intent !== 'general_question') {
      // Check data cache first
      const cachedData = cache.getDataCache(intent, params);

      if (cachedData !== undefined) {
        // Cache hit — use instantly
        dbData = cachedData;
      } else {
        // Cache miss — query data source
        dbData = queryData(intent, params);
        // Save to cache
        cache.setDataCache(intent, params, dbData);
      }
    }

    // ── STEP 3: Generate human-friendly GLM reply ────
    const finalMessages = [
      {
        role: 'system',
        content: `You are an AI assistant for SMC Insurance Conversation Intelligence dashboard. 
Be concise, professional and helpful. If data is provided below, summarise it clearly.`
      },
      ...history,
      { role: 'user', content: message }
    ];

    if (dbData) {
      finalMessages.push({
        role: 'system',
        content: `Database results: ${JSON.stringify(dbData, null, 2)}\nSummarise this for the user in a clear, friendly way.`
      });
    }

    const finalRes = await axios.post(process.env.GLM_URL, {
      model: process.env.GLM_MODEL,
      messages: finalMessages,
      max_tokens: 400,
      temperature: 0.3,
      chat_template_kwargs: { enable_thinking: false }
    });

    return res.json({
      reply:  finalRes.data.choices[0].message.content,
      data:   dbData,
      intent: intent,
      cached: cachedIntent !== undefined // let frontend know if it was a cache hit
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

module.exports = router;