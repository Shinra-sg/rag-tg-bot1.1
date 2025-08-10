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