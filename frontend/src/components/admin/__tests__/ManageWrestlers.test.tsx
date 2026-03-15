import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// --- Hoisted mocks ---
const { mockWrestlersApi, mockDivisionsApi, mockImagesApi } = vi.hoisted(() => ({
  mockWrestlersApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockDivisionsApi: { getAll: vi.fn() },
  mockImagesApi: { generateUploadUrl: vi.fn(), uploadToS3: vi.fn() },
}));

vi.mock('../../../services/api', () => ({
  wrestlersApi: mockWrestlersApi,
  divisionsApi: mockDivisionsApi,
  imagesApi: mockImagesApi,
  companiesApi: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

import ManageWrestlers from '../ManageWrestlers';
import type { Wrestler, Division } from '../../../types';

// --- Test data ---
const mockDivisions: Division[] = [
  { divisionId: 'div-1', name: 'Raw', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { divisionId: 'div-2', name: 'SmackDown', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

const mockWrestlers: Wrestler[] = [
  {
    wrestlerId: 'p1', name: 'John',
    wins: 10, losses: 3, draws: 1, divisionId: 'div-1',
    imageUrl: 'https://img.example.com/rock.png',
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
  },
  {
    wrestlerId: 'p2', name: 'Jane',
    wins: 8, losses: 5, draws: 0, userId: 'user-abc',
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
  },
];

function renderComponent() {
  return render(<BrowserRouter><ManageWrestlers /></BrowserRouter>);
}

describe('ManageWrestlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWrestlersApi.getAll.mockResolvedValue(mockWrestlers);
    mockDivisionsApi.getAll.mockResolvedValue(mockDivisions);
  });

  it('shows loading state during initial fetch', () => {
    mockWrestlersApi.getAll.mockReturnValue(new Promise(() => {}));
    mockDivisionsApi.getAll.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByText('Loading wrestlers...')).toBeInTheDocument();
  });

  it('renders wrestler list from API after loading', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('All Wrestlers (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('10W - 3L - 1D')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    mockWrestlersApi.getAll.mockRejectedValue(new Error('Network error'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  it('does not show wrestler form initially', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('All Wrestlers (2)')).toBeInTheDocument();
    });
    // Form is hidden until triggered via Edit button
    expect(screen.queryByText('Add New Wrestler')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Wrestler')).not.toBeInTheDocument();
  });

  it('opens edit form pre-populated with wrestler data', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Wrestler')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
  });

  it('edits existing wrestler and saves changes via API', async () => {
    const user = userEvent.setup();
    const updatedWrestler = { ...mockWrestlers[0], name: 'John Updated' };
    mockWrestlersApi.update.mockResolvedValue(updatedWrestler);

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    // Open edit form
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    // Verify pre-populated and modify
    const nameInput = screen.getByLabelText('Wrestler Name');
    expect(nameInput).toHaveValue('John');

    await user.clear(nameInput);
    await user.type(nameInput, 'John Updated');

    await user.click(screen.getByRole('button', { name: 'Update Wrestler' }));

    await waitFor(() => {
      expect(mockWrestlersApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({
        name: 'John Updated',
      }));
    });
    await waitFor(() => {
      expect(screen.getByText('Wrestler updated successfully!')).toBeInTheDocument();
    });
  });

  it('deletes wrestler with confirmation dialog', async () => {
    const user = userEvent.setup();
    mockWrestlersApi.delete.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete John? This action cannot be undone.'
    );
    await waitFor(() => {
      expect(mockWrestlersApi.delete).toHaveBeenCalledWith('p1');
    });
    await waitFor(() => {
      expect(screen.getByText('Wrestler deleted successfully!')).toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  it('does not delete wrestler when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockWrestlersApi.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('handles image upload via presigned URL and S3', async () => {
    const user = userEvent.setup();
    mockImagesApi.generateUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      imageUrl: 'https://cdn.example.com/wrestlers/test.png',
      fileKey: 'wrestlers/test.png',
    });
    mockImagesApi.uploadToS3.mockResolvedValue(undefined);
    mockWrestlersApi.update.mockResolvedValue({
      ...mockWrestlers[0], imageUrl: 'https://cdn.example.com/wrestlers/test.png',
    });

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    // Open edit form for wrestler that already has an image
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    // Remove existing image to reveal the file input
    await user.click(screen.getByRole('button', { name: 'Remove Image' }));

    // Upload a new file
    const fileInput = screen.getByLabelText('Click to upload image') as HTMLInputElement;
    const file = new File(['(png content)'], 'test.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    // Submit and verify the two-step upload (presigned URL then S3 PUT)
    await user.click(screen.getByRole('button', { name: 'Update Wrestler' }));

    await waitFor(() => {
      expect(mockImagesApi.generateUploadUrl).toHaveBeenCalledWith('test.png', 'image/png', 'wrestlers');
    });
    await waitFor(() => {
      expect(mockImagesApi.uploadToS3).toHaveBeenCalledWith('https://s3.example.com/presigned', file);
    });
    await waitFor(() => {
      expect(mockWrestlersApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({
        imageUrl: 'https://cdn.example.com/wrestlers/test.png',
      }));
    });
  });

  it('shows success message after edit and reloads data', async () => {
    const user = userEvent.setup();
    mockWrestlersApi.update.mockResolvedValue({ ...mockWrestlers[0], name: 'Updated' });

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    await user.click(screen.getByRole('button', { name: 'Update Wrestler' }));

    await waitFor(() => {
      expect(screen.getByText('Wrestler updated successfully!')).toBeInTheDocument();
    });
    // loadData is called again after success (initial load + post-save reload)
    expect(mockWrestlersApi.getAll).toHaveBeenCalledTimes(2);
  });

  it('shows error when save fails', async () => {
    const user = userEvent.setup();
    mockWrestlersApi.update.mockRejectedValue(new Error('Server error'));

    renderComponent();
    await waitFor(() => { expect(screen.getByText('John')).toBeInTheDocument(); });

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    await user.click(screen.getByRole('button', { name: 'Update Wrestler' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
