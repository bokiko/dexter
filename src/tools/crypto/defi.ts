/**
 * DeFi Tools - TVL, protocols, yields, and DEX data via DeFiLlama
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  getDefiProtocols,
  getProtocolTVL,
  getChainsTVL,
  getChainTVLHistory,
  getYieldPools,
  getStablecoins,
  getDexVolumes,
} from './api.js';

// ============================================================================
// Protocol TVL
// ============================================================================

export const getTopDefiProtocols = new DynamicStructuredTool({
  name: 'get_top_defi_protocols',
  description: `Get top DeFi protocols by Total Value Locked (TVL). Shows protocol name, TVL, chain, category, and TVL changes. Great for understanding where capital is deployed in DeFi.`,
  schema: z.object({
    limit: z.number().default(25).describe('Number of protocols to return'),
    chain: z.string().optional().describe('Filter by chain (e.g., "Ethereum", "Solana", "Arbitrum")'),
    category: z.string().optional().describe('Filter by category (e.g., "DEX", "Lending", "Bridge", "Liquid Staking")'),
  }),
  func: async (input) => {
    const { data, url } = await getDefiProtocols();
    const chainLower = input.chain?.toLowerCase();
    const catLower = input.category?.toLowerCase();

    // Chain filter → sort → slice → map in one pass to avoid holding intermediate large arrays
    const result = (data as any[])
      .filter((p: any) => {
        if (chainLower && !(p.chain?.toLowerCase() === chainLower || p.chains?.some((c: string) => c.toLowerCase() === chainLower))) return false;
        if (catLower && !p.category?.toLowerCase().includes(catLower)) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, input.limit)
      .map((p: any) => ({
        name: p.name,
        symbol: p.symbol,
        tvl: p.tvl,
        tvl_change_1d: p.change_1d != null ? p.change_1d.toFixed(2) + '%' : 'N/A',
        tvl_change_7d: p.change_7d != null ? p.change_7d.toFixed(2) + '%' : 'N/A',
        tvl_change_1m: p.change_1m != null ? p.change_1m.toFixed(2) + '%' : 'N/A',
        category: p.category,
        chains: p.chains?.slice(0, 5),
        slug: p.slug,
      }));

    return formatToolResult({ protocols: result, count: result.length }, [url]);
  },
});

export const getDefiProtocolDetail = new DynamicStructuredTool({
  name: 'get_defi_protocol_detail',
  description: `Get detailed information about a specific DeFi protocol including TVL history, chain breakdown, and token info. Use the protocol slug (e.g., "aave", "uniswap", "lido").`,
  schema: z.object({
    protocol: z.string().describe('Protocol slug/name (e.g., "aave", "uniswap", "lido", "makerdao")'),
  }),
  func: async (input) => {
    const { data, url } = await getProtocolTVL(input.protocol);
    const d = data as any;
    
    // Get TVL by chain
    const chainTvls: Record<string, number> = {};
    if (d.chainTvls) {
      for (const [chain, tvlData] of Object.entries(d.chainTvls)) {
        if (tvlData && typeof tvlData === 'object' && 'tvl' in tvlData && Array.isArray((tvlData as any).tvl)) {
          const arr = (tvlData as any).tvl;
          const latest = arr[arr.length - 1];
          chainTvls[chain] = latest?.totalLiquidityUSD || 0;
        } else if (Array.isArray(tvlData)) {
          const latest = tvlData[tvlData.length - 1];
          chainTvls[chain] = (latest as any)?.totalLiquidityUSD || 0;
        }
      }
    }
    
    // Get recent TVL history (last 30 data points)
    const tvlHistory = d.tvl?.slice(-30).map((point: any) => ({
      date: new Date(point.date * 1000).toISOString().split('T')[0],
      tvl: point.totalLiquidityUSD,
    })) || [];
    
    const result = {
      name: d.name,
      symbol: d.symbol,
      description: d.description?.slice(0, 500),
      category: d.category,
      chains: d.chains,
      current_tvl: d.tvl?.[d.tvl.length - 1]?.totalLiquidityUSD,
      tvl_by_chain: chainTvls,
      tvl_history_30d: tvlHistory,
      url: d.url,
      twitter: d.twitter,
      audit_links: d.audit_links,
      token: d.symbol,
      mcap_to_tvl: d.mcap && d.tvl?.[d.tvl.length - 1]?.totalLiquidityUSD 
        ? (d.mcap / d.tvl[d.tvl.length - 1].totalLiquidityUSD).toFixed(2)
        : null,
    };
    
    return formatToolResult(result, [url]);
  },
});

// ============================================================================
// Chain TVL
// ============================================================================

export const getChainTVLData = new DynamicStructuredTool({
  name: 'get_chain_tvl_data',
  description: `Get TVL (Total Value Locked) data for all blockchain networks. Shows which chains have the most DeFi activity and capital.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getChainsTVL();
    const chains = (data as any[])
      ?.sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 30)
      .map((c: any) => ({
        name: c.name,
        tvl: c.tvl,
        token_symbol: c.tokenSymbol,
        gecko_id: c.gecko_id,
      }));
    
    return formatToolResult({ chains, count: chains?.length || 0 }, [url]);
  },
});

export const getChainTVLTrend = new DynamicStructuredTool({
  name: 'get_chain_tvl_trend',
  description: `Get historical TVL trend for a specific blockchain. Shows how TVL has changed over time for chains like Ethereum, Solana, Arbitrum, etc.`,
  schema: z.object({
    chain: z.string().describe('Chain name (e.g., "Ethereum", "Solana", "Arbitrum", "BSC", "Polygon")'),
  }),
  func: async (input) => {
    const { data, url } = await getChainTVLHistory(input.chain);
    const history = (data as any[])?.slice(-90).map((point: any) => ({
      date: new Date(point.date * 1000).toISOString().split('T')[0],
      tvl: point.tvl,
    })) || [];
    
    const first = history[0]?.tvl || 0;
    const last = history[history.length - 1]?.tvl || 0;
    const change = first > 0 ? ((last - first) / first * 100).toFixed(2) + '%' : 'N/A';
    
    return formatToolResult({
      chain: input.chain,
      current_tvl: last,
      tvl_90d_ago: first,
      change_90d: change,
      history: history,
    }, [url]);
  },
});

// ============================================================================
// Yields & Pools
// ============================================================================

export const getDefiYields = new DynamicStructuredTool({
  name: 'get_defi_yields',
  description: `Get top DeFi yield opportunities (staking, lending, LPing). Shows APY, TVL, and risk metrics for yield farming pools across protocols and chains. Great for finding yield opportunities.`,
  schema: z.object({
    chain: z.string().optional().describe('Filter by chain (e.g., "Ethereum", "Arbitrum")'),
    project: z.string().optional().describe('Filter by protocol (e.g., "aave", "compound")'),
    min_tvl: z.number().optional().describe('Minimum TVL in USD'),
    stablecoin_only: z.boolean().default(false).describe('Only show stablecoin pools'),
    limit: z.number().default(20).describe('Number of pools to return'),
  }),
  func: async (input) => {
    const { data, url } = await getYieldPools();
    const chainLower = input.chain?.toLowerCase();
    const projLower = input.project?.toLowerCase();
    const minTvl = input.min_tvl;

    // Chain filter → sort → slice → map in one pass to avoid holding intermediate large arrays
    const result = ((data as any).data || [])
      .filter((p: any) => {
        if (chainLower && p.chain?.toLowerCase() !== chainLower) return false;
        if (projLower && !p.project?.toLowerCase().includes(projLower)) return false;
        if (minTvl != null && p.tvlUsd < minTvl) return false;
        if (input.stablecoin_only && p.stablecoin !== true) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0))
      .slice(0, input.limit)
      .map((p: any) => ({
        pool: p.pool,
        symbol: p.symbol,
        project: p.project,
        chain: p.chain,
        tvl_usd: p.tvlUsd,
        apy: p.apy != null ? p.apy.toFixed(2) + '%' : 'N/A',
        apy_base: p.apyBase != null ? p.apyBase.toFixed(2) + '%' : 'N/A',
        apy_reward: p.apyReward != null ? p.apyReward.toFixed(2) + '%' : 'N/A',
        stablecoin: p.stablecoin,
        il_risk: p.ilRisk,
      }));

    return formatToolResult({ pools: result, count: result.length }, [url]);
  },
});

// ============================================================================
// Stablecoins
// ============================================================================

export const getStablecoinData = new DynamicStructuredTool({
  name: 'get_stablecoin_data',
  description: `Get data on major stablecoins including market cap, peg status, and chain distribution. Includes USDT, USDC, DAI, FRAX, etc.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getStablecoins();
    const stables = (data as any).peggedAssets
      ?.sort((a: any, b: any) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0))
      .slice(0, 20)
      .map((s: any) => ({
        name: s.name,
        symbol: s.symbol,
        peg_type: s.pegType,
        peg_mechanism: s.pegMechanism,
        circulating: s.circulating?.peggedUSD,
        price: s.price,
        chains: Object.keys(s.chainCirculating || {}).slice(0, 5),
      }));
    
    return formatToolResult({ stablecoins: stables, count: stables?.length || 0 }, [url]);
  },
});

// ============================================================================
// DEX Volumes
// ============================================================================

export const getDexVolumeData = new DynamicStructuredTool({
  name: 'get_dex_volume_data',
  description: `Get DEX (Decentralized Exchange) trading volume data. Shows volume by protocol (Uniswap, Curve, etc.) and chain. Useful for understanding DEX activity and liquidity.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await getDexVolumes();
    const d = data as any;
    
    const protocols = d.protocols
      ?.sort((a: any, b: any) => (b.total24h || 0) - (a.total24h || 0))
      .slice(0, 20)
      .map((p: any) => ({
        name: p.name,
        volume_24h: p.total24h,
        volume_7d: p.total7d,
        volume_30d: p.total30d,
        change_24h: p.change_1d != null ? p.change_1d.toFixed(2) + '%' : 'N/A',
        chains: p.chains?.slice(0, 5),
      }));
    
    return formatToolResult({
      total_volume_24h: d.total24h,
      total_volume_7d: d.total7d,
      protocols: protocols,
    }, [url]);
  },
});

// ============================================================================
// Token On-Chain Metrics
// ============================================================================

export const compareDefiProtocols = new DynamicStructuredTool({
  name: 'compare_defi_protocols',
  description: `Compare multiple DeFi protocols side by side. Useful for analyzing competing protocols in the same category (e.g., comparing lending protocols like Aave vs Compound).`,
  schema: z.object({
    protocols: z.array(z.string()).describe('Array of protocol slugs to compare (e.g., ["aave", "compound", "maker"])'),
  }),
  func: async (input) => {
    const results = await Promise.all(
      input.protocols.slice(0, 5).map(async (protocol) => {
        try {
          const { data } = await getProtocolTVL(protocol);
          const d = data as any;
          return {
            name: d.name,
            symbol: d.symbol,
            category: d.category,
            chains: d.chains?.length || 0,
            current_tvl: d.tvl?.[d.tvl.length - 1]?.totalLiquidityUSD || 0,
            tvl_30d_ago: d.tvl?.[Math.max(0, d.tvl.length - 30)]?.totalLiquidityUSD || 0,
          };
        } catch {
          return { name: protocol, error: 'Failed to fetch data' };
        }
      })
    );
    
    // Calculate changes
    const comparison = results.map((r: any) => ({
      ...r,
      tvl_change_30d: r.tvl_30d_ago > 0 
        ? ((r.current_tvl - r.tvl_30d_ago) / r.tvl_30d_ago * 100).toFixed(2) + '%'
        : 'N/A',
    }));
    
    return formatToolResult({ comparison }, ['https://api.llama.fi']);
  },
});

