import { ADMIN_TOKEN } from '../../utils/constants.js';

// Note: In serverless, we can't modify the GOLD_PRICE_SOL constant directly
// This would need to be stored in a database or external state store
// For now, this returns an error suggesting the use of environment variables

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, goldPriceSol } = req.body || {};
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const v = parseFloat(goldPriceSol);
  if (!isFinite(v) || v <= 0) {
    return res.status(400).json({ error: 'invalid price' });
  }

  // In serverless environment, we cannot modify constants at runtime
  // This would need to be stored in database or environment variable
  res.status(501).json({ 
    error: 'Price updates in serverless require database storage or environment variable updates. Please update GOLD_PRICE_SOL environment variable in Vercel dashboard.',
    requestedPrice: v
  });
}