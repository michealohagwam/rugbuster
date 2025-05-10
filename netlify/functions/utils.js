const axios = require('axios');

// Cache setup
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cleanCoinId(input) {
  const match = input.match(/.*\s*-\s*([^\s]+)$/);
  return match ? match[1] : input.replace(/\s+/g, '-').toLowerCase();
}

async function getCoinId(searchTerm) {
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm)}`, {
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    const coins = response.data.coins || [];
    if (coins.length === 0) {
      console.log(`No coins found for "${searchTerm}" in CoinGecko search`);
      return null;
    }
    const coin = coins.find((c) => c.id.toLowerCase().includes(searchTerm.toLowerCase()) || c.symbol.toLowerCase() === searchTerm.toLowerCase()) || coins[0];
    console.log(`Resolved "${searchTerm}" to CoinGecko ID: ${coin.id}`);
    return { id: coin.id, symbol: coin.symbol };
  } catch (error) {
    console.error(`CoinGecko search error for "${searchTerm}": ${error.message}`);
    return null;
  }
}

async function getFearGreedIndex() {
  try {
    const response = await axios.get('https://api.alternative.me/fng/');
    const data = response.data.data?.[0] || {};
    return {
      value: parseInt(data.value) || 0,
      classification: data.value_classification || 'Neutral',
    };
  } catch (error) {
    console.error(`Fear/Greed Index error: ${error.message}`);
    return { error: 'Failed to fetch Fear/Greed Index' };
  }
}

module.exports = {
  cache,
  CACHE_TTL,
  cleanCoinId,
  getCoinId,
  getFearGreedIndex,
};