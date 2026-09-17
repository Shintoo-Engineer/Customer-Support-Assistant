import api from './client';
import type { SearchResponse, RAGResponse } from '../types';

export const searchApi = {
  /**
   * Executes semantic vector search against ChromaDB chunks (Task 2).
   */
  semanticSearch: (query: string, numberOfResults = 3) => {
    return api.post<SearchResponse>('/search/', {
      query,
      number_of_results: numberOfResults,
    });
  },

  /**
   * Generates RAG answer using retrieved chunks (Task 2).
   */
  askRAG: (question: string, numberOfResults = 3) => {
    return api.post<RAGResponse>('/rag/ask', {
      question,
      number_of_results: numberOfResults,
    });
  },
};
