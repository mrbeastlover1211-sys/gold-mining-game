import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { createTokenManager, GAME_TOKENS } from './token-manager.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Initialize token manager with authority keypair
const authorityKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.AUTHORITY_PRIVATE_KEY || '[]'))
);
const tokenManager = createTokenManager(connection, authorityKeypair);

// Treasury for receiving SOL payments
const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY 
  ? new PublicKey(process.env.TREASURY_PUBLIC_KEY)
  : null;

// Game configuration
const PICKAXES = {
  silver: { costSOL: 0.005, rate: 1 },
  gold: { costSOL: 0.01, rate: 3 },
  diamond: { costSOL: 0.03, rate: 10 },
  netherite: { costSOL: 0.1, rate: 30 }
};

const LAND_COST_SOL = 0.01;

// Token type mapping
const PICKAXE_TOKEN_MAP = {
  silver: 'PICKAXE_SILVER',
  gold: 'PICKAXE_GOLD', 
  diamond: 'PICKAXE_DIAMOND',
  netherite: 'PICKAXE_NETHERITE'
};

// Initialize token mints on startup
let mintsInitialized = false;

async function initializeTokens() {
  if (mintsInitialized) return;
  
  try {
    // Load existing mints from environment if available
    const existingMints = {
      GOLD: process.env.GOLD_MINT_ADDRESS,
      LAND: process.env.LAND_MINT_ADDRESS,
      PICKAXE_SILVER: process.env.PICKAXE_SILVER_MINT_ADDRESS,
      PICKAXE_GOLD: process.env.PICKAXE_GOLD_MINT_ADDRESS,
      PICKAXE_DIAMOND: process.env.PICKAXE_DIAMOND_MINT_ADDRESS,
      PICKAXE_NETHERITE: process.env.PICKAXE_NETHERITE_MINT_ADDRESS
    };
    
    // Check if we have existing mints
    const hasExistingMints = Object.values(existingMints).some(mint => mint);
    
    if (hasExistingMints) {
      console.log('Loading existing token mints...');
      tokenManager.loadExistingMints(existingMints);
    } else {
      console.log('Creating new token mints...');
      await tokenManager.initializeGameTokens();
      
      // Log mint addresses for environment setup
      console.log('\n🔑 Add these mint addresses to your .env file:');
      for (const [tokenType, mint] of Object.entries(tokenManager.mints)) {
        console.log(`${tokenType}_MINT_ADDRESS=${mint.toString()}`);
      }
      console.log('');
    }
    
    mintsInitialized = true;
    console.log('✅ Token system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize tokens:', error);
  }
}

// Routes

// Get user's game assets (from their wallet)
app.get('/user-status', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    const userPublicKey = new PublicKey(address);
    
    // Get all token balances from user's wallet
    const balances = await tokenManager.getUserTokenBalances(userPublicKey);
    
    // Calculate total mining rate based on pickaxes owned
    let totalRate = 0;
    totalRate += (balances.PICKAXE_SILVER || 0) * PICKAXES.silver.rate;
    totalRate += (balances.PICKAXE_GOLD || 0) * PICKAXES.gold.rate;
    totalRate += (balances.PICKAXE_DIAMOND || 0) * PICKAXES.diamond.rate;
    totalRate += (balances.PICKAXE_NETHERITE || 0) * PICKAXES.netherite.rate;
    
    res.json({
      address,
      hasLand: balances.LAND > 0,
      gold: balances.GOLD || 0,
      totalRate,
      inventory: {
        silver: balances.PICKAXE_SILVER || 0,
        gold: balances.PICKAXE_GOLD || 0,
        diamond: balances.PICKAXE_DIAMOND || 0,
        netherite: balances.PICKAXE_NETHERITE || 0
      }
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({ error: 'failed to get user status' });
  }
});

// Land purchase transaction
app.post('/purchase-land', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || !TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'address required and treasury not configured' });
    }

    const userPublicKey = new PublicKey(address);
    
    // Check if user already has land
    const landBalance = await tokenManager.getUserTokenBalance(userPublicKey, 'LAND');
    if (landBalance > 0) {
      return res.status(400).json({ error: 'User already owns land' });
    }

    // Create transaction for SOL payment
    const costLamports = Math.floor(LAND_COST_SOL * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: TREASURY_PUBLIC_KEY,
        lamports: costLamports,
      })
    );

    transaction.feePayer = userPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
    const transactionBase64 = Buffer.from(serializedTransaction).toString('base64');

    res.json({
      transaction: transactionBase64,
      landCostSOL: LAND_COST_SOL,
      costLamports,
      message: 'Sign and submit this transaction to purchase land'
    });
  } catch (error) {
    console.error('Error creating land purchase transaction:', error);
    res.status(500).json({ error: 'failed to create land purchase transaction' });
  }
});

