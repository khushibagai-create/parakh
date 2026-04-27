export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { scanId, wasCorrect, note } = req.body || {};
  console.log('[feedback]', { scanId, wasCorrect, note });
  return res.json({ ok: true });
}
