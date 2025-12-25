# Dexter Crypto Enhancements 🚀

Enhanced version of Dexter with comprehensive cryptocurrency and DeFi research capabilities.

## New Features

### 🪙 Crypto Market Tools (via CoinGecko - FREE, no API key!)

| Tool | Description |
|------|-------------|
| `search_crypto_tokens` | Search for tokens by name/symbol |
| `get_trending_crypto` | Top 7 trending tokens (24h) |
| `get_crypto_token_info` | Full token details (price, market cap, supply, ATH/ATL) |
| `get_crypto_price` | Quick price check for multiple tokens |
| `get_crypto_ohlc` | OHLC candlestick data |
| `get_crypto_price_history` | Historical price charts |
| `get_global_crypto_data` | Total market cap, BTC/ETH dominance |
| `get_top_crypto_coins` | Top coins by market cap |
| `get_crypto_fear_greed` | Fear & Greed Index (sentiment) |
| `get_crypto_categories` | Token categories/sectors |
| `get_crypto_by_sector` | Tokens in a specific sector |
| `get_crypto_exchanges` | Top exchanges by volume |

### 📊 DeFi Analytics Tools (via DeFiLlama - FREE, no API key!)

| Tool | Description |
|------|-------------|
| `get_top_defi_protocols` | Top DeFi protocols by TVL |
| `get_defi_protocol_detail` | Detailed protocol info + TVL history |
| `get_chain_tvl_data` | TVL by blockchain |
| `get_chain_tvl_trend` | Historical TVL for a chain |
| `get_defi_yields` | Best yield opportunities |
| `get_stablecoin_data` | Stablecoin market data |
| `get_dex_volume_data` | DEX trading volumes |
| `compare_defi_protocols` | Side-by-side protocol comparison |

## Example Queries

### Crypto Market

- "What are the top trending cryptocurrencies right now?"
- "Compare Bitcoin and Ethereum market caps and price performance"
- "What's the current crypto Fear & Greed Index?"
- "Show me the top 10 AI tokens by market cap"
- "What's Solana's price history over the last 30 days?"

### DeFi Analysis

- "Which DeFi protocols have the highest TVL?"
- "Compare Aave vs Compound vs MakerDAO"
- "What are the best yield opportunities on Arbitrum?"
- "How has Ethereum's TVL changed over the last 90 days?"
- "Show me the top DEXes by trading volume"
- "What's the stablecoin market cap breakdown?"

### Mixed Analysis

- "Compare Apple stock performance vs Bitcoin over the past year"
- "Which has better returns: NVIDIA stock or Ethereum?"
- "Analyze the correlation between tech stocks and crypto"

## Installation

```bash
# Clone the repo
git clone https://github.com/virattt/dexter.git
cd dexter

# Install dependencies
bun install

# Set up environment (only need API keys for stock data)
cp env.example .env
# Edit .env with your API keys

# Run
bun start
```

## API Keys Required

| Service | Required For | Free Tier |
|---------|--------------|-----------|
| OpenAI/Anthropic/Google | AI models | Paid |
| Financial Datasets | Stock data | Free tier available |
| **CoinGecko** | Crypto data | ✅ **FREE - No key needed** |
| **DeFiLlama** | DeFi data | ✅ **FREE - No key needed** |
| Tavily | Web search | Optional |

## Technical Details

### New Files Added

```
src/tools/crypto/
├── api.ts      # CoinGecko + DeFiLlama API clients
├── market.ts   # Crypto market tools
├── defi.ts     # DeFi analytics tools
└── index.ts    # Exports
```

### Modified Files

- `src/tools/index.ts` - Added crypto tool imports
- `src/agent/prompts.ts` - Enhanced for crypto understanding
- `src/agent/schemas.ts` - Added crypto entity types

### Entity Types

The agent now understands:
- **Traditional**: `ticker`, `company`, `date`, `period`, `metric`
- **Crypto**: `token`, `protocol`, `chain`, `category`

### Token ID Mappings

Common mappings the agent understands:
- Bitcoin → `bitcoin`
- Ethereum/ETH → `ethereum`
- Solana/SOL → `solana`
- Arbitrum/ARB → `arbitrum`
- Polygon/MATIC → `matic-network`

### Protocol Slug Mappings

DeFi protocols use slugs:
- Aave → `aave`
- Uniswap → `uniswap`
- Lido → `lido`
- Curve → `curve-finance`
- MakerDAO → `makerdao`

## Rate Limits

These free APIs have rate limits:
- **CoinGecko**: ~10-30 calls/minute (free tier)
- **DeFiLlama**: ~300 calls/5 minutes

The agent is designed to be conservative with API calls.

## Security

✅ No additional API keys stored
✅ All new APIs are free and public
✅ Input validation on all token IDs
✅ HTTPS for all requests
✅ No data exfiltration

## Future Enhancements

Potential additions:
- [ ] On-chain data (wallet analysis)
- [ ] NFT market data
- [ ] Perpetual futures data
- [ ] Governance proposal tracking
- [ ] Token unlocks calendar
- [ ] Whale wallet tracking

---

Built with ❤️ for the crypto community

