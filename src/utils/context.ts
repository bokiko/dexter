import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, readdir, stat, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { DEFAULT_MODEL } from '../model/llm.js';

/**
 * Lightweight summary of a tool call result (kept in context during loop).
 * Defined here to avoid a circular dependency with the agent layer.
 */
export interface ToolSummary {
  id: string;           // Filepath pointer to full data on disk
  toolName: string;
  args: Record<string, unknown>;
  summary: string;      // Deterministic description
}

interface ContextPointer {
  filepath: string;
  filename: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
}

interface ContextData {
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  timestamp: string;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
  result: unknown;
}

const CONTEXT_CACHE_MAX = 100;

export class ToolContextManager {
  private contextDir: string;
  private pointersByQuery = new Map<string, ContextPointer[]>();
  private contextCache = new Map<string, ContextData>();

  constructor(contextDir: string = '.dexter/context') {
    this.contextDir = contextDir;
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true, mode: 0o700 });
    }
    void this.cleanupOldContexts();
  }

  /**
   * Deletes context files older than the given TTL (default: 24 hours).
   * Called at startup (fire-and-forget) to prevent unbounded disk growth.
   */
  async cleanupOldContexts(ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    try {
      const files = await readdir(this.contextDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filepath = join(this.contextDir, file);
        try {
          const fileStat = await stat(filepath);
          if (now - fileStat.mtimeMs > ttlMs) {
            await unlink(filepath);
          }
        } catch {
          // Ignore individual file errors
        }
      }
    } catch {
      // Ignore errors if directory cannot be read
    }
  }

  private hashArgs(args: Record<string, unknown>): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return createHash('sha256').update(argsStr).digest('hex').slice(0, 16);
  }

  hashQuery(query: string): string {
    return createHash('sha256').update(query).digest('hex').slice(0, 16);
  }

  private generateFilename(toolName: string, args: Record<string, unknown>): string {
    // Sanitize to strip any path separator characters before constructing filename
    const safeName = toolName.replace(/[\\/]/g, '_');
    const argsHash = this.hashArgs(args);
    const rawTicker = typeof args.ticker === 'string' ? args.ticker : null;
    const ticker = rawTicker ? rawTicker.replace(/[\\/]/g, '_').toUpperCase() : null;
    const filename = ticker
      ? `${ticker}_${safeName}_${argsHash}.json`
      : `${safeName}_${argsHash}.json`;

    // Verify the resolved path stays within contextDir (defence against traversal)
    const resolvedDir = resolve(this.contextDir);
    const resolvedPath = resolve(join(this.contextDir, filename));
    if (!resolvedPath.startsWith(resolvedDir + '/') && resolvedPath !== resolvedDir) {
      throw new Error(`Path traversal detected: generated filename escapes context directory`);
    }
    return filename;
  }

  /**
   * Creates a simple description string for the tool using the tool name and arguments.
   * The description string is used to identify the tool and is used to select relevant context for the query.
   */
  getToolDescription(toolName: string, args: Record<string, unknown>): string {
    const parts: string[] = [];
    const usedKeys = new Set<string>();

    // Add ticker if present (most common identifier)
    if (args.ticker) {
      parts.push(String(args.ticker).toUpperCase());
      usedKeys.add('ticker');
    }

    // Add search query if present
    if (args.query) {
      parts.push(`"${args.query}"`);
      usedKeys.add('query');
    }

    // Format tool name: get_income_statements -> income statements
    const formattedToolName = toolName
      .replace(/^get_/, '')
      .replace(/^search_/, '')
      .replace(/_/g, ' ');
    parts.push(formattedToolName);

    // Add period qualifier if present
    if (args.period) {
      parts.push(`(${args.period})`);
      usedKeys.add('period');
    }

    // Add limit if present
    if (args.limit && typeof args.limit === 'number') {
      parts.push(`- ${args.limit} periods`);
      usedKeys.add('limit');
    }

    // Add date range if present
    if (args.start_date && args.end_date) {
      parts.push(`from ${args.start_date} to ${args.end_date}`);
      usedKeys.add('start_date');
      usedKeys.add('end_date');
    }

    // Append any remaining args not explicitly handled
    const remainingArgs = Object.entries(args)
      .filter(([key]) => !usedKeys.has(key))
      .map(([key, value]) => `${key}=${value}`);

    if (remainingArgs.length > 0) {
      parts.push(`[${remainingArgs.join(', ')}]`);
    }

    return parts.join(' ');
  }

  async saveContext(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    taskId?: number,
    queryId?: string
  ): Promise<string> {
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);

    const toolDescription = this.getToolDescription(toolName, args);

    // Extract sourceUrls from ToolResult format
    let sourceUrls: string[] | undefined;
    let actualResult = result;

    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed.data !== undefined) {
          sourceUrls = parsed.sourceUrls;
          actualResult = parsed.data;
        }
      } catch {
        // Result is not JSON, use as-is
      }
    }

    const contextData: ContextData = {
      toolName: toolName,
      args: args,
      toolDescription: toolDescription,
      timestamp: new Date().toISOString(),
      taskId: taskId,
      queryId: queryId,
      sourceUrls: sourceUrls,
      result: actualResult,
    };

    await writeFile(filepath, JSON.stringify(contextData, null, 2), { mode: 0o600 });

    // Populate in-memory cache to avoid redundant disk reads (PERF-003)
    // Use resolve() so the key matches what loadContexts uses (BUG-004)
    this.contextCache.set(resolve(filepath), contextData);
    if (this.contextCache.size > CONTEXT_CACHE_MAX) {
      const firstKey = this.contextCache.keys().next().value;
      if (firstKey) this.contextCache.delete(firstKey);
    }

    const pointer: ContextPointer = {
      filepath,
      filename,
      toolName,
      args,
      toolDescription,
      taskId,
      queryId,
      sourceUrls,
    };

    const queryKey = queryId ?? '';
    const bucket = this.pointersByQuery.get(queryKey) ?? [];
    bucket.push(pointer);
    this.pointersByQuery.set(queryKey, bucket);

    return filepath;
  }

  /**
   * Saves context to disk and returns a lightweight ToolSummary for the agent loop.
   * Combines saveContext + deterministic summary generation in one call.
   */
  async saveAndGetSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    queryId?: string
  ): Promise<ToolSummary> {
    const filepath = await this.saveContext(toolName, args, result, undefined, queryId);
    const summary = this.getToolDescription(toolName, args);

    return {
      id: filepath,
      toolName,
      args,
      summary,
    };
  }

  getAllPointers(): ContextPointer[] {
    const all: ContextPointer[] = [];
    for (const bucket of this.pointersByQuery.values()) {
      all.push(...bucket);
    }
    return all;
  }

  getPointersForQuery(queryId: string): ContextPointer[] {
    return this.pointersByQuery.get(queryId) ?? [];
  }

  async loadContexts(filepaths: string[]): Promise<ContextData[]> {
    const resolvedDir = resolve(this.contextDir);
    const results = await Promise.all(
      filepaths.map(async (filepath) => {
        // SEC-002: Validate each filepath stays within the context directory
        const resolvedPath = resolve(filepath);
        if (!resolvedPath.startsWith(resolvedDir + '/') && resolvedPath !== resolvedDir) {
          console.warn(`Warning: Rejected context file outside context directory: ${filepath}`);
          return null;
        }

        // PERF-003: Check in-memory cache before hitting disk
        const cached = this.contextCache.get(resolvedPath);
        if (cached) return cached;

        try {
          const content = await readFile(resolvedPath, 'utf-8');
          const parsed = JSON.parse(content) as ContextData;
          this.contextCache.set(resolvedPath, parsed);
          if (this.contextCache.size > CONTEXT_CACHE_MAX) {
            const firstKey = this.contextCache.keys().next().value;
            if (firstKey) this.contextCache.delete(firstKey);
          }
          return parsed;
        } catch (e) {
          console.warn(`Warning: Failed to load context file ${filepath}: ${e}`);
          return null;
        }
      })
    );
    return results.filter((ctx: ContextData | null): ctx is ContextData => ctx !== null);
  }

}