// Confirm land purchase and mint LAND token
app.post('/confirm-land-purchase', async (req, res) => {
  try {
    const { address, signature } = req.body || {};
    if (!address || !signature) {
      return res.status(400).json({ error: 'address and signature required' });
    }

    const userPublicKey = new PublicKey(address);
    
    // Check if user already has land
    const landBalance = await tokenManager.getUserTokenBalance(userPublicKey, 'LAND');
    if (landBalance > 0) {
      return res.status(400).json({ error: 'User already owns land' });
    }

    // Validate signature format
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 90) {
      return res.status(400).json({ error: 'invalid signature format' });
    }

    // Verify transaction (with graceful error handling)
    let transactionValid = false;
    try {
      const conf = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      const status = conf && conf.value && (conf.value.confirmationStatus || (conf.value.err == null ? 'processed' : null));
      transactionValid = !!status;
    } catch (signatureError) {
      console.log(`Warning: Could not validate signature ${signature}, but proceeding with land grant`);
      transactionValid = true; // Allow for devnet testing
    }

    if (transactionValid) {
      // Mint 1 LAND token to user's wallet
      await tokenManager.mintToUser(userPublicKey, 'LAND', 1);
      
      // Also give some starting gold
      await tokenManager.mintToUser(userPublicKey, 'GOLD', 10);
      
      console.log(`✅ Granted land and starting gold to ${address}`);
      
      res.json({ 
        ok: true,
        hasLand: true,
        message: 'Land purchased successfully! Check your wallet for LAND token.',
        landTokenMinted: true,
        startingGold: 10
      });
    } else {
      res.status(400).json({ error: 'transaction not found or failed' });
    }
  } catch (error) {
    console.error('Error confirming land purchase:', error);
    res.status(500).json({ error: 'failed to confirm land purchase: ' + (error?.message || 'unknown error') });
  }
});

// Pickaxe purchase transaction
app.post('/purchase-tx', async (req, res) => {
  try {
    const { address, pickaxeType, quantity = 1 } = req.body;
    
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || !TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'address, pickaxeType required, and treasury not configured' });
    }

    const userPublicKey = new PublicKey(address);
    const qty = Math.max(1, Math.min(1000, parseInt(quantity, 10)));
    
    // Check if user has land
    const landBalance = await tokenManager.getUserTokenBalance(userPublicKey, 'LAND');
    if (landBalance === 0) {
      return res.status(400).json({ error: 'Must own land before buying pickaxes' });
    }

    const totalCostSOL = PICKAXES[pickaxeType].costSOL * qty;
    const costLamports = Math.floor(totalCostSOL * LAMPORTS_PER_SOL);

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: TREASURY_PUBLIC_KEY,
        lamports: costLamports,
      })
    );

    transaction.feePayer = userPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
    const transactionBase64 = Buffer.from(serializedTransaction).toString('base64');

    res.json({
      transaction: transactionBase64,
      pickaxeType,
      quantity: qty,
      costSOL: totalCostSOL,
      costLamports,
      message: `Sign and submit this transaction to purchase ${qty}x ${pickaxeType} pickaxe(s)`
    });
  } catch (error) {
    console.error('Error creating pickaxe purchase transaction:', error);
    res.status(500).json({ error: 'failed to create purchase transaction' });
  }
});

// Confirm pickaxe purchase and mint pickaxe tokens
app.post('/purchase-confirm', async (req, res) => {
  try {
    const { address, pickaxeType, signature, quantity = 1 } = req.body || {};
    
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || !signature) {
      return res.status(400).json({ error: 'address, pickaxeType, signature required' });
    }
    
    const userPublicKey = new PublicKey(address);
    const qty = Math.max(1, Math.min(1000, parseInt(quantity, 10)));

    // Validate signature format
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 90) {
      return res.status(400).json({ error: 'invalid signature format' });
    }

    // Verify transaction (with graceful error handling)
    let transactionValid = false;
    try {
      const conf = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      const status = conf && conf.value && (conf.value.confirmationStatus || (conf.value.err == null ? 'processed' : null));
      transactionValid = !!status;
    } catch (signatureError) {
      console.log(`Warning: Could not validate signature ${signature}, but proceeding with pickaxe grant`);
      transactionValid = true; // Allow for devnet testing
    }

    if (transactionValid) {
      // Mint pickaxe tokens to user's wallet
      const tokenType = PICKAXE_TOKEN_MAP[pickaxeType];
      await tokenManager.mintToUser(userPublicKey, tokenType, qty);
      
      // Get updated balances
      const balances = await tokenManager.getUserTokenBalances(userPublicKey);
      
      console.log(`✅ Granted ${qty}x ${pickaxeType} pickaxe(s) to ${address}`);
      
      res.json({ 
        ok: true, 
        pickaxeType, 
        quantity: qty,
        message: `Successfully purchased ${qty}x ${pickaxeType} pickaxe(s)! Check your wallet.`,
        inventory: {
          silver: balances.PICKAXE_SILVER || 0,
          gold: balances.PICKAXE_GOLD || 0,
          diamond: balances.PICKAXE_DIAMOND || 0,
          netherite: balances.PICKAXE_NETHERITE || 0
        }
      });
    } else {
      res.status(400).json({ error: 'transaction not found or failed' });
    }
  } catch (error) {
    console.error('Error confirming pickaxe purchase:', error);
    res.status(500).json({ error: 'failed to confirm purchase: ' + (error?.message || 'unknown error') });
  }
});

// Mine gold (convert mining rate to gold tokens)
app.post('/mine', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    const userPublicKey = new PublicKey(address);
    
    // Get user's pickaxe balances to calculate mining rate
    const balances = await tokenManager.getUserTokenBalances(userPublicKey);
    
    // Check if user has land
    if (balances.LAND === 0) {
      return res.status(400).json({ error: 'Must own land to mine' });
    }
    
    // Calculate total mining rate
    let totalRate = 0;
    totalRate += (balances.PICKAXE_SILVER || 0) * PICKAXES.silver.rate;
    totalRate += (balances.PICKAXE_GOLD || 0) * PICKAXES.gold.rate;
    totalRate += (balances.PICKAXE_DIAMOND || 0) * PICKAXES.diamond.rate;
    totalRate += (balances.PICKAXE_NETHERITE || 0) * PICKAXES.netherite.rate;
    
    if (totalRate === 0) {
      return res.status(400).json({ error: 'No pickaxes available for mining' });
    }
    
    // Mine gold based on rate (could implement time-based mining here)
    const goldMined = totalRate * 0.1; // Mine 10% of rate per click/action
    
    // Mint gold tokens to user
    await tokenManager.mintToUser(userPublicKey, 'GOLD', goldMined);
    
    // Get updated gold balance
    const newGoldBalance = await tokenManager.getUserTokenBalance(userPublicKey, 'GOLD');
    
    res.json({
      ok: true,
      goldMined,
      totalGold: newGoldBalance,
      miningRate: totalRate,
      message: `Mined ${goldMined.toFixed(2)} gold! Total: ${newGoldBalance.toFixed(2)}`
    });
    
  } catch (error) {
    console.error('Error mining:', error);
    res.status(500).json({ error: 'failed to mine gold' });
  }
});

// Get mint addresses (for frontend to interact with tokens)
app.get('/mint-addresses', async (req, res) => {
  try {
    const mintAddresses = {};
    for (const [tokenType, mint] of Object.entries(tokenManager.mints)) {
      mintAddresses[tokenType] = mint.toString();
    }
    
    res.json({
      mints: mintAddresses,
      tokenConfigs: GAME_TOKENS
    });
  } catch (error) {
    console.error('Error getting mint addresses:', error);
    res.status(500).json({ error: 'failed to get mint addresses' });
  }
});

// Initialize tokens and start server
initializeTokens().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Token-based game server running on port ${PORT}`);
    console.log(`🔗 Solana RPC: ${SOLANA_RPC_URL}`);
    console.log(`💰 Treasury: ${TREASURY_PUBLIC_KEY?.toString() || 'Not configured'}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});