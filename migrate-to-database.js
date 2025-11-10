// Database Migration Script
// Migrates existing users.json data to PostgreSQL database

import fs from 'fs';
import path from 'path';
import UserDatabase from './database.js';

const usersFile = path.join(process.cwd(), 'data', 'users.json');

async function migrateToDatabase() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Check database health
    const health = await UserDatabase.healthCheck();
    if (!health.healthy) {
      console.error('❌ Database not healthy:', health.error);
      process.exit(1);
    }
    console.log('✅ Database connection verified');

    // Read existing users.json file
    if (!fs.existsSync(usersFile)) {
      console.log('ℹ️ No users.json file found, nothing to migrate');
      process.exit(0);
    }

    const fileData = fs.readFileSync(usersFile, 'utf8');
    const users = JSON.parse(fileData);
    
    console.log(`📊 Found ${Object.keys(users).length} users to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Migrate each user
    for (const [address, userData] of Object.entries(users)) {
      try {
        console.log(`🔄 Migrating user: ${address.slice(0, 8)}...`);
        
        // Check if user already exists in database
        const existingUser = await UserDatabase.getUser(address);
        if (existingUser.address) {
          console.log(`⏭️ User ${address.slice(0, 8)}... already exists in database, skipping`);
          skipped++;
          continue;
        }
        
        // Prepare user data for database
        const dbUserData = {
          total_mining_power: userData.total_mining_power || 0,
          checkpoint_timestamp: userData.checkpoint_timestamp || Math.floor(Date.now() / 1000),
          last_checkpoint_gold: userData.last_checkpoint_gold || userData.gold || 0,
          inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          hasLand: userData.hasLand || userData.has_land || false,
          landPurchaseDate: userData.landPurchaseDate || userData.land_purchase_date || null,
          lastActivity: userData.lastActivity || userData.last_activity || Math.floor(Date.now() / 1000)
        };
        
        // Create user in database
        await UserDatabase.createUser(address);
        
        // Update with migrated data
        await UserDatabase.updateUser(address, dbUserData);
        
        console.log(`✅ Migrated user ${address.slice(0, 8)}... - Gold: ${dbUserData.last_checkpoint_gold.toFixed(2)}, Pickaxes: ${Object.values(dbUserData.inventory).reduce((sum, count) => sum + count, 0)}`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating user ${address.slice(0, 8)}...:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`⏭️ Skipped (already exist): ${skipped} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`📊 Total processed: ${migrated + skipped + errors} users`);
    
    if (errors === 0) {
      console.log('\n🎉 Migration completed successfully!');
      
      // Ask if user wants to backup the file
      console.log('\n💡 Recommendation:');
      console.log('1. Backup your users.json file:');
      console.log(`   cp ${usersFile} ${usersFile}.backup`);
      console.log('2. Test the database thoroughly');
      console.log('3. Once confirmed working, you can remove users.json');
      
    } else {
      console.log('\n⚠️ Migration completed with errors. Please review the error messages above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateToDatabase;