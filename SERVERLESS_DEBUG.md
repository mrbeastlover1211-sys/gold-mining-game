# 🚨 Serverless Function Debug Guide

## ✅ **Working Test Endpoints Created:**

I've created simplified versions that should work immediately:

- `api/test.js` - Simple test endpoint (no dependencies)
- `api/config-simple.js` - Game config without complex imports
- `api/heartbeat-simple.js` - Activity tracking with in-memory storage
- `api/status.js` - Fixed user status endpoint

## 🔧 **How to Debug Vercel Crash:**

### **Step 1: Test Individual Endpoints**

After deploying to Vercel, test these URLs one by one:

1. **Basic test:** `https://your-app.vercel.app/api/test`
   - Should return: `{"message": "Serverless function working!"}`

2. **Config test:** `https://your-app.vercel.app/api/config-simple`  
   - Should return game configuration

3. **Status test:** `https://your-app.vercel.app/api/status?address=TESTWALLET`
   - Should return user data

### **Step 2: Check Vercel Function Logs**

1. Go to your Vercel dashboard
2. Click on your project
3. Go to **"Functions"** tab
4. Click on the failing function
5. Check the **"Invocations"** and **"Logs"** for error details

### **Step 3: Common Serverless Issues & Fixes**

#### **🔍 Issue: ES6 Module Import Errors**
**Symptoms:** `Cannot use import statement outside a module`
**Fix:** Make sure `package.json` has `"type": "module"`

#### **🔍 Issue: Database Connection Timeouts**
**Symptoms:** Functions timeout after 10-30 seconds
**Fix:** Use the simplified in-memory versions first

#### **🔍 Issue: File System Access Denied**
**Symptoms:** `ENOENT: no such file or directory`
**Fix:** Serverless can't write files - use database or global memory

### **Step 4: Progressive Migration Strategy**

Instead of migrating everything at once:

1. **Start with test endpoints** (`/api/test`, `/api/config-simple`)
2. **Test one function at a time**
3. **Replace complex imports with inline code**
4. **Add database integration once basic functions work**

## 🎯 **Quick Fix - Test This First:**

Replace your current `api/config.js` with `api/config-simple.js`:

```bash
# In your Vercel project, rename:
mv api/config.js api/config-backup.js
mv api/config-simple.js api/config.js
```

Then deploy and test: `https://your-app.vercel.app/api/config`

## 📋 **Environment Variables Checklist:**

Make sure these are set in Vercel dashboard:

```
DATABASE_URL=postgresql://postgres:GoldMining2024!@db.jkizaevgnbgtvmomzxej.supabase.co:5432/postgres
TREASURY_PUBLIC_KEY=55AnqqXYoacFDxkmr5Up8tqcduo1Yb82KamiQBVCquYX
SOLANA_CLUSTER_URL=https://api.devnet.solana.com
GOLD_PRICE_SOL=0.000001
MIN_SELL_GOLD=10000
ADMIN_TOKEN=change-me
NODE_ENV=production
```

## 🚀 **What to Try Next:**

1. **Test `/api/test` endpoint first** - if this fails, it's a basic Vercel setup issue
2. **Check Vercel function logs** for specific error messages
3. **Use simplified endpoints** until basic functionality works
4. **Add complexity gradually** once core functions are stable

## 💡 **Pro Tip:**

Vercel serverless functions work best with:
- Simple, single-purpose functions
- Minimal external dependencies  
- Database connections instead of file operations
- Proper error handling and logging

**Tell me what specific error you're seeing in the Vercel logs, and I can provide a targeted fix!**