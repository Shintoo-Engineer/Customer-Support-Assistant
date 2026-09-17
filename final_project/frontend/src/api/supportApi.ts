import api from './client';
import type {
  SupportTurnRequest,
  IntegratedTurnResponse,
  SupportTicketResponse,
} from '../types';

export const supportApi = {
  /**
   * Dedicated Task 5 Phase 3 full conversation orchestration turn.
   * Advances turn, executes Task 4 analysis, and retrieves context-aware Task 5 recommendations.
   */
  processTurn: (payload: SupportTurnRequest) => {
    return api.post<IntegratedTurnResponse>('/support/turn', payload);
  },

  /**
   * Submit a quick live support request ticket.
   */
  submitLiveSupport: (issueType: string, message: string) => {
    return api.post<SupportTicketResponse>('/support/', {
      issue_type: issueType,
      message,
    });
  },
};
