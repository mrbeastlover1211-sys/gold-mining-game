import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_CLUSTER_URL, TREASURY_PUBLIC_KEY } from '../utils/constants.js';
import { readUsers, ensureUser } from '../utils/helpers.js';

const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in .env and restart server' });
    }

    // Check if user already has land
    const users = readUsers();
    ensureUser(users, address);
    if (users[address].hasLand) {
      return res.status(400).json({ error: 'User already owns land' });
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

    const landCostSOL = 0.01; // 0.01 SOL for land
    const costLamports = Math.round(landCostSOL * LAMPORTS_PER_SOL);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      costLamports,
      landCostSOL
    });
  } catch (e) {
    console.error('purchase-land error', e);
    res.status(500).json({ error: 'failed to create land purchase transaction: ' + (e?.message || 'unknown') });
  }
}