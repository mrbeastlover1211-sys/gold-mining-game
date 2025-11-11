import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PICKAXES, SOLANA_CLUSTER_URL, TREASURY_PUBLIC_KEY } from '../utils/constants.js';

const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, pickaxeType, quantity } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType]) {
      return res.status(400).json({ error: 'address and valid pickaxeType required' });
    }
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in .env and restart server' });
    }

    let payer, treasury;
    try {
      payer = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'invalid payer address' });
    }
    try {
      treasury = new PublicKey(TREASURY_PUBLIC_KEY);
    } catch {
      return res.status(400).json({ error: 'invalid TREASURY_PUBLIC_KEY in server config' });
    }

    const unitLamports = Math.round(PICKAXES[pickaxeType].costSol * LAMPORTS_PER_SOL);
    const costLamports = unitLamports * qty;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      pickaxeType,
      quantity: qty,
      costLamports,
    });
  } catch (e) {
    console.error('purchase-tx error', e);
    res.status(500).json({ error: 'failed to create transaction: ' + (e?.message || 'unknown') });
  }
}