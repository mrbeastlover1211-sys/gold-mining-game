import { readUsers, writeUsers, ensureUser, nowSec, calculateCurrentGold, createCheckpoint } from '../utils/helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, pickaxeType, goldCost } = req.body;
    
    if (!address || !pickaxeType || !goldCost) {
      return res.status(400).json({ error: 'address, pickaxeType, and goldCost required' });
    }
    
    const users = readUsers();
    ensureUser(users, address);
    const user = users[address];
    
    // Calculate current gold from checkpoint
    const currentGold = calculateCurrentGold(user);
    
    if (currentGold < goldCost) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${currentGold.toFixed(2)} but need ${goldCost} gold.` 
      });
    }
    
    // Create checkpoint with current gold minus purchase cost
    user.last_checkpoint_gold = currentGold - goldCost;
    user.checkpoint_timestamp = nowSec();
    
    // Add pickaxe and update mining power
    user.inventory[pickaxeType] = (user.inventory[pickaxeType] || 0) + 1;
    const newCurrentGold = createCheckpoint(user, address);
    
    user.lastActivity = nowSec();
    
    // Save to file
    writeUsers(users);
    
    console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold`);
    
    res.json({
      success: true,
      newGold: newCurrentGold,
      inventory: user.inventory,
      checkpoint: {
        total_mining_power: user.total_mining_power,
        checkpoint_timestamp: user.checkpoint_timestamp,
        last_checkpoint_gold: user.last_checkpoint_gold
      },
      message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
    });
    
  } catch (e) {
    console.error('Buy with gold error:', e);
    res.status(500).json({ error: 'failed to buy pickaxe with gold: ' + (e?.message || 'unknown error') });
  }
}