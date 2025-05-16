exports.handler = async () => {
  try {
    // CoinGecko API
    const cgResponse = await fetch(`https://api.coingecko.com/api/v3/news?x_cg_api_key=${process.env.CG_API_KEY}`);
    const cgData = cgResponse.ok ? await cgResponse.json() : { data: [] };
    console.log('CoinGecko response:', cgResponse.status, cgData.data?.length);

    // Crypto.News API
    const cnResponse = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://crypto.news/feed/');
    const cnData = cnResponse.ok ? await cnResponse.json() : { items: [] };
    console.log('Crypto.News response:', cnResponse.status, cnData.items?.length);

    return {
      statusCode: 200,
      body: JSON.stringify({
        coingecko: cgData.data || [],
        cryptonews: cnData.items || []
      })
    };
  } catch (error) {
    console.error('Fetch news error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};