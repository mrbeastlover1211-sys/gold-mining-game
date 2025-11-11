export default async function handler(req, res) {
  // Simple in-memory storage for testing
  global.users = global.users || {};
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    const users = global.users;
    
    // Ensure user exists
    if (!users[address]) {
      users[address] = { 
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 }, 
        total_mining_power: 0,
        checkpoint_timestamp: Math.floor(Date.now() / 1000),
        last_checkpoint_gold: 0,
        lastActivity: Math.floor(Date.now() / 1000),
        hasLand: false,
        landPurchaseDate: null
      };
    }
    
    const u = users[address];
    u.lastActivity = Math.floor(Date.now() / 1000);
    
    // Calculate current gold
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - u.checkpoint_timestamp;
    const goldPerSecond = u.total_mining_power / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const currentGold = u.last_checkpoint_gold + goldMined;
    
    res.json({
      address,
      inventory: u.inventory,
      totalRate: u.total_mining_power / 60,
      gold: currentGold,
      hasLand: u.hasLand || false,
      checkpoint: {
        total_mining_power: u.total_mining_power || 0,
        checkpoint_timestamp: u.checkpoint_timestamp,
        last_checkpoint_gold: u.last_checkpoint_gold || 0
      },
      referralStats: {
        totalReferrals: 0,
        referralGoldEarned: 0,
        activeReferrals: 0
      }
    });
  } catch (e) {
    console.error('Status error:', e);
    res.status(500).json({ error: 'status failed: ' + e.message });
  }
}