import api from './client';
import type {
  KnowledgeRecommendationRequest,
  KnowledgeRecommendationResult,
} from '../types';

export const knowledgeApi = {
  /**
   * Retrieves ranked knowledge recommendations from ChromaDB.
   */
  getRecommendations: (payload: KnowledgeRecommendationRequest) => {
    return api.post<KnowledgeRecommendationResult>('/knowledge/recommend', payload);
  },
};
