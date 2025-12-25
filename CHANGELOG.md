# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2024-12-25

### Added - Crypto & DeFi Capabilities

This release adds comprehensive cryptocurrency and DeFi research capabilities to Dexter.

#### New Crypto Market Tools (CoinGecko API - FREE)
- `search_crypto_tokens` - Search tokens by name/symbol
- `get_trending_crypto` - Top 7 trending tokens (24h)
- `get_crypto_token_info` - Full token details (price, market cap, supply, ATH/ATL)
- `get_crypto_price` - Quick price check for multiple tokens
- `get_crypto_ohlc` - OHLC candlestick data for charting
- `get_crypto_price_history` - Historical price data with summaries
- `get_global_crypto_data` - Total market cap, BTC/ETH dominance
- `get_top_crypto_coins` - Top coins by market cap with price changes
- `get_crypto_fear_greed` - Fear & Greed Index (sentiment indicator)
- `get_crypto_categories` - Token categories/sectors
- `get_crypto_by_sector` - Tokens in a specific sector
- `get_crypto_exchanges` - Top exchanges by volume

#### New DeFi Analytics Tools (DeFiLlama API - FREE)
- `get_top_defi_protocols` - Top protocols by TVL
- `get_defi_protocol_detail` - Detailed protocol info + TVL history
- `get_chain_tvl_data` - TVL by blockchain
- `get_chain_tvl_trend` - Historical TVL for a chain
- `get_defi_yields` - Best yield opportunities
- `get_stablecoin_data` - Stablecoin market data
- `get_dex_volume_data` - DEX trading volumes
- `compare_defi_protocols` - Side-by-side protocol comparison

#### Enhanced AI Understanding
- Updated system prompts for crypto/DeFi terminology
- Added crypto entity extraction (tokens, protocols, chains, categories)
- Enhanced planning prompts with crypto tool hints
- Improved answer generation for crypto data

### Changed
- Entity schema extended with crypto types: `token`, `protocol`, `chain`, `category`
- Tool selection prompts now prefer free CoinGecko tools over paid alternatives
- Updated default system prompt to mention crypto capabilities

### Fixed
- Removed optional fields from schemas to fix OpenAI structured output errors
- Fixed entity extraction schema compatibility with OpenAI API

### Security
- All new APIs are free and require no API keys
- Input validation with `encodeURIComponent()` for all user inputs
- HTTPS-only API calls
- Proper error handling with rate limit detection

---

## [2.2.0] - Original Release

Original Dexter release by [@virattt](https://github.com/virattt).

### Features
- Autonomous financial research agent
- Task planning with self-reflection
- Real-time stock market data
- SEC filings analysis
- Financial statements retrieval
- Multi-provider LLM support (OpenAI, Anthropic, Google)

---

## Fork Information

This is a fork of [virattt/dexter](https://github.com/virattt/dexter).

- **Original Author**: [@virattt](https://github.com/virattt)
- **Fork Author**: [@bokiko](https://gitlab.com/bokiko)
- **Fork Repository**: [gitlab.com/bokiko/dexter](https://gitlab.com/bokiko/dexter)

