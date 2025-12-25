# Dexter 🤖 - Crypto Enhanced Fork

> **This is a fork of [virattt/dexter](https://github.com/virattt/dexter)** with added cryptocurrency and DeFi research capabilities.

[![Original Author](https://img.shields.io/badge/Original%20Author-virattt-blue)](https://github.com/virattt)
[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

---

## 🍴 Fork Information

| | |
|---|---|
| **Original Repository** | [github.com/virattt/dexter](https://github.com/virattt/dexter) |
| **Original Author** | [@virattt](https://github.com/virattt) |
| **This Fork** | [gitlab.com/bokiko/dexter](https://gitlab.com/bokiko/dexter) |
| **Fork Author** | [@bokiko](https://gitlab.com/bokiko) |
| **Fork Date** | December 2024 |

---

## ✨ What's New in This Fork

This fork adds **comprehensive cryptocurrency and DeFi research** capabilities to the original Dexter financial research agent.

### New Features Added

| Category | Tools Added | API Used |
|----------|-------------|----------|
| **Crypto Market** | 12 tools | CoinGecko (FREE) |
| **DeFi Analytics** | 8 tools | DeFiLlama (FREE) |
| **AI Enhancements** | Crypto-aware prompts | - |

### New Crypto Tools (No API Key Needed!)

**Market Data (CoinGecko)**:
- `search_crypto_tokens` - Search tokens by name/symbol
- `get_trending_crypto` - Top 7 trending tokens (24h)
- `get_crypto_token_info` - Full token details (price, market cap, supply)
- `get_crypto_price` - Quick multi-token price check
- `get_crypto_ohlc` - Candlestick chart data
- `get_crypto_price_history` - Historical price data
- `get_global_crypto_data` - Total market cap, BTC/ETH dominance
- `get_top_crypto_coins` - Top coins by market cap
- `get_crypto_fear_greed` - Fear & Greed Index (sentiment)
- `get_crypto_categories` - Token sectors/categories
- `get_crypto_by_sector` - Tokens in a specific sector
- `get_crypto_exchanges` - Top exchanges by volume

**DeFi Analytics (DeFiLlama)**:
- `get_top_defi_protocols` - Top protocols by TVL
- `get_defi_protocol_detail` - Detailed protocol info + history
- `get_chain_tvl_data` - TVL by blockchain
- `get_chain_tvl_trend` - Historical TVL for a chain
- `get_defi_yields` - Best yield opportunities
- `get_stablecoin_data` - Stablecoin market data
- `get_dex_volume_data` - DEX trading volumes
- `compare_defi_protocols` - Side-by-side comparison

### AI Enhancements

- Updated system prompts to understand crypto terminology
- Added crypto entity extraction (tokens, protocols, chains, categories)
- Enhanced planning for crypto/DeFi queries
- Better answer generation for crypto data

---

## 📁 Files Changed/Added

```
src/tools/crypto/           # NEW - All crypto tools
├── api.ts                  # CoinGecko + DeFiLlama API clients
├── market.ts               # 12 crypto market tools
├── defi.ts                 # 8 DeFi analytics tools
└── index.ts                # Exports

src/tools/index.ts          # MODIFIED - Added crypto tool imports
src/agent/prompts.ts        # MODIFIED - Crypto-aware prompts
src/agent/schemas.ts        # MODIFIED - Crypto entity types

CRYPTO_ENHANCEMENTS.md      # NEW - Detailed enhancement docs
SECURITY_REVIEW.md          # NEW - Security audit of original code
```

**Lines of code added:** ~1,600

---

## 🔧 Development Process

This fork was developed with the following approach:

1. **Security Review** - Audited original codebase for vulnerabilities
2. **Architecture Analysis** - Studied existing tool patterns
3. **API Selection** - Chose free APIs (CoinGecko, DeFiLlama) for accessibility
4. **Tool Development** - Created 20 new tools following existing patterns
5. **Prompt Engineering** - Enhanced AI understanding of crypto concepts
6. **Schema Updates** - Extended entity extraction for crypto entities
7. **Testing** - Verified all tools work with the agent

### Design Decisions

| Decision | Reasoning |
|----------|-----------|
| Free APIs only | Lower barrier to entry, no extra costs |
| CoinGecko for market data | Most comprehensive free crypto API |
| DeFiLlama for DeFi | Industry standard for TVL data |
| No breaking changes | Maintains compatibility with original |
| Conservative rate limiting | Respect API limits |

---

## 🚀 Installation

### Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- OpenAI API key (or Anthropic/Google)
- Financial Datasets API key (for stock data)
- **No additional keys needed for crypto features!**

### Quick Start

```bash
# Clone this fork
git clone https://gitlab.com/bokiko/dexter.git
cd dexter

# Install dependencies
bun install

# Set up environment
cp env.example .env
# Edit .env and add your API keys

# Run
bun start
```

### API Keys Required

| Service | Required For | Cost |
|---------|--------------|------|
| OpenAI/Anthropic/Google | AI models | Paid |
| Financial Datasets | Stock data | Free tier |
| **CoinGecko** | Crypto data | **FREE** |
| **DeFiLlama** | DeFi data | **FREE** |
| Tavily | Web search | Optional |

---

## 💬 Example Queries

### Original (Stocks)
- "What was Apple's revenue growth over the last 4 quarters?"
- "Compare Microsoft and Google's operating margins"
- "Analyze Tesla's cash flow trends"

### New (Crypto)
- "What are the top trending cryptocurrencies?"
- "Compare Bitcoin and Ethereum price performance"
- "What's the current crypto Fear & Greed Index?"
- "Show me the top 10 AI tokens by market cap"

### New (DeFi)
- "Which DeFi protocols have the highest TVL?"
- "Compare Aave vs Compound vs MakerDAO"
- "What are the best yield opportunities on Arbitrum?"
- "How has Ethereum's TVL changed over 90 days?"

### Mixed
- "Compare Apple stock vs Bitcoin over the past year"
- "Which has better returns: NVIDIA or Ethereum?"

---

## 🏗️ Architecture

Original Dexter architecture (unchanged):

```
User Query
    ↓
[Understand Phase] → Extract intent & entities
    ↓
[Plan Phase] → Create task list
    ↓
[Execute Phase] → Run tools, gather data
    ↓
[Answer Phase] → Synthesize response
```

**This fork adds:**
- New entity types: `token`, `protocol`, `chain`, `category`
- New tool category: `crypto/` with 20 tools
- Enhanced prompts for crypto understanding

---

## 📊 Original vs Fork Comparison

| Feature | Original | This Fork |
|---------|----------|-----------|
| Stock Research | ✅ | ✅ |
| SEC Filings | ✅ | ✅ |
| Financial Metrics | ✅ | ✅ |
| Basic Crypto Prices | ✅ | ✅ |
| **Crypto Market Data** | ❌ | ✅ |
| **Trending Tokens** | ❌ | ✅ |
| **Fear & Greed Index** | ❌ | ✅ |
| **DeFi TVL Data** | ❌ | ✅ |
| **Yield Opportunities** | ❌ | ✅ |
| **Protocol Comparison** | ❌ | ✅ |
| **Stablecoin Data** | ❌ | ✅ |
| **DEX Volumes** | ❌ | ✅ |
| Extra API Keys Needed | - | **None** |

---

## 🔒 Security

This fork maintains the security standards of the original:

- ✅ No hardcoded credentials
- ✅ API keys via environment variables
- ✅ Input validation on all tools
- ✅ HTTPS for all API requests
- ✅ No data exfiltration
- ✅ Security review completed (see `SECURITY_REVIEW.md`)

---

## 📝 Changelog

### v3.0.0 (2024-12-25) - This Fork
- **NEW**: 12 crypto market tools (CoinGecko - FREE)
- **NEW**: 8 DeFi analytics tools (DeFiLlama - FREE)
- **NEW**: Fear & Greed Index sentiment tracking
- **ENHANCED**: AI prompts for crypto understanding
- **ENHANCED**: Entity extraction for tokens, protocols, chains
- **FIXED**: OpenAI structured output schema errors
- **FIXED**: Tool selection to prefer free APIs

See [CHANGELOG.md](CHANGELOG.md) for full details.

### v2.2.0 (Original)
- Base version by [@virattt](https://github.com/virattt)

---

## 🙏 Credits

- **Original Dexter** by [@virattt](https://github.com/virattt) - Amazing financial research agent
- **CoinGecko** - Free crypto market data API
- **DeFiLlama** - Free DeFi analytics API
- **LangChain** - AI orchestration framework

---

## 📄 License

This project is licensed under the MIT License (same as original).

---

## 🔗 Links

- [Original Repository](https://github.com/virattt/dexter)
- [Original Author Twitter](https://twitter.com/virattt)
- [CoinGecko API](https://www.coingecko.com/en/api)
- [DeFiLlama API](https://defillama.com/docs/api)
