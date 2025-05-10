# RugBuster

A tool to research meme coins and detect potential rug pulls by analyzing price, market cap, liquidity, holder concentration, and more. Built with Node.js, Express, and Bootstrap.

## Features

- Search for coins using CoinGecko API.
- Analyze liquidity and holder concentration using Bitquery and Etherscan APIs.
- Submit an optional audit link to display in results.
- Risk assessment and verdict for potential scams.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- API keys from:
  - [CoinGecko](https://www.coingecko.com/en/api)
  - [Etherscan](https://etherscan.io/apis)
  - [Bitquery](https://bitquery.io/)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/michealohagwam/rugbuster.git
   cd rugbuster
