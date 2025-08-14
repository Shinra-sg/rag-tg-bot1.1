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
  export function isImageFile(filePath: string): boolean;
}

declare module '../utils/ocrParser' {
  export interface OCRResult {
    success: boolean;
    text?: string;
    method?: string;
    error?: string;
    metadata?: {
      image_size?: [number, number];
      image_mode?: string;
      image_format?: string;
      detected_blocks?: number;
      confidence_scores?: number[];
    };
  }
  
  export interface ParsedImageDocument {
    content: string;
    metadata: {
      filename: string;
      original_filename: string;
      file_size: number;
      image_size?: [number, number];
      ocr_method: string;
      confidence_score?: number;
      processing_date: string;
    };
  }
  
  export function extractTextFromImage(imagePath: string): Promise<OCRResult>;
  export function parseImageDocument(imagePath: string, originalFilename: string): Promise<ParsedImageDocument | null>;
  export function isSupportedImageFormat(filename: string): boolean;
  export function getSupportedImageFormats(): string[];
  export function saveOCRResultToFile(parsedDocument: ParsedImageDocument, outputDir: string): string;
}

declare module '../utils/documentDownload' {
  export interface DocumentInfo {
    id: number;
    filename: string;
    original_name: string;
    type: string;
    uploaded_at: Date;
    category?: string;
  }
  
  export function getDocumentById(documentId: number): Promise<DocumentInfo | null>;
  export function getDocumentByOriginalName(originalName: string): Promise<DocumentInfo | null>;
  export function documentFileExists(documentInfo: DocumentInfo): boolean;
  export function getDocumentFileSize(documentInfo: DocumentInfo): number;
  export function formatFileSize(bytes: number): string;
  export function getMimeType(filename: string): string;
  export function createDownloadableCopy(documentInfo: DocumentInfo): string | null;
  export function cleanupTempFiles(): void;
} 