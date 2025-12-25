/**
 * Crypto Market Tools - Token discovery, prices, and market data
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  searchTokens,
  getTokenInfo,
  getTokenPrice,
  getTokenOHLC,
  getTokenMarketChart,
  getTrendingTokens,
  getGlobalMarketData,
  getTopCoins,
  getCategories,
  getCategoryCoins,
  getExchanges,
  getFearGreedIndex,
} from './api.js';

// ============================================================================
// Token Search & Discovery
// ============================================================================

export const searchCryptoTokens = new DynamicStructuredTool({
  name: 'search_crypto_tokens',
  description: `Search for cryptocurrency tokens by name or symbol. Returns matching tokens with their CoinGecko IDs, symbols, and market cap ranks. Use this to find the correct token ID before fetching detailed data. Example: searching "ethereum" returns ETH and related tokens.`,
  schema: z.object({
    query: z.string().describe('Search query - token name or symbol (e.g., "bitcoin", "ETH", "solana")'),
  }),
  func: async (input) => {
    const { data, url } = await searchTokens(input.query);
    // Extract most relevant results
    const result = {
      coins: (data as any).coins?.slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol?.toUpperCase(),
        market_cap_rank: c.market_cap_rank,
      })) || [],
      categories: (data as any).categories?.slice(0, 5) || [],
      nfts: (data as any).nfts?.slice(0, 3) || [],
    };
    return formatToolResult(result, [url]);
  },
});

export const getTrendingCrypto = new DynamicStructuredTool({
  name: 'get_trending_crypto',
  description: `Get the top 7 trending cryptocurrencies on CoinGecko based on search popularity in the last 24 hours. Great for discovering what's hot in the market right now.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getTrendingTokens();
    const coins = (data as any).coins?.map((item: any) => ({
      id: item.item?.id,
      name: item.item?.name,
      symbol: item.item?.symbol?.toUpperCase(),
      market_cap_rank: item.item?.market_cap_rank,
      price_btc: item.item?.price_btc,
      score: item.item?.score,
    })) || [];
    return formatToolResult({ trending_coins: coins }, [url]);
  },
});

// ============================================================================
// Token Information
// ============================================================================

export const getCryptoTokenInfo = new DynamicStructuredTool({
  name: 'get_crypto_token_info',
  description: `Get comprehensive information about a cryptocurrency token including current price, market cap, volume, supply data, price changes, all-time high/low, and description. Use the CoinGecko ID (e.g., 'bitcoin', 'ethereum', 'solana') - search first if unsure.`,
  schema: z.object({
    token_id: z.string().describe('CoinGecko token ID (e.g., "bitcoin", "ethereum", "solana"). Use search_crypto_tokens first if unsure.'),
  }),
  func: async (input) => {
    const { data, url } = await getTokenInfo(input.token_id, { market_data: true });
    const d = data as any;
    const result = {
      id: d.id,
      name: d.name,
      symbol: d.symbol?.toUpperCase(),
      description: d.description?.en?.slice(0, 500),
      categories: d.categories,
      links: {
        homepage: d.links?.homepage?.[0],
        twitter: d.links?.twitter_screen_name,
        github: d.links?.repos_url?.github?.[0],
      },
      market_data: d.market_data ? {
        current_price_usd: d.market_data.current_price?.usd,
        market_cap_usd: d.market_data.market_cap?.usd,
        market_cap_rank: d.market_data.market_cap_rank,
        fully_diluted_valuation: d.market_data.fully_diluted_valuation?.usd,
        total_volume_24h: d.market_data.total_volume?.usd,
        circulating_supply: d.market_data.circulating_supply,
        total_supply: d.market_data.total_supply,
        max_supply: d.market_data.max_supply,
        price_change_24h: d.market_data.price_change_percentage_24h,
        price_change_7d: d.market_data.price_change_percentage_7d,
        price_change_30d: d.market_data.price_change_percentage_30d,
        ath: d.market_data.ath?.usd,
        ath_change_percentage: d.market_data.ath_change_percentage?.usd,
        ath_date: d.market_data.ath_date?.usd,
        atl: d.market_data.atl?.usd,
        atl_date: d.market_data.atl_date?.usd,
      } : null,
      genesis_date: d.genesis_date,
      sentiment_votes_up_percentage: d.sentiment_votes_up_percentage,
      sentiment_votes_down_percentage: d.sentiment_votes_down_percentage,
    };
    return formatToolResult(result, [url]);
  },
});

export const getCryptoPrice = new DynamicStructuredTool({
  name: 'get_crypto_price',
  description: `Get current price, market cap, and 24h volume for one or more cryptocurrencies. Fast endpoint for quick price checks. Use CoinGecko IDs.`,
  schema: z.object({
    token_ids: z.array(z.string()).describe('Array of CoinGecko token IDs (e.g., ["bitcoin", "ethereum"])'),
    vs_currency: z.string().default('usd').describe('Currency to price against (default: "usd")'),
  }),
  func: async (input) => {
    const { data, url } = await getTokenPrice(
      input.token_ids,
      [input.vs_currency],
      { include_market_cap: true, include_24hr_vol: true, include_24hr_change: true }
    );
    return formatToolResult(data, [url]);
  },
});

// ============================================================================
// Historical Data
// ============================================================================

export const getCryptoOHLC = new DynamicStructuredTool({
  name: 'get_crypto_ohlc',
  description: `Get OHLC (Open, High, Low, Close) candlestick data for a cryptocurrency. Returns price data at different intervals based on the time range: 1-2 days = 30min candles, 3-30 days = 4hr candles, 31-90 days = 4hr candles, 91+ days = daily candles.`,
  schema: z.object({
    token_id: z.string().describe('CoinGecko token ID (e.g., "bitcoin")'),
    days: z.number().default(30).describe('Number of days of data (1, 7, 14, 30, 90, 180, 365, or max)'),
    vs_currency: z.string().default('usd').describe('Currency to price against'),
  }),
  func: async (input) => {
    const { data, url } = await getTokenOHLC(input.token_id, input.vs_currency, input.days);
    // Format OHLC data: [timestamp, open, high, low, close]
    const formatted = (data as any[])?.map((candle: number[]) => ({
      timestamp: new Date(candle[0]).toISOString(),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    })) || [];
    return formatToolResult({ ohlc: formatted, count: formatted.length }, [url]);
  },
});

export const getCryptoPriceHistory = new DynamicStructuredTool({
  name: 'get_crypto_price_history',
  description: `Get historical price, market cap, and volume data for a cryptocurrency. Good for charting and trend analysis. Data granularity: 1 day = 5min, 2-90 days = hourly, 90+ days = daily.`,
  schema: z.object({
    token_id: z.string().describe('CoinGecko token ID (e.g., "bitcoin")'),
    days: z.union([z.number(), z.literal('max')]).default(30).describe('Number of days (1, 7, 14, 30, 90, 180, 365, or "max")'),
    vs_currency: z.string().default('usd').describe('Currency to price against'),
  }),
  func: async (input) => {
    const { data, url } = await getTokenMarketChart(input.token_id, input.vs_currency, input.days);
    const d = data as any;
    // Summarize the data points
    const prices = d.prices || [];
    const result = {
      data_points: prices.length,
      first_price: prices[0] ? { date: new Date(prices[0][0]).toISOString(), price: prices[0][1] } : null,
      last_price: prices[prices.length - 1] ? { date: new Date(prices[prices.length - 1][0]).toISOString(), price: prices[prices.length - 1][1] } : null,
      price_change: prices.length >= 2 ? ((prices[prices.length - 1][1] - prices[0][1]) / prices[0][1] * 100).toFixed(2) + '%' : null,
      // Sample every Nth point for reasonable output size
      sampled_prices: prices.filter((_: any, i: number) => i % Math.ceil(prices.length / 20) === 0).map((p: number[]) => ({
        date: new Date(p[0]).toISOString(),
        price: p[1],
      })),
    };
    return formatToolResult(result, [url]);
  },
});

// ============================================================================
// Market Overview
// ============================================================================

export const getGlobalCryptoData = new DynamicStructuredTool({
  name: 'get_global_crypto_data',
  description: `Get global cryptocurrency market data including total market cap, BTC dominance, ETH dominance, number of active cryptocurrencies, and market cap changes.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getGlobalMarketData();
    const d = (data as any).data;
    const result = {
      active_cryptocurrencies: d.active_cryptocurrencies,
      markets: d.markets,
      total_market_cap_usd: d.total_market_cap?.usd,
      total_volume_24h_usd: d.total_volume?.usd,
      btc_dominance: d.market_cap_percentage?.btc?.toFixed(2) + '%',
      eth_dominance: d.market_cap_percentage?.eth?.toFixed(2) + '%',
      market_cap_change_24h: d.market_cap_change_percentage_24h_usd?.toFixed(2) + '%',
    };
    return formatToolResult(result, [url]);
  },
});

export const getTopCryptoCoins = new DynamicStructuredTool({
  name: 'get_top_crypto_coins',
  description: `Get the top cryptocurrencies by market cap with price, volume, and price change data. Great for market overview and comparing major tokens.`,
  schema: z.object({
    limit: z.number().default(20).describe('Number of coins to return (max 100)'),
    page: z.number().default(1).describe('Page number for pagination'),
  }),
  func: async (input) => {
    const limit = Math.min(input.limit, 100);
    const { data, url } = await getTopCoins('usd', limit, input.page);
    const coins = (data as any[])?.map((c: any) => ({
      rank: c.market_cap_rank,
      id: c.id,
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      price_usd: c.current_price,
      market_cap: c.market_cap,
      volume_24h: c.total_volume,
      price_change_1h: c.price_change_percentage_1h_in_currency?.toFixed(2) + '%',
      price_change_24h: c.price_change_percentage_24h?.toFixed(2) + '%',
      price_change_7d: c.price_change_percentage_7d_in_currency?.toFixed(2) + '%',
      price_change_30d: c.price_change_percentage_30d_in_currency?.toFixed(2) + '%',
      ath: c.ath,
      ath_change: c.ath_change_percentage?.toFixed(2) + '%',
    })) || [];
    return formatToolResult({ coins, count: coins.length }, [url]);
  },
});

// ============================================================================
// Market Sentiment
// ============================================================================

export const getCryptoFearGreed = new DynamicStructuredTool({
  name: 'get_crypto_fear_greed',
  description: `Get the Crypto Fear & Greed Index - a sentiment indicator from 0 (Extreme Fear) to 100 (Extreme Greed). Shows current value and recent history. Useful for understanding market sentiment and potential buying/selling opportunities.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getFearGreedIndex();
    const d = data as any;
    const result = {
      current: {
        value: parseInt(d.data?.[0]?.value),
        classification: d.data?.[0]?.value_classification,
        timestamp: new Date(parseInt(d.data?.[0]?.timestamp) * 1000).toISOString(),
      },
      history: d.data?.slice(0, 7).map((item: any) => ({
        value: parseInt(item.value),
        classification: item.value_classification,
        date: new Date(parseInt(item.timestamp) * 1000).toISOString().split('T')[0],
      })),
      interpretation: {
        '0-24': 'Extreme Fear - potential buying opportunity',
        '25-49': 'Fear - market is worried',
        '50': 'Neutral',
        '51-74': 'Greed - market is getting greedy',
        '75-100': 'Extreme Greed - potential correction ahead',
      },
    };
    return formatToolResult(result, [url]);
  },
});

// ============================================================================
// Categories & Sectors
// ============================================================================

export const getCryptoCategories = new DynamicStructuredTool({
  name: 'get_crypto_categories',
  description: `Get all cryptocurrency categories/sectors with their market caps and volume. Categories include DeFi, Layer 1, Layer 2, Meme coins, Gaming, AI, etc. Useful for sector analysis.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getCategories();
    const categories = (data as any[])?.slice(0, 30).map((c: any) => ({
      id: c.id,
      name: c.name,
      market_cap: c.market_cap,
      market_cap_change_24h: c.market_cap_change_24h?.toFixed(2) + '%',
      volume_24h: c.volume_24h,
      top_3_coins: c.top_3_coins,
    })) || [];
    return formatToolResult({ categories, count: categories.length }, [url]);
  },
});

export const getCryptoBySector = new DynamicStructuredTool({
  name: 'get_crypto_by_sector',
  description: `Get cryptocurrencies in a specific category/sector. Use get_crypto_categories first to find category IDs. Examples: "layer-1", "decentralized-finance-defi", "meme-token", "artificial-intelligence".`,
  schema: z.object({
    category_id: z.string().describe('Category ID from get_crypto_categories (e.g., "layer-1", "decentralized-finance-defi")'),
  }),
  func: async (input) => {
    const { data, url } = await getCategoryCoins(input.category_id);
    const coins = (data as any[])?.slice(0, 25).map((c: any) => ({
      rank: c.market_cap_rank,
      id: c.id,
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      price_usd: c.current_price,
      market_cap: c.market_cap,
      price_change_24h: c.price_change_percentage_24h?.toFixed(2) + '%',
    })) || [];
    return formatToolResult({ category: input.category_id, coins, count: coins.length }, [url]);
  },
});

// ============================================================================
// Exchanges
// ============================================================================

export const getCryptoExchanges = new DynamicStructuredTool({
  name: 'get_crypto_exchanges',
  description: `Get top cryptocurrency exchanges by trading volume. Shows trust score, 24h volume, and number of trading pairs. Useful for understanding where liquidity is.`,
  schema: z.object({
    limit: z.number().default(20).describe('Number of exchanges to return'),
  }),
  func: async (input) => {
    const { data, url } = await getExchanges(Math.min(input.limit, 50));
    const exchanges = (data as any[])?.map((e: any) => ({
      rank: e.trust_score_rank,
      id: e.id,
      name: e.name,
      trust_score: e.trust_score,
      volume_24h_btc: e.trade_volume_24h_btc,
      year_established: e.year_established,
      country: e.country,
    })) || [];
    return formatToolResult({ exchanges, count: exchanges.length }, [url]);
  },
});

