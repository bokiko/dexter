import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

export const tavilySearch = new DynamicStructuredTool({
  name: 'search_web',
  description: 'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    if (!process.env.TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY is not set. Add it to your .env file to use web search.');
    }
    const client = new TavilySearch({ maxResults: 5 });
    const result = await client.invoke({ query: input.query });
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    const urls = parsed.results
      ?.map((r: { url?: string }) => r.url)
      .filter((url: string | undefined): url is string => Boolean(url)) ?? [];
    return formatToolResult(parsed, urls);
  },
});
