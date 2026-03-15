import { useState, useEffect, FormEvent } from 'react';
import { tournamentsApi, wrestlersApi } from '../../services/api';
import { sanitizeName } from '../../utils/sanitize';
import type { Wrestler } from '../../types';
import './CreateTournament.css';

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function isValidSingleEliminationParticipantCount(count: number): boolean {
  return count >= 4 && isPowerOfTwo(count);
}

export default function CreateTournament() {
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'single-elimination' as 'single-elimination' | 'round-robin',
    participants: [] as string[],
  });

  useEffect(() => {
    loadWrestlers();
  }, []);

  const loadWrestlers = async () => {
    try {
      setLoading(true);
      const data = await wrestlersApi.getAll();
      setWrestlers(data);
    } catch (_err) {
      setError('Failed to load wrestlers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return; // Prevent double submission

    setError(null);
    setSuccess(null);

    if (formData.participants.length < 2) {
      setError('Please select at least 2 participants');
      return;
    }

    if (formData.type === 'single-elimination') {
      if (formData.participants.length < 4) {
        setError('Single elimination tournaments require at least 4 participants');
        return;
      }
      if (!isPowerOfTwo(formData.participants.length)) {
        setError('Single elimination tournaments require a power-of-two participant count (4, 8, 16, ...)');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Sanitize tournament name input
      const sanitizedName = sanitizeName(formData.name, 100);

      if (!sanitizedName) {
        setError('Tournament name cannot be empty');
        setSubmitting(false);
        return;
      }

      await tournamentsApi.create({
        name: sanitizedName,
        type: formData.type,
        participants: formData.participants,
        status: 'upcoming',
      });

      setSuccess('Tournament created successfully!');
      setFormData({
        name: '',
        type: 'single-elimination',
        participants: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setSubmitting(false);
    }
  };

  const handleParticipantToggle = (wrestlerId: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(wrestlerId)
        ? prev.participants.filter(id => id !== wrestlerId)
        : [...prev.participants, wrestlerId],
    }));
  };

  const moveParticipantById = (wrestlerId: string, direction: -1 | 1) => {
    setFormData((prev) => {
      const fromIndex = prev.participants.indexOf(wrestlerId);
      if (fromIndex < 0) return prev;
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.participants.length) return prev;
      const reordered = [...prev.participants];
      const [moved] = reordered.splice(fromIndex, 1);
      if (!moved) return prev;
      reordered.splice(toIndex, 0, moved);
      return { ...prev, participants: reordered };
    });
  };

  const selectedWrestlers = formData.participants
    .map((wrestlerId) => wrestlers.find((wrestler) => wrestler.wrestlerId === wrestlerId))
    .filter((wrestler): wrestler is Wrestler => !!wrestler);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="create-tournament">
      <h2>Create Tournament</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleSubmit} className="tournament-form">
        <div className="form-group">
          <label htmlFor="name">Tournament Name</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="King of the Ring 2024"
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">Tournament Type</label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'single-elimination' | 'round-robin' })}
            required
          >
            <option value="single-elimination">Single Elimination</option>
            <option value="round-robin">Round Robin (G1 Climax Style)</option>
          </select>
          <small className="help-text">
            {formData.type === 'single-elimination'
              ? 'Bracket-style tournament. Requires at least 4 participants.'
              : 'Every participant faces every other participant. 2 points for win, 1 for draw.'}
          </small>
        </div>

        <div className="form-group">
          <label>Participants (Selected: {formData.participants.length})</label>
          <div className="participants-grid">
            {wrestlers.map(wrestler => (
              <div
                key={wrestler.wrestlerId}
                className={`participant-card ${formData.participants.includes(wrestler.wrestlerId) ? 'selected' : ''}`}
                onClick={() => handleParticipantToggle(wrestler.wrestlerId)}
              >
                <div className="participant-name">{wrestler.name}</div>
                <div className="participant-wrestler">{wrestler.name}</div>
                <div className="participant-record">
                  {wrestler.wins}W-{wrestler.losses}L-{wrestler.draws}D
                </div>
              </div>
            ))}
          </div>
        </div>

        {formData.type === 'single-elimination' &&
          isValidSingleEliminationParticipantCount(formData.participants.length) && (
          <div className="form-group">
            <label>Seed / Matchup Order</label>
            <small className="help-text">
              This order controls first-round matchups (1 vs 2, 3 vs 4, etc.).
            </small>
            <div className="seed-list">
              {selectedWrestlers.map((wrestler, index) => (
                <div key={wrestler.wrestlerId} className="seed-item">
                  <div className="seed-item-left">
                    <span className="seed-badge">Seed {index + 1}</span>
                    <span className="seed-name">{wrestler.name}</span>
                  </div>
                  <div className="seed-item-actions">
                    <button
                      type="button"
                      className="seed-move-btn"
                      onClick={() => moveParticipantById(wrestler.wrestlerId, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${wrestler.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="seed-move-btn"
                      onClick={() => moveParticipantById(wrestler.wrestlerId, 1)}
                      disabled={index === selectedWrestlers.length - 1}
                      aria-label={`Move ${wrestler.name} down`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  );
}
