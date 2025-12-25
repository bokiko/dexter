import { z } from 'zod';

// ============================================================================
// Understand Phase Schema
// ============================================================================

/**
 * Schema for entity extraction.
 * Extended to support both traditional finance and crypto entities.
 */
export const EntitySchema = z.object({
  type: z.enum([
    // Traditional finance
    'ticker',      // Stock ticker (AAPL, MSFT)
    'company',     // Company name
    'date',        // Specific date
    'period',      // Time period (Q1 2024, last year)
    'metric',      // Financial metric (P/E, revenue)
    // Crypto entities
    'token',       // Crypto token (bitcoin, ethereum, solana)
    'protocol',    // DeFi protocol (aave, uniswap, lido)
    'chain',       // Blockchain (Ethereum, Solana, Arbitrum)
    'category',    // Crypto category (DEX, lending, L2)
    // Generic
    'other',
  ]).describe('The type of entity'),
  value: z.string()
    .describe('The raw value from the query'),
  normalized: z.string().optional()
    .describe('Normalized form (e.g., "Bitcoin" → "bitcoin", "Apple" → "AAPL")'),
});

/**
 * Schema for the Understanding phase output.
 * Now includes domain classification for routing.
 */
export const UnderstandingSchema = z.object({
  intent: z.string()
    .describe('A clear statement of what the user wants to accomplish'),
  entities: z.array(EntitySchema)
    .describe('Key entities extracted from the query'),
  domain: z.enum(['stocks', 'crypto', 'defi', 'mixed']).optional()
    .describe('Primary domain of the query'),
});

export type UnderstandingOutput = z.infer<typeof UnderstandingSchema>;

// ============================================================================
// Plan Phase Schema
// ============================================================================

/**
 * Schema for a task in the plan.
 * Includes taskType and dependencies - tool selection happens at execution time.
 */
export const PlanTaskSchema = z.object({
  id: z.string()
    .describe('Unique identifier (e.g., "task_1")'),
  description: z.string()
    .describe('SHORT task description - must be under 10 words'),
  taskType: z.enum(['use_tools', 'reason'])
    .describe('use_tools = needs tools to fetch data, reason = LLM analysis only'),
  dependsOn: z.array(z.string())
    .describe('IDs of tasks that must complete before this one'),
});

/**
 * Schema for the Plan output.
 */
export const PlanSchema = z.object({
  summary: z.string()
    .describe('One sentence summary under 15 words'),
  tasks: z.array(PlanTaskSchema)
    .describe('2-5 tasks with short descriptions'),
});

export type PlanOutput = z.infer<typeof PlanSchema>;

// ============================================================================
// Context Selection Schema
// ============================================================================

export const SelectedContextsSchema = z.object({
  context_ids: z.array(z.number())
    .describe('List of context pointer IDs (0-indexed) that are relevant'),
});

export type SelectedContextsOutput = z.infer<typeof SelectedContextsSchema>;

// ============================================================================
// Tool Summary Type (used by context manager)
// ============================================================================

/**
 * Lightweight summary of a tool call result (kept in context during loop)
 */
export interface ToolSummary {
  id: string;           // Filepath pointer to full data on disk
  toolName: string;
  args: Record<string, unknown>;
  summary: string;      // Deterministic description
}
