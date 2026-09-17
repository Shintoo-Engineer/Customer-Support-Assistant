import api from './client';

export interface ChatMessageItem {
  id: number;
  user_message: string;
  assistant_message: string;
  created_at: string;
}

export interface ChatMessageResponse {
  session_id: string;
  response: string;
  sources?: any[];
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatMessageItem[];
}

export const chatApi = {
  /**
   * Send a chat message to the standalone RAG knowledge assistant
   */
  sendMessage: (sessionId: string, message: string, numberOfResults = 3) => {
    return api.post<ChatMessageResponse>('/chat/message', {
      session_id: sessionId,
      message,
      number_of_results: numberOfResults,
    });
  },

  /**
   * Retrieve conversation history for a chat session
   */
  getHistory: (sessionId: string) => {
    return api.get<ChatHistoryResponse>(`/chat/${encodeURIComponent(sessionId)}/history`);
  },
};
