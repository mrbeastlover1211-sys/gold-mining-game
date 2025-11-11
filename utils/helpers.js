import { PICKAXES } from './constants.js';
import { getDatabase } from '../database.js';

// Use database instead of file system in serverless
const USE_DATABASE = process.env.DATABASE_URL ? true : false;

export function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

export async function readUsers() {
  if (USE_DATABASE) {
    try {
      const db = await getDatabase();
      const result = await db.query('SELECT wallet, inventory, total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity, has_land, land_purchase_date FROM users');
      const users = {};
      for (const row of result.rows) {
        users[row.wallet] = {
          inventory: row.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          total_mining_power: row.total_mining_power || 0,
          checkpoint_timestamp: row.checkpoint_timestamp || nowSec(),
          last_checkpoint_gold: row.last_checkpoint_gold || 0,
          lastActivity: row.last_activity || nowSec(),
          hasLand: row.has_land || false,
          landPurchaseDate: row.land_purchase_date
        };
      }
      return users;
    } catch (e) {
      console.error('Failed to read users from database', e);
      return {};
    }
  } else {
    // Fallback to in-memory storage for serverless without database
    return global.users || {};
  }
}

export async function writeUsers(data) {
  if (USE_DATABASE) {
    try {
      const db = await getDatabase();
      for (const [wallet, userData] of Object.entries(data)) {
        await db.query(
          `INSERT INTO users (wallet, inventory, total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity, has_land, land_purchase_date) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (wallet) DO UPDATE SET
           inventory = $2, total_mining_power = $3, checkpoint_timestamp = $4, 
           last_checkpoint_gold = $5, last_activity = $6, has_land = $7, land_purchase_date = $8`,
          [wallet, userData.inventory, userData.total_mining_power, userData.checkpoint_timestamp, 
           userData.last_checkpoint_gold, userData.lastActivity, userData.hasLand, userData.landPurchaseDate]
        );
      }
    } catch (e) {
      console.error('Failed to write users to database', e);
    }
  } else {
    // Fallback to in-memory storage
    global.users = data;
  }
}

export async function ensureUser(users, address) {
  if (!users[address]) {
    users[address] = { 
      inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 }, 
      total_mining_power: 0,
      checkpoint_timestamp: nowSec(),
      last_checkpoint_gold: 0,
      lastActivity: nowSec(),
      hasLand: false,
      landPurchaseDate: null
    };
  } else if (!users[address].inventory) {
    users[address].inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  }
  
  if (users[address].total_mining_power === undefined) {
    users[address].total_mining_power = totalRate(users[address].inventory || {}) * 60;
    users[address].checkpoint_timestamp = nowSec();
    users[address].last_checkpoint_gold = users[address].gold || 0;
  }
  
  if (users[address].hasLand === undefined) {
    users[address].hasLand = false;
    users[address].landPurchaseDate = null;
  }
  
  if (!users[address].lastActivity) {
    users[address].lastActivity = nowSec();
  }
}

export function totalRate(inv) {
  let r = 0;
  for (const k of Object.keys(PICKAXES)) {
    r += (inv[k] || 0) * PICKAXES[k].ratePerSec;
  }
  return r;
}

export function calculateCurrentGold(user) {
  if (!user.checkpoint_timestamp || !user.total_mining_power) {
    return user.last_checkpoint_gold || 0;
  }
  
  const currentTime = nowSec();
  const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
  const goldPerSecond = user.total_mining_power / 60;
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  
  return user.last_checkpoint_gold + goldMined;
}

export function createCheckpoint(user, address) {
  const currentGold = calculateCurrentGold(user);
  const newMiningPower = totalRate(user.inventory || {}) * 60;
  
  user.total_mining_power = newMiningPower;
  user.checkpoint_timestamp = nowSec();
  user.last_checkpoint_gold = currentGold;
  
  console.log(`📊 Checkpoint created for ${address.slice(0, 8)}... Gold: ${currentGold.toFixed(2)}, Power: ${newMiningPower}/min`);
  
  return currentGold;
}