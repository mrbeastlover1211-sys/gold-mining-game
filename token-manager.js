import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';

// Game token configurations
export const GAME_TOKENS = {
  GOLD: {
    name: 'Gold Coin',
    symbol: 'GOLD',
    decimals: 2, // Allow fractional gold (0.01 precision)
    description: 'In-game gold currency'
  },
  LAND: {
    name: 'Land Deed',
    symbol: 'LAND',
    decimals: 0, // Land is whole units only
    description: 'Ownership deed for mining land'
  },
  PICKAXE_SILVER: {
    name: 'Silver Pickaxe',
    symbol: 'PSILV',
    decimals: 0,
    description: 'Silver mining pickaxe'
  },
  PICKAXE_GOLD: {
    name: 'Gold Pickaxe',
    symbol: 'PGOLD',
    decimals: 0,
    description: 'Gold mining pickaxe'
  },
  PICKAXE_DIAMOND: {
    name: 'Diamond Pickaxe',
    symbol: 'PDIAM',
    decimals: 0,
    description: 'Diamond mining pickaxe'
  },
  PICKAXE_NETHERITE: {
    name: 'Netherite Pickaxe',
    symbol: 'PNETH',
    decimals: 0,
    description: 'Netherite mining pickaxe'
  }
};

export class TokenManager {
  constructor(connection, authorityKeypair) {
    this.connection = connection;
    this.authority = authorityKeypair;
    this.mints = {}; // Store mint addresses for each token type
  }

  // Initialize all game token mints (run once during setup)
  async initializeGameTokens() {
    console.log('Initializing game tokens...');
    
    for (const [tokenType, config] of Object.entries(GAME_TOKENS)) {
      try {
        console.log(`Creating mint for ${config.name}...`);
        
        const mint = await createMint(
          this.connection,
          this.authority, // Payer
          this.authority.publicKey, // Mint authority
          this.authority.publicKey, // Freeze authority (optional)
          config.decimals, // Decimals
          Keypair.generate(), // Use random keypair for mint
          undefined, // Commitment
          TOKEN_PROGRAM_ID
        );
        
        this.mints[tokenType] = mint;
        console.log(`✅ Created ${config.name} mint: ${mint.toString()}`);
        
      } catch (error) {
        console.error(`❌ Failed to create mint for ${config.name}:`, error);
      }
    }
    
    return this.mints;
  }

  // Get or create user's token account for a specific token type
  async getOrCreateUserTokenAccount(userPublicKey, tokenType) {
    const mint = this.mints[tokenType];
    if (!mint) {
      throw new Error(`Mint not found for token type: ${tokenType}`);
    }

    try {
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.authority, // Payer for account creation
        mint,
        userPublicKey, // Owner of the token account
        false, // Allow owner off curve
        undefined, // Commitment
        undefined, // Confirm options
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      return tokenAccount;
    } catch (error) {
      console.error(`Failed to get/create token account for ${tokenType}:`, error);
      throw error;
    }
  }

  // Mint tokens to user's wallet
  async mintToUser(userPublicKey, tokenType, amount) {
    const tokenAccount = await this.getOrCreateUserTokenAccount(userPublicKey, tokenType);
    const mint = this.mints[tokenType];
    const config = GAME_TOKENS[tokenType];
    
    // Convert amount to smallest unit based on decimals
    const adjustedAmount = amount * Math.pow(10, config.decimals);
    
    try {
      const signature = await mintTo(
        this.connection,
        this.authority, // Payer
        mint, // Mint
        tokenAccount.address, // Destination
        this.authority, // Mint authority
        adjustedAmount, // Amount
        [], // Multi-signers
        undefined, // Confirm options
        TOKEN_PROGRAM_ID
      );

      console.log(`✅ Minted ${amount} ${config.symbol} to ${userPublicKey.toString()}`);
      return { signature, tokenAccount: tokenAccount.address };
    } catch (error) {
      console.error(`Failed to mint ${tokenType} to user:`, error);
      throw error;
    }
  }

  // Get user's token balance
  async getUserTokenBalance(userPublicKey, tokenType) {
    try {
      const mint = this.mints[tokenType];
      if (!mint) {
        return 0;
      }

      const tokenAccountAddress = await getAssociatedTokenAddress(
        mint,
        userPublicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tokenAccount = await getAccount(
        this.connection,
        tokenAccountAddress,
        undefined,
        TOKEN_PROGRAM_ID
      );

      const config = GAME_TOKENS[tokenType];
      // Convert from smallest unit back to readable amount
      return Number(tokenAccount.amount) / Math.pow(10, config.decimals);
    } catch (error) {
      // Account doesn't exist = balance is 0
      if (error.name === 'TokenAccountNotFoundError') {
        return 0;
      }
      console.error(`Failed to get balance for ${tokenType}:`, error);
      return 0;
    }
  }

  // Get all token balances for a user
  async getUserTokenBalances(userPublicKey) {
    const balances = {};
    
    for (const tokenType of Object.keys(GAME_TOKENS)) {
      balances[tokenType] = await this.getUserTokenBalance(userPublicKey, tokenType);
    }
    
    return balances;
  }

  // Transfer tokens between users (for trading)
  async transferTokens(fromPublicKey, toPublicKey, tokenType, amount) {
    const mint = this.mints[tokenType];
    const config = GAME_TOKENS[tokenType];
    
    const fromTokenAccount = await getAssociatedTokenAddress(mint, fromPublicKey);
    const toTokenAccount = await this.getOrCreateUserTokenAccount(toPublicKey, tokenType);
    
    const adjustedAmount = amount * Math.pow(10, config.decimals);
    
    try {
      const signature = await transfer(
        this.connection,
        this.authority, // Payer (for transaction fees)
        fromTokenAccount,
        toTokenAccount.address,
        fromPublicKey, // Owner of source account
        adjustedAmount,
        [], // Multi-signers
        undefined, // Confirm options
        TOKEN_PROGRAM_ID
      );

      console.log(`✅ Transferred ${amount} ${config.symbol} from ${fromPublicKey.toString()} to ${toPublicKey.toString()}`);
      return signature;
    } catch (error) {
      console.error(`Failed to transfer ${tokenType}:`, error);
      throw error;
    }
  }

  // Burn tokens (remove from circulation) - useful for consuming items
  async burnTokens(userPublicKey, tokenType, amount) {
    // Implementation would use burn() function from @solana/spl-token
    // For now, we'll transfer to a burn address or just track usage
    console.log(`Burning ${amount} ${tokenType} from ${userPublicKey.toString()}`);
  }

  // Load existing mints from environment or storage
  loadExistingMints(mintAddresses) {
    for (const [tokenType, address] of Object.entries(mintAddresses)) {
      if (address) {
        this.mints[tokenType] = new PublicKey(address);
        console.log(`Loaded existing ${tokenType} mint: ${address}`);
      }
    }
  }
}

// Helper function to create token manager instance
export function createTokenManager(connection, authorityKeypair) {
  return new TokenManager(connection, authorityKeypair);
}