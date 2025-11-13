import { readFileSync, writeFileSync } from 'fs';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createTokenManager } from './token-manager.js';
import dotenv from 'dotenv';

dotenv.config();

// Setup
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.AUTHORITY_PRIVATE_KEY || '[]')));
const tokenManager = createTokenManager(connection, authorityKeypair);

async function migrateUsersToTokens() {
  try {
    console.log('🔄 Starting migration from database to tokens...');
    
    // Load existing user data
    let userData;
    try {
      const usersFile = readFileSync('data/users.json', 'utf8');
      userData = JSON.parse(usersFile);
      console.log(`📊 Found ${Object.keys(userData).length} users in database`);
    } catch (error) {
      console.log('📝 No existing users.json found, starting fresh');
      userData = {};
    }
    
    // Initialize token system
    console.log('🪙 Initializing token mints...');
    
    // Load existing mints if available
    const existingMints = {
      GOLD: process.env.GOLD_MINT_ADDRESS,
      LAND: process.env.LAND_MINT_ADDRESS,
      PICKAXE_SILVER: process.env.PICKAXE_SILVER_MINT_ADDRESS,
      PICKAXE_GOLD: process.env.PICKAXE_GOLD_MINT_ADDRESS,
      PICKAXE_DIAMOND: process.env.PICKAXE_DIAMOND_MINT_ADDRESS,
      PICKAXE_NETHERITE: process.env.PICKAXE_NETHERITE_MINT_ADDRESS
    };
    
    const hasExistingMints = Object.values(existingMints).some(mint => mint);
    
    if (hasExistingMints) {
      console.log('📥 Loading existing token mints...');
      tokenManager.loadExistingMints(existingMints);
    } else {
      console.log('🆕 Creating new token mints...');
      await tokenManager.initializeGameTokens();
      
      // Save mint addresses to .env
      let envContent = readFileSync('.env', 'utf8');
      for (const [tokenType, mint] of Object.entries(tokenManager.mints)) {
        const envVar = `${tokenType}_MINT_ADDRESS`;
        const envLine = `${envVar}=${mint.toString()}`;
        
        if (envContent.includes(envVar)) {
          envContent = envContent.replace(new RegExp(`${envVar}=.*`), envLine);
        } else {
          envContent += `\n${envLine}`;
        }
      }
      writeFileSync('.env', envContent);
      console.log('💾 Mint addresses saved to .env');
    }
    
    // Migrate each user
    let migrated = 0;
    for (const [address, user] of Object.entries(userData)) {
      try {
        console.log(`\n👤 Migrating user: ${address}`);
        const userPublicKey = new PublicKey(address);
        
        // Migrate land ownership
        if (user.hasLand) {
          console.log('  🏞️ Granting LAND token...');
          await tokenManager.mintToUser(userPublicKey, 'LAND', 1);
        }
        
        // Migrate gold balance
        if (user.gold && user.gold > 0) {
          console.log(`  🥇 Minting ${user.gold} GOLD tokens...`);
          await tokenManager.mintToUser(userPublicKey, 'GOLD', user.gold);
        }
        
        // Migrate pickaxe inventory
        if (user.inventory) {
          const pickaxeMap = {
            silver: 'PICKAXE_SILVER',
            gold: 'PICKAXE_GOLD',
            diamond: 'PICKAXE_DIAMOND',
            netherite: 'PICKAXE_NETHERITE'
          };
          
          for (const [pickaxeType, count] of Object.entries(user.inventory)) {
            if (count > 0 && pickaxeMap[pickaxeType]) {
              console.log(`  ⛏️ Minting ${count}x ${pickaxeType} pickaxe tokens...`);
              await tokenManager.mintToUser(userPublicKey, pickaxeMap[pickaxeType], count);
            }
          }
        }
        
        migrated++;
        console.log(`  ✅ User ${address} migrated successfully`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate user ${address}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration complete! ${migrated}/${Object.keys(userData).length} users migrated`);
    
    // Create backup of original database
    const backupName = `data/users-backup-${Date.now()}.json`;
    writeFileSync(backupName, JSON.stringify(userData, null, 2));
    console.log(`📦 Original database backed up to: ${backupName}`);
    
    // Show mint addresses
    console.log('\n🔑 Token Mint Addresses:');
    for (const [tokenType, mint] of Object.entries(tokenManager.mints)) {
      console.log(`  ${tokenType}: ${mint.toString()}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Test token system
async function testTokenSystem() {
  try {
    console.log('\n🧪 Testing token system...');
    
    // Test with a sample address
    const testAddress = new PublicKey('11111111111111111111111111111111');
    
    // Load existing mints
    const existingMints = {
      GOLD: process.env.GOLD_MINT_ADDRESS,
      LAND: process.env.LAND_MINT_ADDRESS,
      PICKAXE_SILVER: process.env.PICKAXE_SILVER_MINT_ADDRESS,
      PICKAXE_GOLD: process.env.PICKAXE_GOLD_MINT_ADDRESS,
      PICKAXE_DIAMOND: process.env.PICKAXE_DIAMOND_MINT_ADDRESS,
      PICKAXE_NETHERITE: process.env.PICKAXE_NETHERITE_MINT_ADDRESS
    };
    
    tokenManager.loadExistingMints(existingMints);
    
    console.log('📊 Token Mints Loaded:');
    for (const [tokenType, mint] of Object.entries(tokenManager.mints)) {
      console.log(`  ${tokenType}: ${mint.toString()}`);
    }
    
    console.log('\n✅ Token system is ready!');
    
  } catch (error) {
    console.error('❌ Token system test failed:', error);
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrateUsersToTokens();
    break;
  case 'test':
    testTokenSystem();
    break;
  default:
    console.log(`
Usage: node migrate-to-tokens.js <command>

Commands:
  migrate  - Migrate existing users from database to tokens
  test     - Test the token system setup

Make sure to set up your .env file first with AUTHORITY_PRIVATE_KEY!
    `);
}

export { migrateUsersToTokens, testTokenSystem };