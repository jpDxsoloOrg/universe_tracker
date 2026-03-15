import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// --- Hoisted mocks ---
const { mockDraftsApi, mockCompaniesApi, mockWrestlersApi } = vi.hoisted(() => ({
  mockDraftsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    start: vi.fn(),
    makePick: vi.fn(),
    protect: vi.fn(),
    complete: vi.fn(),
  },
  mockCompaniesApi: {
    getAll: vi.fn(),
  },
  mockWrestlersApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../../services/api', () => ({
  draftsApi: mockDraftsApi,
  companiesApi: mockCompaniesApi,
  wrestlersApi: mockWrestlersApi,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key} ${JSON.stringify(opts)}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

import ManageDrafts from '../ManageDrafts';
import type { Draft, Company } from '../../../types';

// --- Test data ---
const mockDrafts: Draft[] = [
  {
    draftId: 'd1',
    name: 'Test Draft',
    type: 'global',
    status: 'setup',
    participatingCompanyIds: ['c1', 'c2'],
    rounds: 3,
    currentRound: 0,
    currentPickIndex: 0,
    draftOrder: ['c1', 'c2'],
    snakeOrder: true,
    protectedPicksPerCompany: 0,
    includeGlobalPool: true,
    picks: [],
    protections: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockCompanies: Company[] = [
  { companyId: 'c1', name: 'WWF', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { companyId: 'c2', name: 'WCW', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

describe('ManageDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftsApi.getAll.mockResolvedValue(mockDrafts);
    mockCompaniesApi.getAll.mockResolvedValue(mockCompanies);
    mockWrestlersApi.getAll.mockResolvedValue([]);
  });

  it('calls draftsApi.getAll and companiesApi.getAll on mount', async () => {
    render(<ManageDrafts />);
    await waitFor(() => {
      expect(mockDraftsApi.getAll).toHaveBeenCalled();
    });
    expect(mockCompaniesApi.getAll).toHaveBeenCalled();
  });

  it('renders the drafts title after loading', async () => {
    render(<ManageDrafts />);
    await waitFor(() => {
      expect(screen.getByText('drafts.title')).toBeInTheDocument();
    });
  });

  it('renders the manage-drafts container', async () => {
    const { container } = render(<ManageDrafts />);
    await waitFor(() => {
      expect(container.querySelector('.manage-drafts')).toBeInTheDocument();
    });
  });

  it('shows no drafts message when list is empty', async () => {
    mockDraftsApi.getAll.mockResolvedValue([]);
    render(<ManageDrafts />);
    await waitFor(() => {
      expect(screen.getByText('drafts.noDrafts')).toBeInTheDocument();
    });
  });

  it('shows draft name in list after loading', async () => {
    render(<ManageDrafts />);
    await waitFor(() => {
      expect(screen.getByText('Test Draft')).toBeInTheDocument();
    });
  });
});
