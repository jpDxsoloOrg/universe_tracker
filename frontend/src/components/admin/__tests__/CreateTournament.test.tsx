import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// --- Hoisted mocks ---
const { mockGetAllWrestlers, mockCreateTournament } = vi.hoisted(() => ({
  mockGetAllWrestlers: vi.fn(),
  mockCreateTournament: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  wrestlersApi: {
    getAll: mockGetAllWrestlers,
  },
  tournamentsApi: {
    create: mockCreateTournament,
  },
}));

// Suppress CSS import
vi.mock('../CreateTournament.css', () => ({}));

import CreateTournament from '../CreateTournament';

// --- Test data ---
const mockWrestlers = [
  { wrestlerId: 'p1', name: 'John Cena', wins: 10, losses: 2, draws: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { wrestlerId: 'p2', name: 'The Rock', wins: 8, losses: 3, draws: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { wrestlerId: 'p3', name: 'Undertaker', wins: 15, losses: 5, draws: 2, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { wrestlerId: 'p4', name: 'Triple H', wins: 12, losses: 4, draws: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { wrestlerId: 'p5', name: 'Stone Cold', wins: 20, losses: 5, draws: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

function renderCreateTournament() {
  return render(
    <BrowserRouter>
      <CreateTournament />
    </BrowserRouter>
  );
}

describe('CreateTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with type selection and participant list', async () => {
    mockGetAllWrestlers.mockResolvedValue(mockWrestlers);

    renderCreateTournament();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Tournament' })).toBeInTheDocument();
    });

    // Form fields
    expect(screen.getByLabelText('Tournament Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Tournament Type')).toBeInTheDocument();

    // Type options
    const typeSelect = screen.getByLabelText('Tournament Type') as HTMLSelectElement;
    expect(typeSelect.value).toBe('single-elimination');
    expect(screen.getByText('Single Elimination')).toBeInTheDocument();
    expect(screen.getByText('Round Robin (G1 Climax Style)')).toBeInTheDocument();

    // Help text for single elimination
    expect(screen.getByText(/Bracket-style tournament/)).toBeInTheDocument();

    // Participants header with count
    expect(screen.getByText('Participants (Selected: 0)')).toBeInTheDocument();

    // All wrestler cards rendered (name appears in both participant-name and participant-wrestler divs)
    expect(screen.getAllByText('John Cena').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('The Rock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Undertaker').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Triple H').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Stone Cold').length).toBeGreaterThanOrEqual(1);

    // Wrestler records displayed as compound text within participant-record divs
    const recordDivs = document.querySelectorAll('.participant-record');
    expect(recordDivs.length).toBe(5);

    // Submit button
    expect(screen.getByRole('button', { name: 'Create Tournament' })).toBeInTheDocument();
  });

  it('validates minimum number of participants for single elimination', async () => {
    mockGetAllWrestlers.mockResolvedValue(mockWrestlers);

    renderCreateTournament();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Tournament' })).toBeInTheDocument();
    });

    // Fill name
    fireEvent.change(screen.getByLabelText('Tournament Name'), {
      target: { value: 'King of the Ring' },
    });

    // Select only 2 participants (single-elimination requires 4)
    fireEvent.click(screen.getAllByText('John Cena')[0]);
    fireEvent.click(screen.getAllByText('The Rock')[0]);

    expect(screen.getByText('Participants (Selected: 2)')).toBeInTheDocument();
    expect(screen.queryByText('Seed / Matchup Order')).not.toBeInTheDocument();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => {
      expect(screen.getByText('Single elimination tournaments require at least 4 participants')).toBeInTheDocument();
    });

    expect(mockCreateTournament).not.toHaveBeenCalled();
  });

  it('submits tournament creation with valid data', async () => {
    mockGetAllWrestlers.mockResolvedValue(mockWrestlers);
    mockCreateTournament.mockResolvedValue({
      tournamentId: 't1',
      name: 'King of the Ring',
      type: 'single-elimination',
      status: 'upcoming',
      participants: ['p1', 'p2', 'p3', 'p4'],
      createdAt: '2024-01-01',
    });

    renderCreateTournament();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Tournament' })).toBeInTheDocument();
    });

    // Fill name
    fireEvent.change(screen.getByLabelText('Tournament Name'), {
      target: { value: 'King of the Ring' },
    });

    // Select 4 participants for single elimination
    fireEvent.click(screen.getAllByText('John Cena')[0]);
    fireEvent.click(screen.getAllByText('The Rock')[0]);
    fireEvent.click(screen.getAllByText('Undertaker')[0]);
    fireEvent.click(screen.getAllByText('Triple H')[0]);

    expect(screen.getByText('Participants (Selected: 4)')).toBeInTheDocument();
    expect(screen.getByText('Seed / Matchup Order')).toBeInTheDocument();

    // Reorder seeds: move The Rock down so first matchup is John Cena vs Undertaker
    fireEvent.click(screen.getByLabelText('Move The Rock down'));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => {
      expect(mockCreateTournament).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'King of the Ring',
          type: 'single-elimination',
          participants: ['p1', 'p3', 'p2', 'p4'],
          status: 'upcoming',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Tournament created successfully!')).toBeInTheDocument();
    });
  });

  it('validates power-of-two participant count for single elimination', async () => {
    mockGetAllWrestlers.mockResolvedValue(mockWrestlers);

    renderCreateTournament();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Tournament' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Tournament Name'), {
      target: { value: 'King of Chaos' },
    });

    // Pick 5 participants: valid minimum but invalid for power-of-two rule
    fireEvent.click(screen.getAllByText('John Cena')[0]);
    fireEvent.click(screen.getAllByText('The Rock')[0]);
    fireEvent.click(screen.getAllByText('Undertaker')[0]);
    fireEvent.click(screen.getAllByText('Triple H')[0]);
    fireEvent.click(screen.getAllByText('Stone Cold')[0]);

    expect(screen.queryByText('Seed / Matchup Order')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => {
      expect(
        screen.getByText('Single elimination tournaments require a power-of-two participant count (4, 8, 16, ...)')
      ).toBeInTheDocument();
    });

    expect(mockCreateTournament).not.toHaveBeenCalled();
  });
});
