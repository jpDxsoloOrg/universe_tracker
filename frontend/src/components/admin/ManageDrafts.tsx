import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { draftsApi, companiesApi, wrestlersApi } from '../../services/api';
import type { Draft, Company, Wrestler } from '../../types';
import Skeleton from '../ui/Skeleton';
import './ManageDrafts.css';

export default function ManageDrafts() {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // View control
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);

  // Create/Edit form
  const [formData, setFormData] = useState({
    name: '',
    type: 'global' as 'global' | 'inter-company',
    participatingCompanyIds: [] as string[],
    rounds: 5,
    snakeOrder: true,
    draftOrder: [] as string[],
    protectedPicksPerCompany: 0,
    includeGlobalPool: false,
  });

  // Draft detail state
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [selectedWrestlerId, setSelectedWrestlerId] = useState('');
  const [picking, setPicking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [protecting, setProtecting] = useState(false);

  // --- Helper functions ---

  function getExpectedCompany(draft: Draft): string | null {
    if (draft.status !== 'active') return null;
    const { draftOrder, currentRound, currentPickIndex, snakeOrder, rounds } = draft;
    if (currentRound > rounds) return null;
    const companiesPerRound = draftOrder.length;
    const indexInRound = currentPickIndex % companiesPerRound;
    const isReversed = snakeOrder && currentRound % 2 === 0;
    const orderIdx = isReversed ? companiesPerRound - 1 - indexInRound : indexInRound;
    return draftOrder[orderIdx] ?? null;
  }

  function getCompanyName(companyId: string): string {
    return companies.find(c => c.companyId === companyId)?.name || companyId;
  }

  function getWrestlerName(wrestlerId: string): string {
    return wrestlers.find(w => w.wrestlerId === wrestlerId)?.name || wrestlerId;
  }

  function getAvailableWrestlers(draft: Draft): Wrestler[] {
    const pickedIds = new Set(draft.picks.map(p => p.wrestlerId));
    const protectedIds = new Set(draft.protections.map(p => p.wrestlerId));
    const currentCompany = getExpectedCompany(draft);

    return wrestlers.filter(w => {
      if (pickedIds.has(w.wrestlerId)) return false;
      if (protectedIds.has(w.wrestlerId)) return false;

      if (draft.type === 'global') {
        return !w.companyId;
      }

      // Inter-company
      if (w.companyId === currentCompany) return false;
      if (!w.companyId) return draft.includeGlobalPool;
      return draft.participatingCompanyIds.includes(w.companyId);
    });
  }

  // --- Data loading ---

  const loadDrafts = useCallback(async () => {
    try {
      const data = await draftsApi.getAll();
      setDrafts(data);
    } catch (_err) {
      setError('Failed to load drafts');
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data);
    } catch (_err) {
      // Silently fail; companies just won't show
    }
  }, []);

  const loadWrestlers = useCallback(async () => {
    try {
      const data = await wrestlersApi.getAll();
      setWrestlers(data);
    } catch (_err) {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDrafts(), loadCompanies()]);
      setLoading(false);
    };
    init();
  }, [loadDrafts, loadCompanies]);

  // Load wrestlers when viewing an active/setup draft detail
  useEffect(() => {
    if (view === 'detail' && selectedDraft) {
      loadWrestlers();
    }
  }, [view, selectedDraft, loadWrestlers]);

  // --- Navigation ---

  const goToList = () => {
    setView('list');
    setSelectedDraft(null);
    setEditingDraft(null);
    setError('');
    setSuccess('');
    setSearchTerm('');
    setSelectedWrestlerId('');
  };

  const goToCreate = () => {
    setFormData({
      name: '',
      type: 'global',
      participatingCompanyIds: [],
      rounds: 5,
      snakeOrder: true,
      draftOrder: [],
      protectedPicksPerCompany: 0,
      includeGlobalPool: false,
    });
    setEditingDraft(null);
    setView('create');
    setError('');
    setSuccess('');
  };

  const goToEdit = (draft: Draft) => {
    setEditingDraft(draft);
    setFormData({
      name: draft.name,
      type: draft.type,
      participatingCompanyIds: [...draft.participatingCompanyIds],
      rounds: draft.rounds,
      snakeOrder: draft.snakeOrder,
      draftOrder: [...draft.draftOrder],
      protectedPicksPerCompany: draft.protectedPicksPerCompany,
      includeGlobalPool: draft.includeGlobalPool,
    });
    setView('create');
    setError('');
    setSuccess('');
  };

  const goToDetail = async (draft: Draft) => {
    try {
      const freshDraft = await draftsApi.getById(draft.draftId);
      setSelectedDraft(freshDraft);
    } catch (_err) {
      setSelectedDraft(draft);
    }
    setView('detail');
    setError('');
    setSuccess('');
    setSearchTerm('');
    setSelectedWrestlerId('');
  };

  // --- Form handlers ---

  const handleCompanyToggle = (companyId: string) => {
    setFormData(prev => {
      const isSelected = prev.participatingCompanyIds.includes(companyId);
      const newIds = isSelected
        ? prev.participatingCompanyIds.filter(id => id !== companyId)
        : [...prev.participatingCompanyIds, companyId];
      const newOrder = isSelected
        ? prev.draftOrder.filter(id => id !== companyId)
        : [...prev.draftOrder, companyId];
      return { ...prev, participatingCompanyIds: newIds, draftOrder: newOrder };
    });
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const newOrder = [...prev.draftOrder];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newOrder.length) return prev;
      const valA = newOrder[index];
      const valB = newOrder[swapIndex];
      if (valA === undefined || valB === undefined) return prev;
      newOrder[index] = valB;
      newOrder[swapIndex] = valA;
      return { ...prev, draftOrder: newOrder };
    });
  };

  const handleRandomizeOrder = () => {
    setFormData(prev => {
      const shuffled = [...prev.draftOrder];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const valI = shuffled[i];
        const valJ = shuffled[j];
        if (valI !== undefined && valJ !== undefined) {
          shuffled[i] = valJ;
          shuffled[j] = valI;
        }
      }
      return { ...prev, draftOrder: shuffled };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.participatingCompanyIds.length < 2) {
      setError(t('drafts.selectCompanies'));
      return;
    }

    try {
      if (editingDraft) {
        await draftsApi.update(editingDraft.draftId, {
          name: formData.name,
          type: formData.type,
          participatingCompanyIds: formData.participatingCompanyIds,
          rounds: formData.rounds,
          snakeOrder: formData.snakeOrder,
          draftOrder: formData.draftOrder,
          protectedPicksPerCompany: formData.protectedPicksPerCompany,
          includeGlobalPool: formData.includeGlobalPool,
        });
        setSuccess(t('drafts.editDraft') + ' - OK');
      } else {
        await draftsApi.create({
          name: formData.name,
          type: formData.type,
          participatingCompanyIds: formData.participatingCompanyIds,
          rounds: formData.rounds,
          snakeOrder: formData.snakeOrder,
          draftOrder: formData.draftOrder,
          protectedPicksPerCompany: formData.protectedPicksPerCompany,
          includeGlobalPool: formData.includeGlobalPool,
        });
        setSuccess(t('drafts.createDraft') + ' - OK');
      }
      await loadDrafts();
      goToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  // --- Draft actions ---

  const handleStartDraft = async (draft: Draft) => {
    if (!confirm(t('drafts.confirmStart'))) return;
    setError('');
    setSuccess('');

    try {
      const updated = await draftsApi.start(draft.draftId);
      setSuccess(t('drafts.startDraft') + ' - OK');
      await loadDrafts();
      if (view === 'detail') {
        setSelectedDraft(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start draft');
    }
  };

  const handleCompleteDraft = async (draft: Draft) => {
    if (!confirm(t('drafts.confirmComplete'))) return;
    setError('');
    setSuccess('');

    try {
      const updated = await draftsApi.complete(draft.draftId);
      setSuccess(t('drafts.completeDraft') + ' - OK');
      await loadDrafts();
      if (view === 'detail') {
        setSelectedDraft(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete draft');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm(t('drafts.confirmDelete'))) return;
    setError('');
    setSuccess('');

    try {
      await draftsApi.delete(draftId);
      setSuccess(t('drafts.deleteDraft') + ' - OK');
      await loadDrafts();
      if (view === 'detail') {
        goToList();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  };

  const handleMakePick = async () => {
    if (!selectedDraft || !selectedWrestlerId) return;
    const currentCompany = getExpectedCompany(selectedDraft);
    if (!currentCompany) return;

    setPicking(true);
    setError('');

    try {
      const result = await draftsApi.makePick(selectedDraft.draftId, currentCompany, selectedWrestlerId);
      setSelectedDraft(result.draft);
      setSelectedWrestlerId('');
      setSuccess(t('drafts.pickSuccess'));
      await loadDrafts();
      await loadWrestlers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  const handleProtect = async (companyId: string, wrestlerId: string) => {
    if (!selectedDraft) return;
    setProtecting(true);
    setError('');

    try {
      const updated = await draftsApi.protect(selectedDraft.draftId, companyId, wrestlerId);
      setSelectedDraft(updated);
      setSuccess(t('drafts.protectWrestler') + ' - OK');
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to protect wrestler');
    } finally {
      setProtecting(false);
    }
  };

  // --- Render helpers ---

  const renderStatusBadge = (status: Draft['status']) => (
    <span className={`status-badge status-${status}`}>
      {t(`drafts.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
    </span>
  );

  const renderTypeBadge = (type: Draft['type']) => (
    <span className={`type-badge type-${type}`}>
      {type === 'global' ? t('drafts.typeGlobal') : t('drafts.typeInterCompany')}
    </span>
  );

  // --- Views ---

  const renderListView = () => (
    <>
      <div className="draft-header">
        <h2>{t('drafts.title')}</h2>
        <button onClick={goToCreate}>{t('drafts.createDraft')}</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="draft-list">
        <h3>{t('drafts.title')} ({drafts.length})</h3>
        {drafts.length === 0 ? (
          <div className="empty-state">
            <p>{t('drafts.noDrafts')}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('drafts.name')}</th>
                <th>{t('drafts.type')}</th>
                <th>{t('drafts.status')}</th>
                <th>{t('drafts.companies')}</th>
                <th>{t('drafts.rounds')}</th>
                <th>{t('drafts.totalPicks')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(draft => (
                <tr key={draft.draftId}>
                  <td>{draft.name}</td>
                  <td>{renderTypeBadge(draft.type)}</td>
                  <td>{renderStatusBadge(draft.status)}</td>
                  <td>{draft.participatingCompanyIds.length}</td>
                  <td>{draft.rounds}</td>
                  <td>{draft.picks.length}</td>
                  <td>
                    <div className="draft-actions">
                      <button
                        className="draft-view-btn"
                        onClick={() => goToDetail(draft)}
                      >
                        {t('drafts.viewDraft')}
                      </button>
                      {draft.status === 'setup' && (
                        <>
                          <button
                            className="draft-edit-btn"
                            onClick={() => goToEdit(draft)}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className="draft-start-btn"
                            onClick={() => handleStartDraft(draft)}
                          >
                            {t('drafts.startDraft')}
                          </button>
                        </>
                      )}
                      {(draft.status === 'setup' || draft.status === 'completed') && (
                        <button
                          className="draft-delete-btn"
                          onClick={() => handleDeleteDraft(draft.draftId)}
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  const renderCreateView = () => (
    <>
      <div className="draft-header">
        <h2>{editingDraft ? t('drafts.editDraft') : t('drafts.createDraft')}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="draft-form-container">
        <h3>{editingDraft ? t('drafts.editDraft') : t('drafts.createDraft')}</h3>
        <form onSubmit={handleSubmit} className="draft-form">
          <div className="form-group">
            <label htmlFor="draft-name">{t('drafts.name')}</label>
            <input
              type="text"
              id="draft-name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., 2026 Superstar Draft"
            />
          </div>

          <div className="form-group">
            <label>{t('drafts.type')}</label>
            <div className="type-selector">
              <label>
                <input
                  type="radio"
                  name="draftType"
                  value="global"
                  checked={formData.type === 'global'}
                  onChange={() => setFormData({ ...formData, type: 'global' })}
                />
                {t('drafts.typeGlobal')}
              </label>
              <label>
                <input
                  type="radio"
                  name="draftType"
                  value="inter-company"
                  checked={formData.type === 'inter-company'}
                  onChange={() => setFormData({ ...formData, type: 'inter-company' })}
                />
                {t('drafts.typeInterCompany')}
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>{t('drafts.companies')}</label>
            {companies.length === 0 ? (
              <p style={{ color: '#888' }}>No companies available. Create companies first.</p>
            ) : (
              <div className="company-checkboxes">
                {companies.map(company => (
                  <label key={company.companyId}>
                    <input
                      type="checkbox"
                      checked={formData.participatingCompanyIds.includes(company.companyId)}
                      onChange={() => handleCompanyToggle(company.companyId)}
                    />
                    {company.name}
                    {company.abbreviation && ` (${company.abbreviation})`}
                  </label>
                ))}
              </div>
            )}
            {formData.participatingCompanyIds.length > 0 && formData.participatingCompanyIds.length < 2 && (
              <span className="help-text">{t('drafts.selectCompanies')}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="draft-rounds">{t('drafts.rounds')}</label>
            <input
              type="number"
              id="draft-rounds"
              value={formData.rounds}
              onChange={e => setFormData({ ...formData, rounds: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
              min={1}
              max={50}
            />
          </div>

          <div className="form-group">
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="snake-order"
                checked={formData.snakeOrder}
                onChange={e => setFormData({ ...formData, snakeOrder: e.target.checked })}
              />
              <label htmlFor="snake-order">{t('drafts.snakeOrder')}</label>
            </div>
            <span className="help-text">{t('drafts.snakeOrderHelp')}</span>
          </div>

          {formData.draftOrder.length > 0 && (
            <div className="form-group">
              <label>{t('drafts.draftOrder')}</label>
              <ul className="draft-order-list">
                {formData.draftOrder.map((companyId, index) => (
                  <li key={companyId}>
                    <span className="order-number">{index + 1}.</span>
                    <span className="order-name">{getCompanyName(companyId)}</span>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(index, 'up')}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(index, 'down')}
                      disabled={index === formData.draftOrder.length - 1}
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="randomize-btn"
                onClick={handleRandomizeOrder}
              >
                {t('drafts.randomizeOrder')}
              </button>
            </div>
          )}

          {formData.type === 'inter-company' && (
            <div className="inter-company-fields">
              <h4>{t('drafts.typeInterCompany')} Options</h4>
              <div className="form-group">
                <label htmlFor="protected-picks">{t('drafts.protectedPicks')}</label>
                <input
                  type="number"
                  id="protected-picks"
                  value={formData.protectedPicksPerCompany}
                  onChange={e => setFormData({ ...formData, protectedPicksPerCompany: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={0}
                />
              </div>
              <div className="form-group">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="include-global-pool"
                    checked={formData.includeGlobalPool}
                    onChange={e => setFormData({ ...formData, includeGlobalPool: e.target.checked })}
                  />
                  <label htmlFor="include-global-pool">{t('drafts.includeGlobalPool')}</label>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit">
              {editingDraft ? t('drafts.editDraft') : t('drafts.createDraft')}
            </button>
            <button type="button" onClick={goToList} className="cancel-btn">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </>
  );

  const renderDraftBoard = (draft: Draft) => {
    const currentCompany = getExpectedCompany(draft);

    return (
      <div className="draft-board">
        <h3>{t('drafts.draftBoard')}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('drafts.round')}</th>
              {draft.draftOrder.map(companyId => (
                <th key={companyId}>{getCompanyName(companyId)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: draft.rounds }, (_, roundIdx) => {
              const roundNum = roundIdx + 1;
              const isReversed = draft.snakeOrder && roundNum % 2 === 0;

              return (
                <tr key={roundNum}>
                  <td className="round-label">{roundNum}</td>
                  {draft.draftOrder.map((companyId, colIdx) => {
                    const orderIndex = isReversed
                      ? draft.draftOrder.length - 1 - colIdx
                      : colIdx;
                    const actualCompanyId = draft.draftOrder[orderIndex];

                    const pick = draft.picks.find(
                      p => p.round === roundNum && p.companyId === actualCompanyId
                    );

                    const isCurrent =
                      draft.status === 'active' &&
                      draft.currentRound === roundNum &&
                      currentCompany === actualCompanyId;

                    if (pick) {
                      return (
                        <td key={companyId} className={isCurrent ? 'current-pick' : ''}>
                          <div className="pick-content">
                            <span className="pick-wrestler">{getWrestlerName(pick.wrestlerId)}</span>
                            {pick.previousCompanyId && (
                              <span className="pick-source">
                                {t('drafts.source')}: {getCompanyName(pick.previousCompanyId)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={companyId}
                        className={`empty${isCurrent ? ' current-pick' : ''}`}
                      >
                        {isCurrent ? t('drafts.currentPick') : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderProtectionSection = (draft: Draft) => {
    if (draft.type !== 'inter-company' || draft.protectedPicksPerCompany <= 0) return null;
    if (draft.status !== 'setup') return null;

    return (
      <div className="protection-section">
        <h3>{t('drafts.protection')}</h3>
        {draft.participatingCompanyIds.map(companyId => {
          const companyProtections = draft.protections.filter(p => p.companyId === companyId);
          const remaining = draft.protectedPicksPerCompany - companyProtections.length;
          const companyWrestlers = wrestlers.filter(w => w.companyId === companyId);
          const protectedIds = new Set(companyProtections.map(p => p.wrestlerId));

          return (
            <div key={companyId} className="protection-company">
              <h4>{getCompanyName(companyId)}</h4>
              <div className="protection-count">
                {remaining > 0
                  ? t('drafts.protectionRemaining', { remaining })
                  : t('drafts.protectionComplete')}
              </div>

              {companyProtections.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  {companyProtections.map(prot => (
                    <span key={prot.wrestlerId} className="protected-wrestler">
                      🛡 {getWrestlerName(prot.wrestlerId)}
                    </span>
                  ))}
                </div>
              )}

              {remaining > 0 && (
                <div className="protection-wrestlers-list">
                  {companyWrestlers
                    .filter(w => !protectedIds.has(w.wrestlerId))
                    .map(w => (
                      <button
                        key={w.wrestlerId}
                        onClick={() => handleProtect(companyId, w.wrestlerId)}
                        disabled={protecting}
                      >
                        {t('drafts.protectWrestler')}: {w.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderActivePickingSection = (draft: Draft) => {
    if (draft.status !== 'active') return null;

    const currentCompany = getExpectedCompany(draft);
    if (!currentCompany) return null;

    const available = getAvailableWrestlers(draft);
    const filtered = searchTerm
      ? available.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : available;

    return (
      <>
        <div className="current-pick-banner">
          {t('drafts.round')} {draft.currentRound} — {getCompanyName(currentCompany)}{' '}
          {t('drafts.currentPick')}
        </div>

        <div className="available-wrestlers">
          <h3>{t('drafts.availableWrestlers')} ({available.length})</h3>
          <input
            type="text"
            className="search-input"
            placeholder={t('drafts.availableWrestlers') + '...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          <div className="wrestlers-grid">
            {filtered.map(w => (
              <div
                key={w.wrestlerId}
                className={`wrestler-card${selectedWrestlerId === w.wrestlerId ? ' selected' : ''}`}
                onClick={() => setSelectedWrestlerId(w.wrestlerId)}
              >
                <div className="wrestler-name">{w.name}</div>
                {w.companyId && (
                  <div className="wrestler-company">{getCompanyName(w.companyId)}</div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <p>{t('drafts.noPicks')}</p>
              </div>
            )}
          </div>

          <div className="pick-action">
            <button
              className="pick-btn"
              onClick={handleMakePick}
              disabled={!selectedWrestlerId || picking}
            >
              {picking ? t('common.saving') : t('drafts.makePick')}
            </button>
            {selectedWrestlerId && (
              <span>
                {t('drafts.picked')}: <strong>{getWrestlerName(selectedWrestlerId)}</strong>
              </span>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderDetailView = () => {
    if (!selectedDraft) return null;

    return (
      <div className="draft-detail">
        <div className="draft-detail-header">
          <h2>{selectedDraft.name}</h2>
          {renderTypeBadge(selectedDraft.type)}
          {renderStatusBadge(selectedDraft.status)}
        </div>

        <div className="draft-detail-actions">
          <button className="back-btn" onClick={goToList}>
            {t('drafts.backToList')}
          </button>
          {selectedDraft.status === 'setup' && (
            <>
              <button className="draft-start-btn" onClick={() => handleStartDraft(selectedDraft)}>
                {t('drafts.startDraft')}
              </button>
              <button className="draft-edit-btn" onClick={() => goToEdit(selectedDraft)}>
                {t('common.edit')}
              </button>
              <button className="draft-delete-btn" onClick={() => handleDeleteDraft(selectedDraft.draftId)}>
                {t('common.delete')}
              </button>
            </>
          )}
          {selectedDraft.status === 'active' && (
            <button className="draft-delete-btn" onClick={() => handleCompleteDraft(selectedDraft)}>
              {t('drafts.completeDraft')}
            </button>
          )}
          {selectedDraft.status === 'completed' && (
            <button className="draft-delete-btn" onClick={() => handleDeleteDraft(selectedDraft.draftId)}>
              {t('common.delete')}
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {renderProtectionSection(selectedDraft)}
        {renderActivePickingSection(selectedDraft)}
        {renderDraftBoard(selectedDraft)}
      </div>
    );
  };

  // --- Main render ---

  if (loading) {
    return <Skeleton variant="block" count={4} />;
  }

  return (
    <div className="manage-drafts">
      {view === 'list' && renderListView()}
      {view === 'create' && renderCreateView()}
      {view === 'detail' && renderDetailView()}
    </div>
  );
}
