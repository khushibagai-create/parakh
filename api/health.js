const SUPPORTED = ['Tomato', 'Watermelon', 'Mango', 'Banana', 'Apple', 'Onion', 'Potato', 'Spinach', 'Cauliflower', 'Brinjal', 'Carrot', 'Papaya', 'Grapes'];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true,
    model: process.env.PARAKH_MODEL || 'anthropic/claude-sonnet-4.5',
    supported: SUPPORTED,
  });
}
