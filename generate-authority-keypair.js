import { Keypair } from '@solana/web3.js';
import { readFileSync, writeFileSync } from 'fs';

// Generate a new keypair for token authority
const authorityKeypair = Keypair.generate();
const privateKeyArray = Array.from(authorityKeypair.secretKey);

console.log('🔑 Generated new authority keypair:');
console.log(`Public Key: ${authorityKeypair.publicKey.toString()}`);
console.log(`Private Key Array: [${privateKeyArray.join(',')}]`);

// Update .env file
try {
  let envContent = readFileSync('.env', 'utf8');
  
  // Add or update the AUTHORITY_PRIVATE_KEY
  const privateKeyLine = `AUTHORITY_PRIVATE_KEY=[${privateKeyArray.join(',')}]`;
  
  if (envContent.includes('AUTHORITY_PRIVATE_KEY=')) {
    envContent = envContent.replace(/AUTHORITY_PRIVATE_KEY=.*/, privateKeyLine);
  } else {
    envContent += `\n${privateKeyLine}`;
  }
  
  writeFileSync('.env', envContent);
  console.log('✅ Updated .env file with new authority keypair');
  
} catch (error) {
  console.error('❌ Failed to update .env file:', error);
  console.log('Please manually add this line to your .env file:');
  console.log(`AUTHORITY_PRIVATE_KEY=[${privateKeyArray.join(',')}]`);
}

console.log('\n💰 To fund this account on devnet, run:');
console.log(`solana airdrop 2 ${authorityKeypair.publicKey.toString()} --url devnet`);