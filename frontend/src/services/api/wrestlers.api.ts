import type { Wrestler } from '../../types';
import { API_BASE_URL, fetchWithAuth } from './apiClient';

export interface BulkImportResponse {
  imported: number;
  failed: number;
  skipped: number;
  total: number;
  errors: Array<{ index: number; name: string; reason: string }>;
}

export const wrestlersApi = {
  getAll: async (signal?: AbortSignal): Promise<Wrestler[]> => {
    return fetchWithAuth(`${API_BASE_URL}/wrestlers`, {}, signal);
  },

  create: async (wrestler: Omit<Wrestler, 'wrestlerId' | 'createdAt' | 'updatedAt'>): Promise<Wrestler> => {
    return fetchWithAuth(`${API_BASE_URL}/wrestlers`, {
      method: 'POST',
      body: JSON.stringify(wrestler),
    });
  },

  update: async (wrestlerId: string, updates: Partial<Wrestler>): Promise<Wrestler> => {
    return fetchWithAuth(`${API_BASE_URL}/wrestlers/${wrestlerId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  delete: async (wrestlerId: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/wrestlers/${wrestlerId}`, {
      method: 'DELETE',
    });
  },

  bulkImport: async (wrestlers: Partial<Wrestler>[], companyId?: string, signal?: AbortSignal): Promise<BulkImportResponse> => {
    return fetchWithAuth(`${API_BASE_URL}/wrestlers/import`, {
      method: 'POST',
      body: JSON.stringify({ wrestlers, ...(companyId ? { companyId } : {}) }),
    }, signal);
  },
};
