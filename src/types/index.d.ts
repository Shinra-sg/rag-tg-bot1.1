// Общие типы для RAG Bot

declare module '../utils/hybridSearch' {
  export interface SearchResult {
    content: string;
    filename: string;
    source_ref: string;
    score: number;
    search_type: 'vector' | 'keyword' | 'hybrid';
  }

  export interface HybridSearchOptions {
    vectorWeight?: number;
    keywordWeight?: number;
    maxResults?: number;
    minScore?: number;
  }

  export function hybridSearch(query: string, options?: HybridSearchOptions): Promise<SearchResult[]>;
  export function smartSearch(query: string): Promise<SearchResult[]>;
  export function searchWithFilters(query: string, filters?: any): Promise<SearchResult[]>;
}

declare module '../utils/analytics' {
  export interface SearchAnalytics {
    totalSearches: number;
    successfulSearches: number;
    averageResponseTime: number;
    popularQueries: Array<{
      query: string;
      count: number;
      lastUsed: Date;
    }>;
    searchTypes: {
      vector: number;
      keyword: number;
      hybrid: number;
    };
  }

  export interface UserAnalytics {
    userId: number;
    username?: string;
    totalSearches: number;
    lastSearch: Date;
    favoriteQueries: string[];
  }

  export function setupAnalyticsTables(): Promise<void>;
  export function logSearch(
    userId: number,
    username: string | undefined,
    query: string,
    searchType: 'vector' | 'keyword' | 'hybrid',
    resultsCount: number,
    responseTimeMs: number,
    success?: boolean
  ): Promise<void>;
  export function getSearchAnalytics(days?: number): Promise<SearchAnalytics>;
  export function getUserAnalytics(userId: number): Promise<UserAnalytics | null>;
  export function addToFavorites(userId: number, query: string): Promise<boolean>;
  export function removeFromFavorites(userId: number, query: string): Promise<boolean>;
  export function getUserSearchHistory(userId: number, limit?: number): Promise<Array<{
    query: string;
    resultsCount: number;
    searchType: string;
    createdAt: Date;
  }>>;
  export function getPopularQueries(limit?: number): Promise<Array<{
    query: string;
    count: number;
    lastUsed: Date;
  }>>;
}

declare module '../utils/cleanup' {
  export function performFullCleanup(): Promise<{
    success: boolean;
    results: any;
    totalDeleted: number;
    message: string;
  }>;
  export function getDatabaseStats(): Promise<{
    searchLogs: number;
    userHistory: number;
    documentAccess: number;
    popularQueries: number;
    userFavorites: number;
    totalSize: string;
  }>;
}

declare module '../utils/documentParsers' {
  export interface ParsedDocument {
    content: string;
    metadata: {
      title?: string;
      author?: string;
      pages?: number;
      created?: Date;
      modified?: Date;
    };
  }

  export function parseDocument(filePath: string): Promise<ParsedDocument>;
  export function getSupportedFormats(): string[];
  export function isSupportedFormat(filePath: string): boolean;
} 