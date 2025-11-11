import { PICKAXES, GOLD_PRICE_SOL, MIN_SELL_GOLD, SOLANA_CLUSTER_URL, TREASURY_PUBLIC_KEY } from '../utils/constants.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({
    pickaxes: PICKAXES,
    goldPriceSol: GOLD_PRICE_SOL,
    minSellGold: MIN_SELL_GOLD,
    clusterUrl: SOLANA_CLUSTER_URL,
    treasury: TREASURY_PUBLIC_KEY,
  });
}