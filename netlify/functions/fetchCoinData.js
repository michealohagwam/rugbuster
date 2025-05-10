require('dotenv').config();
const axios = require('axios');
const { cache, CACHE_TTL, cleanCoinId, getCoinId, getFearGreedIndex } = require('./utils');

// Simple in-memory rate limiter (per IP)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

function rateLimit(ip) {
  const now = Date.now();
  const requests = rateLimitStore.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  if (now > requests.resetTime) {
    requests.count = 0;
    requests.resetTime = now + RATE_LIMIT_WINDOW;
  }
  requests.count += 1;
  rateLimitStore.set(ip, requests);
  return requests.count <= RATE_LIMIT_MAX ? null : 'Too many requests from this IP, please try again later.';
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, details: 'Method not allowed' }),
    };
  }

  // Rate limiting
  const clientIp = event.headers['client-ip'] || 'unknown';
  const rateLimitError = rateLimit(clientIp);
  if (rateLimitError) {
    return {
      statusCode: 429,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, details: rateLimitError }),
    };
  }

  // API key verification
  const API_KEY = process.env.CLIENT_SERVER_API_KEY || 'rugbuster-secret-123';
  const apiKey = event.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, details: 'Unauthorized: Invalid API key' }),
    };
  }

  // Extract parameters
  const coinId = cleanCoinId(event.path.split('/').pop());
  const queryParams = event.queryStringParameters || {};
  const auditLink = queryParams.auditLink || '';
  const bypassCache = queryParams.bypassCache === 'true';
  const cacheKey = `coin:${coinId}:${auditLink}`;
  const startTime = Date.now();

  try {
    if (!bypassCache && cache.has(cacheKey)) {
      console.log(`Cache hit for "${cacheKey}"`);
      const cachedResponse = cache.get(cacheKey);
      cachedResponse.searchTime = new Date().toISOString();
      cachedResponse.queryDuration = (Date.now() - startTime) / 1000;
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(cachedResponse),
      };
    }

    const results = {
      data: {},
      errors: [],
      risks: [],
      socials: {},
      community: {},
      developer: {},
      tokenomics: {},
      liquidity: {},
      market_sentiment: {},
    };
    let contractAddress = null;
    let holdersData = null;
    let chain = null;
    let isNativeCoin = false;

    const coinInfo = await getCoinId(coinId);
    if (!coinInfo) {
      throw new Error(`No coin found for "${coinId}". Try a different name or ID.`);
    }
    const mappedIds = {
      coingecko: coinInfo.id,
      coinmarketcap: coinInfo.symbol.toLowerCase(),
    };

    if (coinInfo.id === 'binancecoin') {
      isNativeCoin = true;
      chain = 'bsc';
    }

    const apis = [
      {
        name: 'CoinGecko',
        fetch: async () => {
          const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${mappedIds.coingecko}`, {
            headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
          });
          const data = response.data;
          if (!data.market_data) throw new Error('Invalid market data');
          contractAddress = data.platforms?.['binance-smart-chain'] || data.platforms?.ethereum || data.platforms?.solana;
          chain = isNativeCoin ? chain : data.platforms?.['binance-smart-chain'] ? 'bsc' : data.platforms?.ethereum ? 'ethereum' : 'other';
          results.socials = {
            twitter: data.links?.twitter_screen_name
              ? { handle: `@${data.links.twitter_screen_name}`, url: `https://x.com/${data.links.twitter_screen_name}`, verified: true }
              : { verified: false },
            facebook: data.links?.facebook_username
              ? { handle: data.links.facebook_username, url: `https://facebook.com/${data.links.facebook_username}`, verified: true }
              : { verified: false },
            instagram: data.links?.instagram_username
              ? { handle: data.links.instagram_username, url: `https://instagram.com/${data.links.instagram_username}`, verified: true }
              : { verified: false },
            telegram: data.links?.telegram_channel_identifier
              ? { handle: data.links.telegram_channel_identifier, url: `https://t.me/${data.links.telegram_channel_identifier.replace('@', '')}`, verified: true }
              : { verified: false },
            discord: data.links?.chat_url?.find(url => url.includes('discord'))
              ? { url: data.links.chat_url.find(url => url.includes('discord')), verified: true }
              : { verified: false },
            reddit: data.links?.subreddit_url
              ? { handle: data.links.subreddit_url.split('/').slice(-2, -1)[0], url: data.links.subreddit_url, verified: true }
              : { verified: false },
          };
          results.community = {
            twitter_followers: data.community_data?.twitter_followers || 0,
            telegram_members: data.community_data?.telegram_channel_user_count || 0,
            reddit_subscribers: data.community_data?.reddit_subscribers || 0,
          };
          results.developer = {
            github: data.links?.repos_url?.github?.[0] || null,
            commits: data.developer_data?.commit_count_4_weeks || 0,
            stars: data.developer_data?.stars || 0,
            last_update: data.developer_data?.last_commit_date || null,
          };
          results.tokenomics = {
            circulating_supply: data.market_data?.circulating_supply || 0,
            total_supply: data.market_data?.total_supply || 0,
            max_supply: data.market_data?.max_supply || null,
          };
          return {
            price: data.market_data.current_price.usd,
            marketCap: data.market_data.market_cap.usd,
            volume24h: data.market_data.total_volume.usd,
            priceChange24h: data.market_data.price_change_percentage_24h,
            name: data.name,
            symbol: data.symbol,
          };
        },
      },
    ];

    for (const api of apis) {
      try {
        results.data[api.name] = await api.fetch();
        console.log(`Fetched data from ${api.name} for "${coinId}"`);
      } catch (error) {
        console.error(`Error fetching from ${api.name} for "${coinId}": ${error.message}`);
        results.errors.push(`${api.name}: ${error.message}`);
      }
    }

    if (Object.keys(results.data).length === 0) {
      throw new Error(`No data found for "${coinId}". Check the coin name or try again later.`);
    }

    if (!isNativeCoin && contractAddress && (chain === 'ethereum' || chain === 'bsc')) {
      try {
        const apiUrl = chain === 'ethereum'
          ? `https://api.etherscan.io/api?module=token&action=tokenholderlist&contractaddress=${contractAddress}&page=1&offset=10&apikey=${process.env.ETHERSCAN_API_KEY}`
          : `https://api.bscscan.com/api?module=token&action=tokenholderlist&contractaddress=${contractAddress}&page=1&offset=10&apikey=${process.env.BSCSCAN_API_KEY}`;
        const holdersResponse = await axios.get(apiUrl);
        const holdersDataEtherscan = holdersResponse.data;
        if (holdersDataEtherscan.status === '1' && Array.isArray(holdersDataEtherscan.result) && holdersDataEtherscan.result.length > 0) {
          const totalSupply = results.data.CoinGecko?.market_data?.total_supply || 1;
          holdersData = {
            topHolders: holdersDataEtherscan.result.map((holder) => ({
              address: holder.TokenHolderAddress,
              balance: parseFloat(holder.TokenHolderQuantity),
              percentage: (holder.TokenHolderQuantity / totalSupply) * 100,
            })),
          };
          holdersData.totalTop10 = holdersData.topHolders.reduce((sum, h) => sum + h.percentage, 0);
          console.log(`Fetched holder data from ${chain === 'ethereum' ? 'Etherscan' : 'BscScan'} for "${coinId}"`);
        } else {
          throw new Error(`No holder data from ${chain === 'ethereum' ? 'Etherscan' : 'BscScan'}`);
        }
      } catch (error) {
        console.error(`Holder data error for "${coinId}" (${chain}): ${error.message}`);
        results.errors.push(`${chain === 'ethereum' ? 'Etherscan' : 'BscScan'}: ${error.message}`);
      }
    }

    results.liquidity = { locked: false, error: 'Liquidity lock status unavailable. Verify manually on Etherscan/BscScan.' };
    results.market_sentiment = await getFearGreedIndex();

    const prices = Object.values(results.data).map((d) => d.price).filter((p) => p);
    const volumes = Object.values(results.data).map((d) => d.volume24h).filter((v) => v);
    if (prices.length > 1) {
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      if (maxPrice / minPrice > 1.1) {
        results.risks.push('Price discrepancy >10% across APIs');
      }
    }
    if (volumes.length > 0) {
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      if (avgVolume < 10000) {
        results.risks.push('Low trading volume: Potential illiquidity or scam');
      }
    }
    if (holdersData?.totalTop10 >= 18) {
      results.risks.push(`High holder concentration: Top 10 holders own ${holdersData.totalTop10.toFixed(2)}%`);
    }
    if (Object.values(results.socials).every(s => !s.verified)) {
      results.risks.push('No verified social media presence: Potential scam risk');
    }
    if (!results.liquidity.locked && !isNativeCoin) {
      results.risks.push('Liquidity not locked: Potential rug pull risk');
    }

    const formatPrice = (price) => {
      if (!price) return '-';
      if (price < 0.0001) {
        return `$${price.toFixed(10).replace(/\.?0+$/, '')}`;
      }
      return `$${price.toFixed(6)}`;
    };

    const formatNumber = (num) => {
      if (!num) return '0';
      return num.toLocaleString();
    };

    const searchTime = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const queryDuration = (Date.now() - startTime) / 1000;

    let detailsHtml = `
      <h2><i class="bi bi-coin me-2"></i>${results.data.CoinGecko?.name || coinId}</h2>
      <p><i class="bi bi-clock me-2"></i><strong>Search Time:</strong> ${searchTime} (Query took ${queryDuration.toFixed(2)} seconds)</p>
      <h3>Market Data</h3>
      <table class="table table-bordered">
        <thead>
          <tr>
            <th>Price (USD)</th>
            <th>Market Cap (USD)</th>
            <th>24h Volume (USD)</th>
            <th>24h Price Change (%)</th>
          </tr>
        </thead>
        <tbody>
    `;
    const data = results.data.CoinGecko || Object.values(results.data)[0];
    if (data) {
      detailsHtml += `
        <tr>
          <td>${formatPrice(data.price)}</td>
          <td>${data.marketCap ? `$${data.marketCap.toLocaleString()}` : '-'}</td>
          <td>${data.volume24h ? `$${data.volume24h.toLocaleString()}` : '-'}</td>
          <td>${data.priceChange24h ? `${data.priceChange24h.toFixed(2)}%` : '-'}</td>
        </tr>
      `;
    }
    detailsHtml += '</tbody></table>';

    detailsHtml += `
      <h3>Detailed Analysis</h3>
      <table class="table table-bordered">
        <tbody>
    `;

    if (!results.market_sentiment.error) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-graph-up me-2"></i>Market Sentiment</td>
        </tr>
        <tr>
          <td>Fear/Greed Index</td>
          <td>${results.market_sentiment.classification} (${results.market_sentiment.value}/100) 📈</td>
        </tr>
      `;
    }

    detailsHtml += `
      <tr class="section-header">
        <td colspan="2"><i class="bi bi-globe me-2"></i>Social Media</td>
      </tr>
      <tr>
        <td>X</td>
        <td>${results.socials.twitter.verified ? `<a href="${results.socials.twitter.url}" target="_blank">${results.socials.twitter.handle}</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr>
        <td>Facebook</td>
        <td>${results.socials.facebook.verified ? `<a href="${results.socials.facebook.url}" target="_blank">${results.socials.facebook.handle}</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr>
        <td>Instagram</td>
        <td>${results.socials.instagram.verified ? `<a href="${results.socials.instagram.url}" target="_blank">${results.socials.instagram.handle}</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr>
        <td>Telegram</td>
        <td>${results.socials.telegram.verified ? `<a href="${results.socials.telegram.url}" target="_blank">${results.socials.telegram.handle}</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr>
        <td>Discord</td>
        <td>${results.socials.discord.verified ? `<a href="${results.socials.discord.url}" target="_blank">Server</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr>
        <td>Reddit</td>
        <td>${results.socials.reddit.verified ? `<a href="${results.socials.reddit.url}" target="_blank">${results.socials.reddit.handle}</a> (✅)` : 'None (❌)'}</td>
      </tr>
      <tr class="section-header">
        <td colspan="2"><i class="bi bi-people-fill me-2"></i>Community Engagement</td>
      </tr>
      <tr>
        <td>X Followers</td>
        <td>${formatNumber(results.community.twitter_followers)} 👥</td>
      </tr>
      <tr>
        <td>Telegram Members</td>
        <td>${formatNumber(results.community.telegram_members)} 👥</td>
      </tr>
      <tr>
        <td>Reddit Subscribers</td>
        <td>${formatNumber(results.community.reddit_subscribers)} 👥</td>
      </tr>
    `;

    if (results.developer.github) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-code-slash me-2"></i>Developer Activity</td>
        </tr>
        <tr>
          <td>GitHub</td>
          <td><a href="${results.developer.github}" target="_blank">Repository</a> (✅) 💻</td>
        </tr>
        <tr>
          <td>Commits (Last 30d)</td>
          <td>${results.developer.commits}</td>
        </tr>
        <tr>
          <td>Stars</td>
          <td>${formatNumber(results.developer.stars)}</td>
        </tr>
        <tr>
          <td>Last Update</td>
          <td>${results.developer.last_update || 'Unknown'}</td>
        </tr>
      `;
    }

    detailsHtml += `
      <tr class="section-header">
        <td colspan="2"><i class="bi bi-pie-chart-fill me-2"></i>Tokenomics</td>
      </tr>
      <tr>
        <td>Circulating Supply</td>
        <td>${formatNumber(results.tokenomics.circulating_supply)} ${results.data.CoinGecko?.symbol} 📊</td>
      </tr>
      <tr>
        <td>Total Supply</td>
        <td>${formatNumber(results.tokenomics.total_supply)} ${results.data.CoinGecko?.symbol}</td>
      </tr>
      <tr>
        <td>Max Supply</td>
        <td>${results.tokenomics.max_supply ? formatNumber(results.tokenomics.max_supply) : 'None'} ${results.tokenomics.max_supply ? results.data.CoinGecko?.symbol : ''}</td>
      </tr>
    `;

    let chainInfo = null;
    if (isNativeCoin || (contractAddress && chain === 'other')) {
      chainInfo = isNativeCoin ? 'Native chain coin (e.g., BNB on BSC). Holder data unavailable.' : 'Non-Ethereum/BSC token (e.g., Solana). Holder data unavailable. Verify manually.';
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-info-circle me-2"></i>Additional Info</td>
        </tr>
        <tr>
          <td>Chain Info</td>
          <td class="text-warning">${chainInfo} ⚠️</td>
        </tr>
      `;
    }

    if (!isNativeCoin) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-unlock-fill me-2"></i>Liquidity</td>
        </tr>
        <tr>
          <td>Status</td>
          <td class="text-warning">${results.liquidity.error} ⚠️</td>
        </tr>
      `;
    }

    if (holdersData?.topHolders) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-people me-2"></i>Top Holders (${chain === 'ethereum' ? 'Ethereum' : 'BSC'})</td>
        </tr>
        ${holdersData.topHolders.map((h) => `
          <tr>
            <td>Holder</td>
            <td><i class="bi bi-wallet me-2"></i>${h.address.slice(0, 6)}...: ${h.percentage.toFixed(2)}%</td>
          </tr>
        `).join('')}
        <tr>
          <td>Total Top 10</td>
          <td>${holdersData.totalTop10.toFixed(2)}%</td>
        </tr>
      `;
    }

    if (results.risks.length > 0) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-exclamation-triangle me-2"></i>Rug Pull Risks</td>
        </tr>
        ${results.risks.map((r) => `
          <tr>
            <td>Risk</td>
            <td class="text-danger">${r}</td>
          </tr>
        `).join('')}
      `;
    }

    if (auditLink) {
      detailsHtml += `
        <tr class="section-header">
          <td colspan="2"><i class="bi bi-file-check me-2"></i>Audit</td>
        </tr>
        <tr>
          <td>Audit Link</td>
          <td><a href="${auditLink}" target="_blank">View Audit</a></td>
        </tr>
      `;
    }

    const verdictClass = results.risks.length === 0 ? 'verdict-low' : 'verdict-high';
    const verdictIcon = results.risks.length === 0 ? '🟢' : '🔴';
    const verdictText = results.risks.length === 0 ? 'Low risk detected, but always DYOR. Not financial advice.' : 'Potential risks detected. Avoid or verify manually.';
    detailsHtml += `
      <tr class="section-header">
        <td colspan="2"><i class="bi bi-check-circle me-2"></i>Verdict</td>
      </tr>
      <tr>
        <td>Verdict</td>
        <td class="${verdictClass}">${verdictText} ${verdictIcon}</td>
      </tr>
    `;

    detailsHtml += '</tbody></table>';

    const response = {
      html: detailsHtml,
      searchTime,
      queryDuration,
      data: results.data.CoinGecko || Object.values(results.data)[0] || {},
      marketSentiment: results.market_sentiment,
      socials: results.socials,
      community: results.community,
      developer: results.developer,
      tokenomics: results.tokenomics,
      liquidity: results.liquidity,
      holders: holdersData,
      risks: results.risks,
      verdict: verdictText,
      chainInfo,
    };

    cache.set(cacheKey, response);
    setTimeout(() => cache.delete(cacheKey), CACHE_TTL);
    console.log(`Successfully processed "${coinId}" in ${queryDuration.toFixed(2)} seconds`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error(`Server error for "${coinId}": ${error.message}`, error.stack);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, details: `Server error while processing "${coinId}". Please try again.` }),
    };
  }
};