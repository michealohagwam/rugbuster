require('dotenv').config();

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: true, details: 'Method not allowed' }),
    };
  }

  // Return API key
  const API_KEY = process.env.CLIENT_SERVER_API_KEY || 'rugbuster-secret-123';
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Enable CORS
    },
    body: JSON.stringify({ apiKey: API_KEY }),
  };
};