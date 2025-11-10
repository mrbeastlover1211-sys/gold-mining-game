-- Gold Mining Game Database Schema
-- Supports 100,000+ users with excellent performance

-- Users table - stores all player data with anti-cheat protection
CREATE TABLE users (
  address VARCHAR(50) PRIMARY KEY,
  
  -- Checkpoint-based mining system (anti-cheat protected)
  total_mining_power INTEGER DEFAULT 0,
  checkpoint_timestamp BIGINT DEFAULT 0,
  last_checkpoint_gold DECIMAL(15,2) DEFAULT 0,
  
  -- Pickaxe inventory (server authoritative)
  silver_pickaxes INTEGER DEFAULT 0 CHECK (silver_pickaxes >= 0 AND silver_pickaxes <= 10000),
  gold_pickaxes INTEGER DEFAULT 0 CHECK (gold_pickaxes >= 0 AND gold_pickaxes <= 10000),
  diamond_pickaxes INTEGER DEFAULT 0 CHECK (diamond_pickaxes >= 0 AND diamond_pickaxes <= 10000),
  netherite_pickaxes INTEGER DEFAULT 0 CHECK (netherite_pickaxes >= 0 AND netherite_pickaxes <= 10000),
  
  -- Land ownership
  has_land BOOLEAN DEFAULT FALSE,
  land_purchase_date BIGINT DEFAULT NULL,
  
  -- Activity tracking and security
  last_activity BIGINT DEFAULT 0,
  validation_failures INTEGER DEFAULT 0,
  last_cheat_attempt TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table - audit trail for all purchases/sales
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_address VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- 'purchase', 'sale', 'gold_purchase'
  item_type VARCHAR(20), -- 'silver', 'gold', 'diamond', 'netherite', 'land'
  quantity INTEGER DEFAULT 1,
  sol_amount DECIMAL(15,6),
  gold_amount DECIMAL(15,2),
  signature VARCHAR(100), -- Solana transaction signature
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_address) REFERENCES users(address)
);

-- Referrals table - tracks referral relationships
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_address VARCHAR(50) NOT NULL,
  referred_address VARCHAR(50) NOT NULL,
  rewards_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (referrer_address) REFERENCES users(address),
  FOREIGN KEY (referred_address) REFERENCES users(address),
  UNIQUE(referred_address) -- Each user can only be referred once
);

-- Indexes for performance with 100,000+ users
CREATE INDEX idx_users_last_activity ON users(last_activity);
CREATE INDEX idx_users_total_mining_power ON users(total_mining_power);
CREATE INDEX idx_transactions_user_address ON transactions(user_address);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_address);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for analytics and performance
CREATE VIEW active_miners AS
SELECT 
    address,
    total_mining_power,
    last_checkpoint_gold,
    silver_pickaxes + gold_pickaxes + diamond_pickaxes + netherite_pickaxes as total_pickaxes,
    last_activity
FROM users 
WHERE total_mining_power > 0 
AND last_activity > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days');

CREATE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN has_land = true THEN 1 END) as land_owners,
    COUNT(CASE WHEN total_mining_power > 0 THEN 1 END) as active_miners,
    SUM(total_mining_power) as total_network_mining_power,
    SUM(last_checkpoint_gold) as total_network_gold
FROM users;

-- Sample data for testing (remove in production)
INSERT INTO users (address, total_mining_power, checkpoint_timestamp, last_checkpoint_gold, silver_pickaxes, has_land, last_activity) VALUES
('test_wallet_1', 0, EXTRACT(EPOCH FROM NOW()), 0, 0, true, EXTRACT(EPOCH FROM NOW())),
('test_wallet_2', 60, EXTRACT(EPOCH FROM NOW()), 1000, 1, true, EXTRACT(EPOCH FROM NOW())),
('test_wallet_3', 10000, EXTRACT(EPOCH FROM NOW()), 5000, 0, true, EXTRACT(EPOCH FROM NOW()));

-- Performance tuning for large scale
-- Enable connection pooling
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;