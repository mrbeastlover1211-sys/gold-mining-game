# 🚀 Gold Mining Game - Production Deployment Guide

## 📋 **Overview**
This guide will help you deploy the Gold Mining Game to production with database support for 10,000-100,000+ users.

## 🗄️ **Step 1: Database Setup (Supabase)**

### **Create Free Supabase Account**
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up with GitHub/Google
3. Create a new project
4. Choose a database password

### **Run Database Schema**
1. Go to **SQL Editor** in Supabase dashboard
2. Copy and paste the entire `database-setup.sql` file
3. Click **Run** to create all tables and indexes
4. Verify tables were created in **Table Editor**

### **Get Database URL**
1. Go to **Settings** → **Database**
2. Copy the **Connection String** (URI format)
3. It looks like: `postgresql://postgres:[password]@[host]:5432/postgres`

## 🌐 **Step 2: Deploy to Vercel**

### **Prepare Environment Variables**
1. Copy `.env.example` to `.env`
2. Fill in your values:
```env
DATABASE_URL=postgresql://postgres:your_password@host:5432/postgres
TREASURY_PUBLIC_KEY=your_solana_wallet_public_key
SOLANA_CLUSTER_URL=https://api.mainnet-beta.solana.com
```

### **Deploy to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add TREASURY_PUBLIC_KEY
vercel env add SOLANA_CLUSTER_URL

# Redeploy with env vars
vercel --prod
```

### **Alternative: GitHub Integration**
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Auto-deploy on push

## 📊 **Step 3: Verify Deployment**

### **Test Database Connection**
```bash
curl https://your-app.vercel.app/health
# Should return: {"ok": true}
```

### **Test User Registration**
```bash
curl https://your-app.vercel.app/status?address=test123
# Should return user data
```

## 🔧 **Step 4: Migration from File System**

### **If You Have Existing Users**
```javascript
// Run this script once to migrate data
const fs = require('fs');
const UserDatabase = require('./database.js');

async function migrateUsers() {
  const users = JSON.parse(fs.readFileSync('data/users.json'));
  
  for (const [address, userData] of Object.entries(users)) {
    await UserDatabase.createUser(address);
    await UserDatabase.updateUser(address, {
      total_mining_power: userData.total_mining_power || 0,
      checkpoint_timestamp: userData.checkpoint_timestamp || Date.now(),
      last_checkpoint_gold: userData.last_checkpoint_gold || userData.gold || 0,
      inventory: userData.inventory,
      hasLand: userData.hasLand
    });
  }
  
  console.log(`Migrated ${Object.keys(users).length} users to database`);
}

migrateUsers();
```

## 💰 **Capacity & Costs**

### **Free Tier (Supabase + Vercel)**
- **Users**: 50,000
- **Requests**: Unlimited (with limits)
- **Storage**: 500MB
- **Bandwidth**: 100GB/month
- **Cost**: $0/month

### **Production Scale**
- **Users**: 100,000+
- **Supabase Pro**: $25/month
- **Vercel Pro**: $20/month (if needed)
- **Total**: $45/month for massive scale

## 📈 **Performance Monitoring**

### **Database Performance**
```sql
-- Check active users
SELECT COUNT(*) FROM users WHERE last_activity > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day');

-- Check mining power distribution
SELECT 
  CASE 
    WHEN total_mining_power = 0 THEN 'No pickaxes'
    WHEN total_mining_power < 100 THEN 'Beginner'
    WHEN total_mining_power < 1000 THEN 'Intermediate'
    ELSE 'Advanced'
  END as tier,
  COUNT(*) as user_count
FROM users 
GROUP BY tier;

-- Performance stats
SELECT * FROM user_stats;
```

### **Application Monitoring**
- Monitor response times in Vercel dashboard
- Check database connection health
- Track user growth and retention

## 🛡️ **Security Considerations**

### **Database Security**
- ✅ Connection pooling enabled
- ✅ Prepared statements (SQL injection protection)
- ✅ Row-level security available in Supabase
- ✅ Automatic backups

### **Application Security**
- ✅ Rate limiting implemented
- ✅ Input validation
- ✅ Environment variables for secrets
- ✅ HTTPS by default on Vercel

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Database Connection Failed**
```
Error: Database connection error
```
**Solution**: Check `DATABASE_URL` format and network access

#### **Migration Errors**
```
Error: relation "users" already exists
```
**Solution**: Database schema already exists, skip to data migration

#### **Vercel Function Timeout**
```
Error: Function exceeded time limit
```
**Solution**: Database queries too slow, check indexes

### **Debug Commands**
```bash
# Test database connection locally
node -e "const db = require('./database.js'); db.healthCheck().then(console.log);"

# Check Vercel logs
vercel logs

# Test specific endpoints
curl https://your-app.vercel.app/status?address=test123
```

## 📞 **Support Resources**

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Node.js + PostgreSQL**: https://node-postgres.com/

## 🎯 **Next Steps After Deployment**

1. **Monitor user growth** and database performance
2. **Set up alerts** for high CPU/memory usage
3. **Implement backup strategy** (Supabase handles this)
4. **Consider CDN** for static assets
5. **Add monitoring** (Sentry, LogRocket, etc.)
6. **Scale database** if approaching limits

---

**🎉 Congratulations! Your Gold Mining Game is now ready for 100,000+ users!**