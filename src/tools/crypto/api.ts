/**
 * CoinGecko API Client - Free tier, no API key required
 * Rate limit: 10-30 calls/minute (we'll be conservative)
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_BASE = 'https://api.llama.fi';

export interface ApiResponse<T = unknown> {
  data: T;
  url: string;
}

/**
 * Generic fetch helper with error handling
 */
async function fetchJson<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limited by API. Please wait a moment and try again.');
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { data, url };
}

// ============================================================================
// CoinGecko API Functions
// ============================================================================

/**
 * Search for tokens by name or symbol
 */
export async function searchTokens(query: string): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
  return fetchJson(url);
}

/**
 * Get token info by CoinGecko ID
 */
export async function getTokenInfo(
  id: string,
  options: {
    localization?: boolean;
    tickers?: boolean;
    market_data?: boolean;
    community_data?: boolean;
    developer_data?: boolean;
  } = {}
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    localization: String(options.localization ?? false),
    tickers: String(options.tickers ?? false),
    market_data: String(options.market_data ?? true),
    community_data: String(options.community_data ?? false),
    developer_data: String(options.developer_data ?? false),
  });
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}?${params}`;
  return fetchJson(url);
}

/**
 * Get token price by ID with market data
 */
export async function getTokenPrice(
  ids: string[],
  vsCurrencies: string[] = ['usd'],
  options: {
    include_market_cap?: boolean;
    include_24hr_vol?: boolean;
    include_24hr_change?: boolean;
  } = {}
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: vsCurrencies.join(','),
    include_market_cap: String(options.include_market_cap ?? true),
    include_24hr_vol: String(options.include_24hr_vol ?? true),
    include_24hr_change: String(options.include_24hr_change ?? true),
  });
  const url = `${COINGECKO_BASE}/simple/price?${params}`;
  return fetchJson(url);
}

/**
 * Get historical price data (OHLC)
 */
export async function getTokenOHLC(
  id: string,
  vsCurrency: string = 'usd',
  days: number = 30
): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=${vsCurrency}&days=${days}`;
  return fetchJson(url);
}

/**
 * Get historical market chart data
 */
export async function getTokenMarketChart(
  id: string,
  vsCurrency: string = 'usd',
  days: number | 'max' = 30
): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
  return fetchJson(url);
}

/**
 * Get trending tokens (top 7)
 */
export async function getTrendingTokens(): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/search/trending`;
  return fetchJson(url);
}

/**
 * Get global crypto market data
 */
export async function getGlobalMarketData(): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/global`;
  return fetchJson(url);
}

/**
 * Get top coins by market cap
 */
export async function getTopCoins(
  vsCurrency: string = 'usd',
  perPage: number = 50,
  page: number = 1,
  order: string = 'market_cap_desc'
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    vs_currency: vsCurrency,
    order,
    per_page: String(perPage),
    page: String(page),
    sparkline: 'false',
    price_change_percentage: '1h,24h,7d,30d',
  });
  const url = `${COINGECKO_BASE}/coins/markets?${params}`;
  return fetchJson(url);
}

/**
 * Get token categories
 */
export async function getCategories(): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/coins/categories`;
  return fetchJson(url);
}

/**
 * Get coins in a category
 */
export async function getCategoryCoins(
  categoryId: string,
  vsCurrency: string = 'usd'
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    vs_currency: vsCurrency,
    category: categoryId,
    order: 'market_cap_desc',
    per_page: '50',
    page: '1',
    sparkline: 'false',
  });
  const url = `${COINGECKO_BASE}/coins/markets?${params}`;
  return fetchJson(url);
}

/**
 * Get exchange list
 */
export async function getExchanges(perPage: number = 20): Promise<ApiResponse> {
  const url = `${COINGECKO_BASE}/exchanges?per_page=${perPage}`;
  return fetchJson(url);
}

/**
 * Get Fear & Greed Index (from alternative.me API)
 */
export async function getFearGreedIndex(): Promise<ApiResponse> {
  const url = 'https://api.alternative.me/fng/?limit=10';
  return fetchJson(url);
}

// ============================================================================
// DeFiLlama API Functions (for TVL and DeFi data)
// ============================================================================

/**
 * Get all DeFi protocols with TVL
 */
export async function getDefiProtocols(): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/protocols`;
  return fetchJson(url);
}

/**
 * Get protocol TVL history
 */
export async function getProtocolTVL(protocol: string): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/protocol/${encodeURIComponent(protocol)}`;
  return fetchJson(url);
}

/**
 * Get TVL by chain
 */
export async function getChainsTVL(): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/v2/chains`;
  return fetchJson(url);
}

/**
 * Get chain TVL history
 */
export async function getChainTVLHistory(chain: string): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/v2/historicalChainTvl/${encodeURIComponent(chain)}`;
  return fetchJson(url);
}

/**
 * Get yield pools/farms
 */
export async function getYieldPools(): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/pools`;
  return fetchJson(url);
}

/**
 * Get stablecoin data
 */
export async function getStablecoins(): Promise<ApiResponse> {
  const url = 'https://stablecoins.llama.fi/stablecoins?includePrices=true';
  return fetchJson(url);
}

/**
 * Get DEX volumes
 */
export async function getDexVolumes(): Promise<ApiResponse> {
  const url = `${DEFILLAMA_BASE}/overview/dexs`;
  return fetchJson(url);
}

