import { useEffect, useState, useCallback, useRef, useMemo} from 'react';
import { useTranslation } from 'react-i18next';
import { championshipsApi, divisionsApi, wrestlersApi } from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { type Division, type Championship, type ChampionshipReign, type Wrestler } from '../types';
import DivisionFilter from './DivisionFilter';
import Skeleton from './ui/Skeleton';
import SkeletonMorph from './ui/SkeletonMorph';
import EmptyState from './ui/EmptyState';
import {
  DEFAULT_CHAMPIONSHIP_IMAGE,
  applyImageFallback,
  resolveImageSrc,
} from '../constants/imageFallbacks';
import './Championships.css';

type ChampionshipTier = 'world' | 'tag' | 'midcard';

function getChampionshipTier(championship: Championship): ChampionshipTier {
  const name = championship.name.toLowerCase();
  if (/world|universal|undisputed|heavyweight/.test(name)) return 'world';
  if (/tag/.test(name)) return 'tag';
  return 'midcard';
}

export default function Championships() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.championships'));
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedChampionship, setSelectedChampionship] = useState<string | null>(null);
  const [history, setHistory] = useState<ChampionshipReign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyAbortRef = useRef<AbortController | null>(null);

  // Reload data when retry button is clicked
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [champData, wrestlerData, divisionsData] = await Promise.all([
        championshipsApi.getAll(),
        wrestlersApi.getAll(),
        divisionsApi.getAll(),
      ]);
      setChampionships(champData);
      setWrestlers(wrestlerData);
      setDivisions(divisionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load championships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [champData, wrestlerData, divisionsData] = await Promise.all([
          championshipsApi.getAll(abortController.signal),
          wrestlersApi.getAll(abortController.signal),
          divisionsApi.getAll(abortController.signal),
        ]);
        if (!abortController.signal.aborted) {
          setChampionships(champData);
          setWrestlers(wrestlerData);
          setDivisions(divisionsData);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load championships');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => abortController.abort();
  }, []);

  const loadHistory = useCallback(async (championshipId: string) => {
    // Cancel any previous history request
    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
    }
    historyAbortRef.current = new AbortController();

    try {
      setLoadingHistory(true);
      const historyData = await championshipsApi.getHistory(
        championshipId,
        historyAbortRef.current.signal
      );
      setHistory(historyData);
      setSelectedChampionship(championshipId);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        logger.error('Failed to load championship history');
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChampionship) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedChampionship(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedChampionship]);

  const filteredChampionships = useMemo((): Championship[] => {
    if (selectedDivision === 'all') {
      return championships;
    }
    if (selectedDivision === 'none') {
      return championships.filter(c => !c.divisionId);
    }
    return championships.filter(c => c.divisionId === selectedDivision);
  }, [championships, selectedDivision]);

  const getWrestlerName = (wrestlerId: string | string[]) => {
    if (Array.isArray(wrestlerId)) {
      return wrestlerId.map(id => {
        const wrestler = wrestlers.find(p => p.wrestlerId === id);
        return wrestler ? wrestler.name : t('common.unknown');
      }).join(' & ');
    }
    const wrestler = wrestlers.find(p => p.wrestlerId === wrestlerId);
    return wrestler ? wrestler.name : t('common.unknown');
  };

  if (error) {
    return (
      <div className="error">
        <p>{t('common.error')}: {error}</p>
        <button onClick={loadData}>{t('common.retry')}</button>
      </div>
    );
  }

  if (!loading && championships.length === 0) {
    return (
      <EmptyState
        title={t('championships.title')}
        description={t('championships.noChampionships')}
      />
    );
  }

  return (
    <SkeletonMorph loading={loading} skeleton={<Skeleton variant="cards" />}>
      <div className="championships-container">
        <h2>{t('championships.title')}</h2>
          {divisions.length > 0 && (
              <DivisionFilter
                divisions={divisions}
                selectedDivision={selectedDivision}
                onSelect={setSelectedDivision}
                labelKey="championships.filterByDivision"
                showNoDivision
              />
            )}
        <div className="championships-grid">
          {filteredChampionships.map((championship) => (
            <div key={championship.championshipId} className={`championship-card tier-${getChampionshipTier(championship)}`}>
              <div className="championship-image-container">
                <img
                  src={resolveImageSrc(championship.imageUrl, DEFAULT_CHAMPIONSHIP_IMAGE)}
                  onError={(event) => applyImageFallback(event, DEFAULT_CHAMPIONSHIP_IMAGE)}
                  alt={championship.name}
                  className="championship-image"
                />
              </div>
              <div className="championship-header">
                <h3>{championship.name}</h3>
                <span className="championship-type">
                  {championship.type === 'singles' ? t('championships.singles') : t('championships.tagTeam')}
                </span>
              </div>

              <div className="current-champion">
                <label>{t('championships.currentChampion')}:</label>
                <p>
                  {championship.currentChampion
                    ? getWrestlerName(championship.currentChampion)
                    : t('common.vacant')}
                </p>
              </div>

              <button
                onClick={() => loadHistory(championship.championshipId)}
                className="view-history-btn"
              >
                {t('championships.viewHistory')}
              </button>
            </div>
          ))}
        </div>

        {selectedChampionship && (
        <div
          className="history-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
          onClick={() => setSelectedChampionship(null)}
        >
          <div className="history-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h3 id="history-modal-title">
                {championships.find(c => c.championshipId === selectedChampionship)?.name} {t('championships.history')}
              </h3>
              <button
                onClick={() => setSelectedChampionship(null)}
                className="close-btn"
                aria-label={t('common.closeModal') || 'Close modal'}
              >
                ×
              </button>
            </div>

            {loadingHistory ? (
              <div className="loading">{t('championships.loadingHistory')}</div>
            ) : history.length === 0 ? (
              <p>{t('championships.noHistory')}</p>
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>{t('championships.table.champion')}</th>
                      <th>{t('championships.table.wonDate')}</th>
                      <th>{t('championships.table.lostDate')}</th>
                      <th>{t('championships.table.daysHeld')}</th>
                      <th>{t('championships.table.defenses')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((reign, index) => (
                      <tr key={index}>
                        <td className="champion-name">
                          {getWrestlerName(reign.champion)}
                        </td>
                        <td>{formatDate(reign.wonDate)}</td>
                        <td>
                          {reign.lostDate
                            ? formatDate(reign.lostDate)
                            : t('common.current')}
                        </td>
                        <td>
                          {reign.daysHeld !== undefined
                            ? `${reign.daysHeld} ${t('common.days')}`
                            : '-'}
                        </td>
                        <td>{reign.defenses ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </SkeletonMorph>
  );
}
