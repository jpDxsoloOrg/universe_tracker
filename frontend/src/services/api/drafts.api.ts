import { API_BASE_URL, fetchWithAuth } from './apiClient';
import type { Draft, DraftPick } from '../../types';

export const draftsApi = {
  getAll: async (signal?: AbortSignal): Promise<Draft[]> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts`, {}, signal);
  },

  getById: async (draftId: string, signal?: AbortSignal): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {}, signal);
  },

  create: async (data: {
    name: string;
    type: 'global' | 'inter-company';
    participatingCompanyIds: string[];
    rounds: number;
    snakeOrder?: boolean;
    draftOrder?: string[];
    protectedPicksPerCompany?: number;
    includeGlobalPool?: boolean;
  }): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (draftId: string, data: Record<string, unknown>): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (draftId: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}`, {
      method: 'DELETE',
    });
  },

  start: async (draftId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/start`, {
      method: 'POST',
    });
  },

  makePick: async (draftId: string, companyId: string, wrestlerId: string): Promise<{ pick: DraftPick; draft: Draft }> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/pick`, {
      method: 'POST',
      body: JSON.stringify({ companyId, wrestlerId }),
    });
  },

  protect: async (draftId: string, companyId: string, wrestlerId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/protect`, {
      method: 'POST',
      body: JSON.stringify({ companyId, wrestlerId }),
    });
  },

  complete: async (draftId: string): Promise<Draft> => {
    return fetchWithAuth(`${API_BASE_URL}/drafts/${draftId}/complete`, {
      method: 'POST',
    });
  },
};
