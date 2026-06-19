/**
 * Etherscan API Transaction Extraction Demo
 * 
 * This script demonstrates how to:
 * 1. Extract ERC-20 token transfers (like USDT) for a specific address.
 * 2. Fetch specific transaction details and execution status by hash using Etherscan proxy methods.
 * 
 * To run this script:
 * 1. Add ETHERSCAN_API_KEY to your env or pass it directly.
 * 2. Run: node etherscan_demo.js
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'YOUR_API_KEY_HERE';
// Example wallet address (default to configured ADMIN_WALLET_ADDRESS or a popular Ethereum wallet)
const WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || '0x7e5e43f577780400ea7fc232e3248d7cdd30ab29';
// USDT Contract Address on Ethereum Mainnet
const USDT_CONTRACT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';

/**
 * 1. Extract ERC-20 USDT Token Transfer events for a specific address
 */
async function fetchUSDTTransfers(address) {
  console.log(`\n--- Fetching USDT token transfers for: ${address} ---`);
  
  if (ETHERSCAN_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ Please configure a valid ETHERSCAN_API_KEY to test fetching.');
    return;
  }

  const url = `https://api.etherscan.io/api` +
    `?module=account` +
    `&action=tokentx` +
    `&contractaddress=${USDT_CONTRACT_ADDRESS}` +
    `&address=${address}` +
    `&page=1` +
    `&offset=10` + // Limit to 10 latest transactions
    `&startblock=0` +
    `&endblock=99999999` +
    `&sort=desc` +
    `&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1') {
      console.error(`Etherscan API Error: ${data.message} (${data.result})`);
      return;
    }

    const transfers = data.result;
    console.log(`Successfully found ${transfers.length} USDT transfers:\n`);

    transfers.forEach((tx, index) => {
      // USDT uses 6 decimals on Ethereum mainnet
      const amountUSD = Number(tx.value) / 1_000_000;
      console.log(`[${index + 1}] TxHash: ${tx.hash}`);
      console.log(`    From:   ${tx.from}`);
      console.log(`    To:     ${tx.to}`);
      console.log(`    Amount: $${amountUSD.toFixed(2)} USDT`);
      console.log(`    Block:  ${tx.blockNumber} | Date: ${new Date(tx.timeStamp * 1000).toLocaleString()}`);
      console.log('----------------------------------------------------');
    });

  } catch (error) {
    console.error('Error fetching USDT transfers:', error);
  }
}

/**
 * 2. Fetch transaction receipt and details by hash
 */
async function fetchTxDetailsByHash(txHash) {
  console.log(`\n--- Fetching transaction details by Hash: ${txHash} ---`);

  if (ETHERSCAN_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ Please configure a valid ETHERSCAN_API_KEY to test fetching.');
    return;
  }

  const url = `https://api.etherscan.io/api` +
    `?module=proxy` +
    `&action=eth_getTransactionByHash` +
    `&txhash=${txHash}` +
    `&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.result) {
      console.log('Transaction details not found or error occurred.');
      return;
    }

    const tx = data.result;
    console.log('Transaction Details:');
    console.log(`- From: ${tx.from}`);
    console.log(`- To (Contract/Recipient): ${tx.to}`);
    console.log(`- Gas Limit: ${parseInt(tx.gas, 16)}`);
    console.log(`- Value (ETH): ${parseInt(tx.value, 16) / 1e18}`);
    
    // Fetch transaction receipt to check success status (status === '0x1')
    const receiptUrl = `https://api.etherscan.io/api` +
      `?module=proxy` +
      `&action=eth_getTransactionReceipt` +
      `&txhash=${txHash}` +
      `&apikey=${ETHERSCAN_API_KEY}`;

    const receiptRes = await fetch(receiptUrl);
    const receiptData = await receiptRes.json();
    
    if (receiptData.result) {
      const status = receiptData.result.status;
      console.log(`- Status: ${status === '0x1' ? '✅ Succeeded (0x1)' : '❌ Failed/Reverted (' + status + ')'}`);
    }

  } catch (error) {
    console.error('Error fetching transaction details:', error);
  }
}

// Main execution function
async function run() {
  // Replace with a valid tx hash on Mainnet if you want to test details fetching
  const testTxHash = '0xc5097475d40a5a3a71b12e3e60156942ea7c541785501ccbc4c2598375825aef'; 
  
  await fetchUSDTTransfers(WALLET_ADDRESS);
  await fetchTxDetailsByHash(testTxHash);
}

run();
