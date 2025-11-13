# Token-Based Solana Gold Mining Game Setup

## Overview
This version stores all game assets (land, pickaxes, gold) as SPL tokens in users' Solana wallets instead of a centralized database. This gives players true ownership of their items!

## Required Environment Variables

Add these to your `.env` file:

```env
# Existing variables
TREASURY_PUBLIC_KEY=your_treasury_public_key
SOLANA_RPC_URL=https://api.devnet.solana.com

# NEW: Authority keypair for minting tokens (keep this secret!)
AUTHORITY_PRIVATE_KEY=[1,2,3,4,5...] # Array of 64 numbers from your keypair

# Token mint addresses (generated on first run)
GOLD_MINT_ADDRESS=
LAND_MINT_ADDRESS=
PICKAXE_SILVER_MINT_ADDRESS=
PICKAXE_GOLD_MINT_ADDRESS=
PICKAXE_DIAMOND_MINT_ADDRESS=
PICKAXE_NETHERITE_MINT_ADDRESS=
```

## How to Get Authority Keypair

1. Generate a new keypair for token minting:
```bash
solana-keygen new --outfile authority-keypair.json
```

2. Convert to array format:
```bash
cat authority-keypair.json
```

3. Copy the array into `AUTHORITY_PRIVATE_KEY` in your `.env`

## First Time Setup

1. **Install dependencies:**
```bash
npm install @solana/spl-token
```

2. **Fund your authority account** (devnet):
```bash
solana airdrop 2 <authority_public_key> --url devnet
```

3. **Start the token-based server:**
```bash
node server-token-based.js
```

4. **Copy mint addresses** from console output to your `.env` file

5. **Access the token-based game:**
   - Open `http://localhost:3000/index-token-based.html`

## Game Tokens Created

| Token | Symbol | Purpose | Decimals |
|-------|--------|---------|----------|
| Gold Coin | GOLD | In-game currency | 2 |
| Land Deed | LAND | Mining land ownership | 0 |
| Silver Pickaxe | PSILV | Mining tool | 0 |
| Gold Pickaxe | PGOLD | Mining tool | 0 |
| Diamond Pickaxe | PDIAM | Mining tool | 0 |
| Netherite Pickaxe | PNETH | Mining tool | 0 |

## Key Benefits

✅ **True Ownership**: Players own their tokens in their wallet  
✅ **Tradeable**: Tokens can be transferred between wallets  
✅ **Transparent**: All balances visible on Solana blockchain  
✅ **Decentralized**: No centralized database required  
✅ **Wallet Integration**: Works with any Solana wallet  

## How It Works

1. **Land Purchase**: Pay 0.01 SOL → Receive 1 LAND token
2. **Pickaxe Purchase**: Pay SOL → Receive pickaxe tokens (PSILV, PGOLD, etc.)
3. **Mining**: Use pickaxe tokens → Generate GOLD tokens
4. **Trading**: Transfer any token to other players' wallets

## Viewing Tokens in Phantom

Users can view their game tokens in Phantom wallet by:
1. Going to Settings → Developer Settings
2. Enabling "Testnet Mode" for devnet
3. Adding custom token addresses from mint addresses

## Migration from Database

To migrate existing users:
1. Export user data from current database
2. Run migration script to mint equivalent tokens
3. Send tokens to user wallets
4. Switch to token-based system

## Security Notes

- Keep `AUTHORITY_PRIVATE_KEY` secret
- Authority account can mint unlimited tokens
- Consider implementing multi-sig for production
- Token accounts are created automatically for users