import { StructuredToolInterface } from '@langchain/core/tools';
import {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
  // Note: Removed getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers
  // These require Financial Datasets API key - use CoinGecko tools instead (FREE)
} from './finance/index.js';
import { tavilySearch } from './search/index.js';

// Enhanced Crypto Tools (CoinGecko + DeFiLlama - no API key needed)
import {
  // Market Tools
  searchCryptoTokens,
  getTrendingCrypto,
  getCryptoTokenInfo,
  getCryptoPrice,
  getCryptoOHLC,
  getCryptoPriceHistory,
  getGlobalCryptoData,
  getTopCryptoCoins,
  getCryptoFearGreed,
  getCryptoCategories,
  getCryptoBySector,
  getCryptoExchanges,
  // DeFi Tools
  getTopDefiProtocols,
  getDefiProtocolDetail,
  getChainTVLData,
  getChainTVLTrend,
  getDefiYields,
  getStablecoinData,
  getDexVolumeData,
  compareDefiProtocols,
} from './crypto/index.js';

export const TOOLS: StructuredToolInterface[] = [
  // === Traditional Finance (Financial Datasets API) ===
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getFilings,
  getPriceSnapshot,
  getPrices,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
  
  // === Crypto Market (CoinGecko - FREE, no API key needed) ===
  searchCryptoTokens,
  getTrendingCrypto,
  getCryptoTokenInfo,
  getCryptoPrice,
  getCryptoOHLC,
  getCryptoPriceHistory,
  getGlobalCryptoData,
  getTopCryptoCoins,
  getCryptoFearGreed,
  getCryptoCategories,
  getCryptoBySector,
  getCryptoExchanges,
  
  // === DeFi Analytics (DeFiLlama - FREE) ===
  getTopDefiProtocols,
  getDefiProtocolDetail,
  getChainTVLData,
  getChainTVLTrend,
  getDefiYields,
  getStablecoinData,
  getDexVolumeData,
  compareDefiProtocols,
  
  // === Web Search (optional) ===
  ...(process.env.TAVILY_API_KEY ? [tavilySearch] : []),
];

export {
  // Traditional Finance
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
  // Crypto Market (CoinGecko - FREE)
  searchCryptoTokens,
  getTrendingCrypto,
  getCryptoTokenInfo,
  getCryptoPrice,
  getCryptoOHLC,
  getCryptoPriceHistory,
  getGlobalCryptoData,
  getTopCryptoCoins,
  getCryptoFearGreed,
  getCryptoCategories,
  getCryptoBySector,
  getCryptoExchanges,
  // DeFi Analytics
  getTopDefiProtocols,
  getDefiProtocolDetail,
  getChainTVLData,
  getChainTVLTrend,
  getDefiYields,
  getStablecoinData,
  getDexVolumeData,
  compareDefiProtocols,
  // Web Search
  tavilySearch,
};
