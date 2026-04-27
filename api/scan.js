import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
};

const MODEL = process.env.PARAKH_MODEL || 'anthropic/claude-sonnet-4.5';

if (!process.env.OPENROUTER_API_KEY) {
  console.warn('OPENROUTER_API_KEY not set — /api/scan will fail until configured in Vercel env vars.');
}

const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://khushibagai-create.github.io/parakh',
    'X-Title': 'Parakh',
  },
});

let cueCards = '';
try {
  cueCards = fs.readFileSync(path.join(process.cwd(), 'api', '_lib', 'cue-cards.md'), 'utf8');
} catch (e) {
  console.warn('cue-cards.md not found — using minimal prompt');
}

const SUPPORTED = ['Tomato', 'Watermelon', 'Mango', 'Banana', 'Apple', 'Onion', 'Potato', 'Spinach', 'Cauliflower', 'Brinjal', 'Carrot', 'Papaya', 'Grapes'];

const SYSTEM_PROMPT = `You are Parakh — परख — an assayer for fresh produce in Indian markets. You examine a single photo of a fruit or vegetable and return a verdict in plain language: BUY, CHECK (do a quick physical check first), or SKIP.

# Supported items
Identify only these 13: ${SUPPORTED.join(', ')}.
If the photo doesn't clearly show one of these, return verdict "unknown".
If the photo is too dark / blurry / occluded, return verdict "retake".

# Verdict rule
- Any STRONG cue from the cue cards failed → "skip"
- Visual cues clean but a non-visual check (smell, bend, wipe) is needed → "hold"
- All visible STRONG cues clean → "pass"

# Voice
Plain everyday English. No jargon. Hindi sublines must be exactly: "खरा है।" (pass), "ठीक है।" (hold), "खोटा है।" (skip).

# Stamp labels
- pass → stampEn "Buy", stampDeva "खरा"
- hold → stampEn "Check", stampDeva "ठीक"
- skip → stampEn "Skip", stampDeva "खोटा"

# Output — strict JSON ONLY, no prose, no markdown fences
{
  "name": "Watermelon",
  "emoji": "🍉",
  "verdict": "pass" | "hold" | "skip" | "unknown" | "retake",
  "stampEn": "Buy" | "Check" | "Skip",
  "stampDeva": "खरा" | "ठीक" | "खोटा",
  "headline": "<short italic-friendly sentence>",
  "deva": "खरा है।" | "ठीक है।" | "खोटा है।",
  "sub": "<one or two sentences, plain language>",
  "list": [
    { "label": "Color", "status": "GOOD" | "OKAY" | "CHECK" | "BAD", "pip": "pass" | "hold" | "skip" },
    { "label": "Surface", "status": "...", "pip": "..." },
    { "label": "<third — Stem, Smell, Skin, Spots, Freshness>", "status": "...", "pip": "..." }
  ],
  "checks": [
    { "icon": "nose" | "hand" | "eye", "title": "<short>", "body": "<1 sentence>" }
  ]
}

For "pass" or "skip", "checks" should be []. For "hold", include 1–2 checks.

# Cue rubric
${cueCards}
`;

function extractJson(text) {
  if (!text) return '{}';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) return brace[0];
  return text.trim();
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const t0 = Date.now();
  const { image } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing "image" — expected base64 data URL.' });
  }
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Image must be a data URL (data:image/jpeg;base64,...).' });
  }

  try {
    const completion = await ai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Assess this produce. Return only the JSON verdict.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let verdict;
    try {
      verdict = JSON.parse(extractJson(raw));
    } catch (parseErr) {
      console.error('Model returned invalid JSON:', raw);
      return res.status(502).json({ error: 'Model returned invalid JSON', raw });
    }

    const allowed = ['pass', 'hold', 'skip', 'unknown', 'retake'];
    if (!allowed.includes(verdict.verdict)) {
      return res.status(502).json({ error: `Invalid verdict "${verdict.verdict}"`, verdict });
    }

    const latency_ms = Date.now() - t0;
    console.log(`[scan] ${verdict.name || '?'} → ${verdict.verdict} (${latency_ms}ms)`);

    return res.json({ ...verdict, latency_ms, model: MODEL });
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: err?.message || 'Scan failed' });
  }
}
