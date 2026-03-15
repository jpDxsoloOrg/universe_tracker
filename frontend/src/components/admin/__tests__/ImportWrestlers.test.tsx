import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Hoisted mocks ---
const { mockWrestlersApi, mockCompaniesApi } = vi.hoisted(() => ({
  mockWrestlersApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkImport: vi.fn(),
  },
  mockCompaniesApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../../services/api', () => ({
  wrestlersApi: mockWrestlersApi,
  companiesApi: mockCompaniesApi,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../ImportWrestlers.css', () => ({}));

import ImportWrestlers from '../ImportWrestlers';
import type { Company } from '../../../types';

const mockCompanies: Company[] = [
  {
    companyId: 'comp-1',
    name: 'WWE',
    abbreviation: 'WWE',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const jsonFileContent = JSON.stringify([
  { name: 'Stone Cold Steve Austin', nickname: 'The Rattlesnake', alignment: 'tweener' },
  { name: 'The Rock', nickname: 'The Great One', alignment: 'face' },
]);

function createMockFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe('ImportWrestlers', () => {
  const onImportComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompaniesApi.getAll.mockResolvedValue(mockCompanies);
  });

  it('renders file upload input and template download link', async () => {
    render(<ImportWrestlers onImportComplete={onImportComplete} />);

    await waitFor(() => {
      expect(mockCompaniesApi.getAll).toHaveBeenCalled();
    });

    expect(screen.getByLabelText('wrestlers.import.selectFile')).toBeInTheDocument();
    const downloadLink = screen.getByText('wrestlers.import.downloadTemplate');
    expect(downloadLink.getAttribute('href')).toBe('/templates/wrestler-import-template.csv');
    expect(downloadLink.getAttribute('download')).toBeDefined();
  });

  it('calls companiesApi.getAll on mount', () => {
    render(<ImportWrestlers onImportComplete={onImportComplete} />);
    expect(mockCompaniesApi.getAll).toHaveBeenCalledTimes(1);
  });

  it('shows preview table after selecting a JSON file', async () => {
    const user = userEvent.setup();
    render(<ImportWrestlers onImportComplete={onImportComplete} />);

    await waitFor(() => {
      expect(mockCompaniesApi.getAll).toHaveBeenCalled();
    });

    const fileInput = screen.getByLabelText('wrestlers.import.selectFile');
    const file = createMockFile(jsonFileContent, 'wrestlers.json', 'application/json');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('wrestlers.import.preview (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Stone Cold Steve Austin')).toBeInTheDocument();
    expect(screen.getByText('The Rock')).toBeInTheDocument();
    expect(screen.getByText('The Rattlesnake')).toBeInTheDocument();
    expect(screen.getByText('The Great One')).toBeInTheDocument();
  });

  it('shows import results after successful import', async () => {
    const user = userEvent.setup();
    mockWrestlersApi.bulkImport.mockResolvedValue({
      imported: 2,
      failed: 0,
      total: 2,
      errors: [],
    });

    render(<ImportWrestlers onImportComplete={onImportComplete} />);

    await waitFor(() => {
      expect(mockCompaniesApi.getAll).toHaveBeenCalled();
    });

    const fileInput = screen.getByLabelText('wrestlers.import.selectFile');
    const file = createMockFile(jsonFileContent, 'wrestlers.json', 'application/json');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('wrestlers.import.preview (2)')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'wrestlers.import.importButton' }));

    await waitFor(() => {
      expect(screen.getByText('wrestlers.import.results')).toBeInTheDocument();
    });

    expect(screen.getByText(/wrestlers\.import\.imported.*2/)).toBeTruthy();
    expect(onImportComplete).toHaveBeenCalled();
  });

  it('disables import button when no wrestlers are parsed', async () => {
    render(<ImportWrestlers onImportComplete={onImportComplete} />);

    await waitFor(() => {
      expect(mockCompaniesApi.getAll).toHaveBeenCalled();
    });

    // No import button should be visible when no file is loaded
    expect(screen.queryByRole('button', { name: 'wrestlers.import.importButton' })).not.toBeInTheDocument();
  });
});
