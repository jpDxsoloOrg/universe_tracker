import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { seasonAwardsApi, seasonsApi, wrestlersApi } from '../../services/api';
import type { SeasonAwardsResponse } from '../../services/api';
import type { Season, Wrestler, SeasonAward } from '../../types';
import './ManageSeasonAwards.css';

export default function ManageSeasonAwards() {
  const { t } = useTranslation();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [awardsData, setAwardsData] = useState<SeasonAwardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', wrestlerId: '', description: '' });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadAwards(selectedSeasonId);
    } else {
      setAwardsData(null);
    }
  }, [selectedSeasonId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [seasonsData, wrestlersData] = await Promise.all([
        seasonsApi.getAll(),
        wrestlersApi.getAll(),
      ]);
      setSeasons(seasonsData);
      setWrestlers(wrestlersData);
      const firstSeason = seasonsData[0];
      if (firstSeason) {
        setSelectedSeasonId(firstSeason.seasonId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAwards = async (seasonId: string) => {
    try {
      setLoadingAwards(true);
      const data = await seasonAwardsApi.getAll(seasonId);
      setAwardsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load awards');
    } finally {
      setLoadingAwards(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId || !formData.name || !formData.wrestlerId) return;

    try {
      setError(null);
      await seasonAwardsApi.create(selectedSeasonId, {
        name: formData.name,
        wrestlerId: formData.wrestlerId,
        description: formData.description || undefined,
      });
      setSuccessMsg(t('seasonAwards.admin.createSuccess'));
      setFormData({ name: '', wrestlerId: '', description: '' });
      setShowForm(false);
      await loadAwards(selectedSeasonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create award');
    }
  };

  const handleDelete = async (award: SeasonAward) => {
    if (!window.confirm(t('seasonAwards.admin.confirmDelete', { name: award.name }))) return;

    try {
      setError(null);
      await seasonAwardsApi.delete(award.seasonId, award.awardId);
      setSuccessMsg(t('seasonAwards.admin.deleteSuccess'));
      await loadAwards(selectedSeasonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete award');
    }
  };

  if (loading) return <div className="loading">{t('common.loading')}</div>;

  return (
    <div className="manage-season-awards">
      <h2>{t('seasonAwards.admin.title')}</h2>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="season-selector">
        <label htmlFor="season-select">{t('seasonAwards.admin.selectSeason')}</label>
        <select
          id="season-select"
          value={selectedSeasonId}
          onChange={e => setSelectedSeasonId(e.target.value)}
        >
          <option value="">{t('seasonAwards.admin.chooseSeason')}</option>
          {seasons.map(s => (
            <option key={s.seasonId} value={s.seasonId}>
              {s.name} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {selectedSeasonId && (
        <>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? t('common.cancel') : t('seasonAwards.admin.createAward')}
          </button>

          {showForm && (
            <form className="award-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="award-name">{t('seasonAwards.admin.awardName')}</label>
                <input
                  id="award-name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="award-wrestler">{t('seasonAwards.admin.awardWrestler')}</label>
                <select
                  id="award-wrestler"
                  value={formData.wrestlerId}
                  onChange={e => setFormData({ ...formData, wrestlerId: e.target.value })}
                  required
                >
                  <option value="">{t('seasonAwards.admin.chooseWrestler')}</option>
                  {wrestlers.map(p => (
                    <option key={p.wrestlerId} value={p.wrestlerId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="award-description">{t('seasonAwards.admin.description')}</label>
                <input
                  id="award-description"
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-success">
                {t('seasonAwards.admin.createAward')}
              </button>
            </form>
          )}

          {loadingAwards ? (
            <div className="loading">{t('common.loading')}</div>
          ) : awardsData ? (
            <div className="awards-list">
              {awardsData.autoAwards.length > 0 && (
                <div className="awards-section">
                  <h3>{t('seasonAwards.autoAwards')}</h3>
                  <table className="awards-table">
                    <thead>
                      <tr>
                        <th>{t('seasonAwards.admin.awardName')}</th>
                        <th>{t('seasonAwards.admin.awardWrestler')}</th>
                        <th>{t('seasonAwards.admin.value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awardsData.autoAwards.map(award => (
                        <tr key={award.awardId}>
                          <td>{award.name}</td>
                          <td>{award.wrestlerName}</td>
                          <td>{award.value || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {awardsData.customAwards.length > 0 && (
                <div className="awards-section">
                  <h3>{t('seasonAwards.customAwards')}</h3>
                  <table className="awards-table">
                    <thead>
                      <tr>
                        <th>{t('seasonAwards.admin.awardName')}</th>
                        <th>{t('seasonAwards.admin.awardWrestler')}</th>
                        <th>{t('seasonAwards.admin.description')}</th>
                        <th>{t('common.delete')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awardsData.customAwards.map(award => (
                        <tr key={award.awardId}>
                          <td>{award.name}</td>
                          <td>{award.wrestlerName}</td>
                          <td>{award.description || '-'}</td>
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(award)}
                            >
                              {t('common.delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {awardsData.autoAwards.length === 0 && awardsData.customAwards.length === 0 && (
                <p className="no-awards">{t('seasonAwards.noAwards')}</p>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
