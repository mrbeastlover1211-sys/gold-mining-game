import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { GOLD_PRICE_SOL, MIN_SELL_GOLD, SOLANA_CLUSTER_URL, TREASURY_SECRET_KEY } from '../utils/constants.js';
import { readUsers, writeUsers, ensureUser, nowSec, totalRate, calculateCurrentGold } from '../utils/helpers.js';

const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

function validateSellAmount(user, requestedAmount, address) {
  const currentGold = calculateCurrentGold(user);
  const maxSellable = currentGold * 0.99; // Allow 1% buffer for timing
  
  if (requestedAmount > maxSellable) {
    console.warn(`🚨 CHEAT DETECTED: Trying to sell more gold than owned by ${address.slice(0, 8)}... Has: ${currentGold.toFixed(2)}, Trying to sell: ${requestedAmount}`);
    return Math.max(0, maxSellable);
  }
  
  return requestedAmount;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, amountGold, clientGold, clientInventory } = req.body || {};
    if (!address || typeof amountGold !== 'number') {
      return res.status(400).json({ error: 'address and amountGold required' });
    }
    
    const users = readUsers();
    ensureUser(users, address);
    const user = users[address];
    
    // ANTI-CHEAT VALIDATION FOR SELLING
    
    // 1. Validate minimum sell amount
    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ error: `minimum sell is ${MIN_SELL_GOLD}` });
    }
    
    // 2. Validate client inventory matches server (for mining rate validation)
    if (clientInventory) {
      const serverInventory = user.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
      for (const [pickaxeType, clientCount] of Object.entries(clientInventory)) {
        if (clientCount !== (serverInventory[pickaxeType] || 0)) {
          console.warn(`Sell attempt with inventory mismatch for ${address}: client ${pickaxeType}=${clientCount}, server=${serverInventory[pickaxeType] || 0}`);
          return res.status(400).json({ error: 'Inventory mismatch detected. Please refresh and try again.' });
        }
      }
    }
    
    // 3. Validate client gold amount is reasonable
    if (clientGold !== undefined) {
      const expectedRate = totalRate(user.inventory || {});
      const timeSinceLastUpdate = nowSec() - (user.lastUpdate || nowSec());
      const maxPossibleGold = user.gold + (expectedRate * Math.min(timeSinceLastUpdate, 7200)); // Max 2 hours
      
      if (clientGold > maxPossibleGold + 500) { // Allow buffer for network delays
        console.warn(`Suspicious sell attempt from ${address}: clientGold=${clientGold}, maxPossible=${maxPossibleGold}`);
        return res.status(400).json({ error: 'Gold amount validation failed. Please sync and try again.' });
      }
      
      // Use the validated client gold as the current amount
      user.gold = Math.min(clientGold, maxPossibleGold);
    }
    
    // 4. Anti-cheat: Validate sell amount against server calculations
    const validatedAmount = validateSellAmount(user, amountGold, address);
    
    if (validatedAmount !== amountGold) {
      console.warn(`🚨 Sell amount adjusted for ${address.slice(0, 8)}... Requested: ${amountGold}, Allowed: ${validatedAmount}`);
    }
    
    // 5. Check if user has enough gold (use current calculated gold)
    const currentGold = calculateCurrentGold(user);
    if (currentGold < validatedAmount) {
      return res.status(400).json({ 
        error: `insufficient gold. You have ${Math.floor(currentGold)} gold but need ${validatedAmount} gold.`,
        currentGold: Math.floor(currentGold)
      });
    }

    const payoutSol = validatedAmount * GOLD_PRICE_SOL;

    // Deduct gold and update server state (use validated amount)
    user.gold = currentGold - validatedAmount;
    user.lastUpdate = nowSec();
    user.lastActivity = nowSec();
    writeUsers(users);

    console.log(`💰 ${address} sold ${amountGold} gold for ${payoutSol} SOL. Remaining gold: ${user.gold}`);

    if (!TREASURY_SECRET_KEY) {
      // No auto payout, record pending
      user.pendingPayouts = user.pendingPayouts || [];
      user.pendingPayouts.push({ address, amountGold, payoutSol, ts: nowSec() });
      writeUsers(users);
      return res.json({ 
        ok: true, 
        payoutSol, 
        mode: 'pending', 
        newGold: user.gold,
        note: 'Server not configured to auto pay. Recorded pending payout.' 
      });
    }

    try {
      const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
      const { Keypair } = await import('@solana/web3.js');
      const kp = Keypair.fromSecretKey(secret);
      const toPubkey = new PublicKey(address);
      const lamports = Math.round(payoutSol * LAMPORTS_PER_SOL);
      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey, lamports }));
      const sig = await connection.sendTransaction(tx, [kp]);
      const conf = await connection.confirmTransaction(sig, 'confirmed');
      return res.json({ 
        ok: true, 
        payoutSol, 
        newGold: user.gold,
        signature: sig, 
        status: conf.value 
      });
    } catch (e) {
      console.error('payout failed', e);
      return res.json({ 
        ok: true, 
        payoutSol, 
        newGold: user.gold,
        mode: 'pending', 
        error: 'auto payout failed; recorded as pending' 
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'sell failed' });
  }
}