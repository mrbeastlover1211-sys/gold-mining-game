// Token-based game frontend
let wallet = null;
let connection = null;
let gameTokenMints = {};
let userTokenAccounts = {};

// Initialize Solana connection and game
async function initializeGame() {
  connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load mint addresses from server
  try {
    const response = await fetch('/mint-addresses');
    const data = await response.json();
    gameTokenMints = data.mints;
    console.log('Game token mints loaded:', gameTokenMints);
  } catch (error) {
    console.error('Failed to load mint addresses:', error);
  }
  
  updateUI();
}

// Connect to Phantom wallet
async function connectWallet() {
  try {
    if (window.solana && window.solana.isPhantom) {
      const response = await window.solana.connect();
      wallet = response.publicKey.toString();
      console.log('Connected to wallet:', wallet);
      
      // Load user's token balances
      await loadUserTokenBalances();
      await updateUserStatus();
      updateUI();
    } else {
      alert('Phantom wallet not found! Please install Phantom wallet extension.');
    }
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    alert('Failed to connect wallet: ' + error.message);
  }
}

// Load user's actual token balances from their wallet
async function loadUserTokenBalances() {
  if (!wallet || !connection) return;
  
  try {
    const userPublicKey = new solanaWeb3.PublicKey(wallet);
    userTokenAccounts = {};
    
    for (const [tokenType, mintAddress] of Object.entries(gameTokenMints)) {
      try {
        const mint = new solanaWeb3.PublicKey(mintAddress);
        
        // Get associated token account address
        const tokenAccountAddress = await solanaWeb3.getAssociatedTokenAddress(
          mint,
          userPublicKey,
          false,
          solanaWeb3.TOKEN_PROGRAM_ID,
          solanaWeb3.ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        // Try to get account info
        const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
        
        if (accountInfo) {
          // Decode token account data
          const tokenAccount = solanaWeb3.AccountLayout.decode(accountInfo.data);
          const balance = Number(tokenAccount.amount);
          
          // Adjust for decimals (most game tokens have 0 decimals except GOLD which has 2)
          const decimals = tokenType === 'GOLD' ? 2 : 0;
          const adjustedBalance = balance / Math.pow(10, decimals);
          
          userTokenAccounts[tokenType] = {
            address: tokenAccountAddress.toString(),
            balance: adjustedBalance,
            rawBalance: balance
          };
        } else {
          // Account doesn't exist = 0 balance
          userTokenAccounts[tokenType] = {
            address: tokenAccountAddress.toString(),
            balance: 0,
            rawBalance: 0
          };
        }
      } catch (error) {
        console.error(`Error loading ${tokenType} balance:`, error);
        userTokenAccounts[tokenType] = { balance: 0, rawBalance: 0 };
      }
    }
    
    console.log('User token balances:', userTokenAccounts);
    displayTokenBalances();
  } catch (error) {
    console.error('Error loading token balances:', error);
  }
}

// Display token balances in UI
function displayTokenBalances() {
  const tokenBalancesDiv = document.getElementById('token-balances');
  if (!tokenBalancesDiv) return;
  
  let html = '<div class="token-balances"><h3>🪙 Your Wallet Tokens</h3>';
  
  const tokenNames = {
    GOLD: '🥇 Gold Coins',
    LAND: '🏞️ Land Deeds',
    PICKAXE_SILVER: '⚒️ Silver Pickaxes',
    PICKAXE_GOLD: '🪓 Gold Pickaxes',
    PICKAXE_DIAMOND: '💎 Diamond Pickaxes',
    PICKAXE_NETHERITE: '🔥 Netherite Pickaxes'
  };
  
  for (const [tokenType, info] of Object.entries(userTokenAccounts)) {
    const name = tokenNames[tokenType] || tokenType;
    const balance = info.balance || 0;
    const color = balance > 0 ? '#4ade80' : '#6b7280';
    
    html += `
      <div class="token-balance" style="color: ${color}; margin: 5px 0;">
        ${name}: ${balance}
        ${info.address ? `<small style="opacity: 0.6;">(${info.address.slice(0, 8)}...)</small>` : ''}
      </div>
    `;
  }
  
  html += '</div>';
  tokenBalancesDiv.innerHTML = html;
}

// Update user status from server
async function updateUserStatus() {
  if (!wallet) return;
  
  try {
    const response = await fetch(`/user-status?address=${wallet}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error getting user status:', data.error);
      return;
    }
    
    // Update UI elements
    document.getElementById('user-address').textContent = wallet;
    document.getElementById('has-land').textContent = data.hasLand ? 'Yes ✅' : 'No ❌';
    document.getElementById('gold-amount').textContent = (data.gold || 0).toFixed(2);
    document.getElementById('mining-rate').textContent = data.totalRate || 0;
    
    // Update inventory display
    const inventoryDiv = document.getElementById('inventory');
    if (inventoryDiv) {
      inventoryDiv.innerHTML = `
        <h3>📦 Mining Equipment</h3>
        <div>Silver Pickaxes: ${data.inventory.silver || 0}</div>
        <div>Gold Pickaxes: ${data.inventory.gold || 0}</div>
        <div>Diamond Pickaxes: ${data.inventory.diamond || 0}</div>
        <div>Netherite Pickaxes: ${data.inventory.netherite || 0}</div>
      `;
    }
    
    // Show/hide purchase buttons based on land ownership
    const purchaseButtons = document.querySelectorAll('.pickaxe-purchase-btn');
    const landPurchaseBtn = document.getElementById('land-purchase-btn');
    
    if (data.hasLand) {
      purchaseButtons.forEach(btn => btn.style.display = 'inline-block');
      if (landPurchaseBtn) landPurchaseBtn.style.display = 'none';
    } else {
      purchaseButtons.forEach(btn => btn.style.display = 'none');
      if (landPurchaseBtn) landPurchaseBtn.style.display = 'inline-block';
    }
    
  } catch (error) {
    console.error('Error updating user status:', error);
  }
}

// Purchase land
async function purchaseLand() {
  if (!wallet) {
    alert('Please connect your wallet first!');
    return;
  }
  
  try {
    setStatus('Creating land purchase transaction...');
    
    const response = await fetch('/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: wallet })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    setStatus('Please sign the transaction to purchase land for 0.01 SOL...');
    
    // Create transaction from base64
    const transaction = solanaWeb3.Transaction.from(Buffer.from(data.transaction, 'base64'));
    
    // Sign and send transaction
    const signedTransaction = await window.solana.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    setStatus('Confirming land purchase...');
    
    // Confirm purchase with server
    const confirmResponse = await fetch('/confirm-land-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: wallet, signature })
    });
    
    const confirmData = await confirmResponse.json();
    
    if (confirmData.ok) {
      setStatus('🎉 Land purchased successfully! LAND token minted to your wallet!');
      await loadUserTokenBalances();
      await updateUserStatus();
    } else {
      throw new Error(confirmData.error);
    }
    
  } catch (error) {
    console.error('Land purchase error:', error);
    setStatus('❌ Land purchase failed: ' + error.message);
  }
}

// Purchase pickaxe
async function purchasePickaxe(type) {
  if (!wallet) {
    alert('Please connect your wallet first!');
    return;
  }
  
  try {
    setStatus(`Creating ${type} pickaxe purchase transaction...`);
    
    const response = await fetch('/purchase-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: wallet, pickaxeType: type, quantity: 1 })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    setStatus(`Please sign the transaction to purchase ${type} pickaxe for ${data.costSOL} SOL...`);
    
    // Create transaction from base64
    const transaction = solanaWeb3.Transaction.from(Buffer.from(data.transaction, 'base64'));
    
    // Sign and send transaction
    const signedTransaction = await window.solana.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    setStatus('Confirming pickaxe purchase...');
    
    // Confirm purchase with server
    const confirmResponse = await fetch('/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: wallet, 
        pickaxeType: type, 
        quantity: 1,
        signature 
      })
    });
    
    const confirmData = await confirmResponse.json();
    
    if (confirmData.ok) {
      setStatus(`🎉 ${type} pickaxe purchased! Token minted to your wallet!`);
      await loadUserTokenBalances();
      await updateUserStatus();
    } else {
      throw new Error(confirmData.error);
    }
    
  } catch (error) {
    console.error('Pickaxe purchase error:', error);
    setStatus(`❌ ${type} pickaxe purchase failed: ` + error.message);
  }
}

// Mine gold
async function mineGold() {
  if (!wallet) {
    alert('Please connect your wallet first!');
    return;
  }
  
  try {
    setStatus('Mining gold...');
    
    const response = await fetch('/mine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: wallet })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      setStatus(`⛏️ Mined ${data.goldMined.toFixed(2)} GOLD tokens! Total: ${data.totalGold.toFixed(2)}`);
      await loadUserTokenBalances();
      await updateUserStatus();
    } else {
      throw new Error(data.error);
    }
    
  } catch (error) {
    console.error('Mining error:', error);
    setStatus('❌ Mining failed: ' + error.message);
  }
}

// UI Helper functions
function setStatus(message) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
  }
  console.log('Status:', message);
}

function updateUI() {
  const connectBtn = document.getElementById('connect-wallet');
  const gameArea = document.getElementById('game-area');
  
  if (wallet) {
    if (connectBtn) connectBtn.style.display = 'none';
    if (gameArea) gameArea.style.display = 'block';
  } else {
    if (connectBtn) connectBtn.style.display = 'inline-block';
    if (gameArea) gameArea.style.display = 'none';
  }
}

// Auto-refresh token balances every 10 seconds
setInterval(async () => {
  if (wallet) {
    await loadUserTokenBalances();
  }
}, 10000);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeGame);