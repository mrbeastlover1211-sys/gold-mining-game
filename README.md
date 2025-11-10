# Gold Mining - Play & Earn (Solana Devnet)

A simple idle web game where users buy a pickaxe using their Solana wallet (Phantom etc.) and mine gold over time. Gold accrues even while users are offline. Players can sell gold for SOL at a global price set by the admin.

IMPORTANT: This is a prototype for educational purposes. Do not use on mainnet as-is. Add proper security, validation, on-chain programs, rate-limiting, and production hardening.

## Features
- Phantom wallet integration
- 4 pickaxes: Silver (0.01 SOL, 1 gold/s), Gold (0.1 SOL, 10 gold/s), Diamond (1 SOL, 100 gold/s), Netherite (5 SOL, 10000 gold/s)
- Idle mining on the server using last-seen timestamp
- Sell gold to receive SOL from a server treasury (optional auto payouts if secret is provided)
- Admin endpoint to update global gold price

## Quickstart

1. Install dependencies

```bash
npm install
```

2. Copy env and set values

```bash
cp .env.example .env
# Fill TREASURY_PUBLIC_KEY with your receiver pubkey (devnet)
# Optionally set TREASURY_SECRET_KEY as JSON array for auto payouts
# Example: [1,2,3,...,64]
```

3. Run server

```bash
npm run dev
```

4. Open http://localhost:3000 and connect Phantom (devnet). Buy a pickaxe and start mining.

## API

- GET /config => { pickaxes, goldPriceSol, minSellGold, clusterUrl, treasury }
- GET /status?address=... => { address, pickaxeType, gold, lastUpdate }
- POST /purchase-tx { address, pickaxeType } => { transaction(base64), lastValidBlockHeight, pickaxeType, costLamports }
- POST /purchase-confirm { address, pickaxeType, signature } => assigns pickaxe on success
- POST /sell { address, amountGold } => deducts gold and pays SOL if treasury secret is provided
- POST /admin/price { token, goldPriceSol } => update global price

## Notes
- The server stores user state in data/users.json (not secure, for demo). Replace with a database in production.
- Auto payouts require setting TREASURY_SECRET_KEY to your devnet keypair secret. Never store mainnet secrets in .env.
- Client polls /status every 2s and shows live mined gold.
- Mining continues while the site is closed because it's computed by server on next check using elapsed time.

## Security and Production Considerations
- Add JWT auth or signed messages from wallet to bind address to actions to prevent spoofing.
- Validate purchase amounts on-chain by checking transfer instruction, not just signature presence.
- Rate limit endpoints and add CSRF protections.
- Host behind HTTPS; set CORS properly.
- Consider moving logic on-chain via a Solana program for trustless state and rewards.
