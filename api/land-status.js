import { readUsers, ensureUser } from '../utils/helpers.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    const users = readUsers();
    ensureUser(users, address);
    const u = users[address];
    
    res.json({
      hasLand: u.hasLand || false,
      landPurchaseDate: u.landPurchaseDate
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to check land status' });
  }
}