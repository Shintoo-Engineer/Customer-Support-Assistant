import api from './client';
import type {
  SimulatorStartRequest,
  SimulatorMessageRequest,
  IntegratedTurnResponse,
  SimulatorHistoryResponse,
} from '../types';

export const simulatorApi = {
  /**
   * Initializes a new simulator session (Turn 1).
   * Generates customer opening message, executes Task 4 analysis, and retrieves Task 5 recommendations.
   */
  startSession: (payload: SimulatorStartRequest) => {
    return api.post<IntegratedTurnResponse>('/simulator/start', payload);
  },

  /**
   * Sends support agent response to advance simulation turn.
   */
  sendMessage: (payload: SimulatorMessageRequest) => {
    return api.post<IntegratedTurnResponse>('/simulator/message', payload);
  },

  /**
   * Retrieves clean dialogue history for a session (excluding internal System rows).
   */
  getHistory: (sessionId: number) => {
    return api.get<SimulatorHistoryResponse>(`/simulator/${sessionId}/history`);
  },
};
