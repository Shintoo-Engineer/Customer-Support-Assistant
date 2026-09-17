import api from './client';

export interface DocumentItem {
  document_id: number;
  document_name: string;
  document_type: 'policy' | 'faq' | 'support' | string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export interface DocumentListResponse {
  total_documents: number;
  documents: DocumentItem[];
}

export interface DocumentHistoryResponse {
  document_name: string;
  total_versions: number;
  versions: DocumentItem[];
}

export const documentsApi = {
  /**
   * Get all uploaded documents (Admin/Support access required)
   */
  getAllDocuments: () => {
    return api.get<DocumentListResponse>('/documents/');
  },

  /**
   * Get version history of a specific document
   */
  getDocumentHistory: (documentName: string) => {
    return api.get<DocumentHistoryResponse>(`/documents/history/${encodeURIComponent(documentName)}`);
  },

  /**
   * Upload a new PDF document into SQLite and ChromaDB (Admin only)
   */
  uploadDocument: (file: File, documentName: string, documentType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_name', documentName);
    formData.append('document_type', documentType);

    return api.post<{ message: string; document: DocumentItem }>('/documents/upload', formData);
  },
};
