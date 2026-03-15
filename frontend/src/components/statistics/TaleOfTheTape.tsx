import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { statisticsApi, seasonsApi } from '../../services/api';
import type { StatsWrestler, HeadToHeadResponse } from '../../services/api';
import type { Season } from '../../types';
import Skeleton from '../ui/Skeleton';
import SeasonSelector from './SeasonSelector';
import './TaleOfTheTape.css';

interface StatRow {
  label: string;
  p1Value: number;
  p2Value: number;
  suffix?: string;
  lowerIsBetter?: boolean;
}

function TaleOfTheTape() {
  const { t } = useTranslation();
  const [wrestlers, setWrestlers] = useState<StatsWrestler[]>([]);
  const [wrestler1Id, setWrestler1Id] = useState('');
  const [wrestler2Id, setWrestler2Id] = useState('');
  const [data, setData] = useState<HeadToHeadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  // Load wrestler list and seasons on mount
  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      try {
        const [wrestlersResult, seasonsResult] = await Promise.all([
          statisticsApi.getHeadToHeadWrestlers(abortController.signal),
          seasonsApi.getAll(abortController.signal),
        ]);
        setWrestlers(wrestlersResult.wrestlers);
        setSeasons(seasonsResult);
        if (wrestlersResult.wrestlers.length >= 2 && wrestlersResult.wrestlers[0] && wrestlersResult.wrestlers[1]) {
          setWrestler1Id(wrestlersResult.wrestlers[0].wrestlerId);
          setWrestler2Id(wrestlersResult.wrestlers[1].wrestlerId);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load wrestlers', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, []);

  // Load comparison data when wrestlers or season change
  useEffect(() => {
    if (!wrestler1Id || !wrestler2Id || wrestler1Id === wrestler2Id) {
      setData(null);
      return;
    }
    const abortController = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await statisticsApi.getHeadToHead(
          wrestler1Id, wrestler2Id, selectedSeasonId || undefined, abortController.signal
        );
        setData(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load comparison', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [wrestler1Id, wrestler2Id, selectedSeasonId]);

  const wrestler1 = useMemo(() => wrestlers.find((p) => p.wrestlerId === wrestler1Id), [wrestlers, wrestler1Id]);
  const wrestler2 = useMemo(() => wrestlers.find((p) => p.wrestlerId === wrestler2Id), [wrestlers, wrestler2Id]);

  const p1Stats = data?.wrestler1Stats;
  const p2Stats = data?.wrestler2Stats;
  const h2h = data?.headToHead;

  const isSwapped = h2h ? h2h.wrestler1Id !== wrestler1Id : false;
  const p1H2HWins = h2h ? (isSwapped ? h2h.wrestler2Wins : h2h.wrestler1Wins) : 0;
  const p2H2HWins = h2h ? (isSwapped ? h2h.wrestler1Wins : h2h.wrestler2Wins) : 0;

  const statRows: StatRow[] = useMemo(() => {
    if (!p1Stats || !p2Stats) return [];
    return [
      { label: t('statistics.labels.matchesPlayed'), p1Value: p1Stats.matchesPlayed, p2Value: p2Stats.matchesPlayed },
      { label: t('statistics.labels.wins'), p1Value: p1Stats.wins, p2Value: p2Stats.wins },
      { label: t('statistics.labels.losses'), p1Value: p1Stats.losses, p2Value: p2Stats.losses, lowerIsBetter: true },
      { label: t('statistics.labels.draws'), p1Value: p1Stats.draws, p2Value: p2Stats.draws },
      { label: t('statistics.labels.winPercentage'), p1Value: p1Stats.winPercentage, p2Value: p2Stats.winPercentage, suffix: '%' },
      { label: t('statistics.labels.currentStreak'), p1Value: p1Stats.currentWinStreak, p2Value: p2Stats.currentWinStreak },
      { label: t('statistics.labels.longestWinStreak'), p1Value: p1Stats.longestWinStreak, p2Value: p2Stats.longestWinStreak },
      { label: t('statistics.labels.longestLossStreak'), p1Value: p1Stats.longestLossStreak, p2Value: p2Stats.longestLossStreak, lowerIsBetter: true },
      { label: t('statistics.labels.titleWins'), p1Value: p1Stats.championshipWins, p2Value: p2Stats.championshipWins },
      { label: t('statistics.labels.titleLosses'), p1Value: p1Stats.championshipLosses, p2Value: p2Stats.championshipLosses, lowerIsBetter: true },
    ];
  }, [p1Stats, p2Stats, t]);

  const p1Advantages = statRows.filter((r) => {
    if (r.lowerIsBetter) return r.p1Value < r.p2Value;
    return r.p1Value > r.p2Value;
  }).length;

  const p2Advantages = statRows.filter((r) => {
    if (r.lowerIsBetter) return r.p2Value < r.p1Value;
    return r.p2Value > r.p1Value;
  }).length;

  function renderTapeRow(row: StatRow) {
    const max = Math.max(row.p1Value, row.p2Value, 1);
    const p1Width = (row.p1Value / max) * 100;
    const p2Width = (row.p2Value / max) * 100;

    let p1Better: boolean;
    let p2Better: boolean;
    if (row.lowerIsBetter) {
      p1Better = row.p1Value < row.p2Value;
      p2Better = row.p2Value < row.p1Value;
    } else {
      p1Better = row.p1Value > row.p2Value;
      p2Better = row.p2Value > row.p1Value;
    }

    const displayVal = (val: number) =>
      row.suffix === '%' ? val.toFixed(1) + row.suffix : val + (row.suffix || '');

    return (
      <div className="tot-row" key={row.label}>
        <div className="tot-row-p1">
          <span className={`tot-val ${p1Better ? 'tot-val-better' : ''}`}>
            {displayVal(row.p1Value)}
          </span>
          <div className="tot-bar-track tot-bar-left">
            <div
              className={`tot-bar-fill tot-bar-fill-p1 ${p1Better ? 'tot-bar-winner' : ''}`}
              style={{ width: `${p1Width}%` }}
            />
          </div>
        </div>
        <div className="tot-row-label">{row.label}</div>
        <div className="tot-row-p2">
          <div className="tot-bar-track tot-bar-right">
            <div
              className={`tot-bar-fill tot-bar-fill-p2 ${p2Better ? 'tot-bar-winner' : ''}`}
              style={{ width: `${p2Width}%` }}
            />
          </div>
          <span className={`tot-val ${p2Better ? 'tot-val-better' : ''}`}>
            {displayVal(row.p2Value)}
          </span>
        </div>
      </div>
    );
  }

  if (loading && wrestlers.length === 0) {
    return (
      <div className="tale-of-tape">
        <h2>{t('statistics.taleOfTape.title')}</h2>
        <Skeleton variant="block" count={4} />
      </div>
    );
  }

  return (
    <div className="tale-of-tape">
      <div className="tot-header">
        <h2>{t('statistics.taleOfTape.title')}</h2>
        <div className="tot-nav-links">
          <Link to="/stats">{t('statistics.nav.wrestlerStats')}</Link>
          <Link to="/stats/head-to-head">{t('statistics.nav.headToHead')}</Link>
          <Link to="/stats/leaderboards">{t('statistics.nav.leaderboards')}</Link>
        </div>
      </div>

      {/* Wrestler Dropdowns */}
      <div className="tot-selectors">
        <div className="tot-corner tot-corner-left">
          <select
            value={wrestler1Id}
            onChange={(e) => setWrestler1Id(e.target.value)}
          >
            {wrestlers.map((p) => (
              <option key={p.wrestlerId} value={p.wrestlerId}>
                {p.name} ({p.wrestlerName})
              </option>
            ))}
          </select>
          <div className="tot-corner-name">
            {wrestler1?.name}
          </div>
          <div className="tot-corner-wrestler">{wrestler1?.wrestlerName}</div>
        </div>

        <div className="tot-vs-badge">{t('common.vs')}</div>

        <div className="tot-corner tot-corner-right">
          <select
            value={wrestler2Id}
            onChange={(e) => setWrestler2Id(e.target.value)}
          >
            {wrestlers.map((p) => (
              <option key={p.wrestlerId} value={p.wrestlerId}>
                {p.name} ({p.wrestlerName})
              </option>
            ))}
          </select>
          <div className="tot-corner-name">
            {wrestler2?.name}
          </div>
          <div className="tot-corner-wrestler">{wrestler2?.wrestlerName}</div>
        </div>
      </div>

      <SeasonSelector
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSeasonChange={setSelectedSeasonId}
      />

      {wrestler1Id === wrestler2Id ? (
        <div className="tot-same-wrestler">{t('statistics.headToHead.selectDifferent')}</div>
      ) : loading ? (
        <Skeleton variant="block" count={4} />
      ) : (
        <>
          {/* Boxing-style stat rows */}
          {p1Stats && p2Stats && (
            <div className="tot-card tot-tape-card">
              <div className="tot-tape-header">
                <span className="tot-tape-p1">{wrestler1?.wrestlerName}</span>
                <span className="tot-tape-title">{t('statistics.taleOfTape.comparison')}</span>
                <span className="tot-tape-p2">{wrestler2?.wrestlerName}</span>
              </div>
              <div className="tot-tape-divider" />
              {statRows.map((row) => renderTapeRow(row))}
            </div>
          )}

          {/* Head-to-Head Summary */}
          {h2h && (
            <div className="tot-card tot-h2h-card">
              <h3>{t('statistics.headToHead.headToHeadRecord')}</h3>
              <div className="tot-h2h-summary">
                <div className="tot-h2h-wrestler">
                  <span className="tot-h2h-name">{wrestler1?.name}</span>
                  <span className="tot-h2h-wins">{p1H2HWins}</span>
                </div>
                <div className="tot-h2h-center">
                  <span className="tot-h2h-draws">{h2h.draws} {t('statistics.labels.draws')}</span>
                  <span className="tot-h2h-total">{h2h.totalMatches} {t('statistics.labels.totalMatches')}</span>
                </div>
                <div className="tot-h2h-wrestler">
                  <span className="tot-h2h-wins">{p2H2HWins}</span>
                  <span className="tot-h2h-name">{wrestler2?.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* Advantages Count */}
          {p1Stats && p2Stats && (
            <div className="tot-card tot-advantages-card">
              <h3>{t('statistics.taleOfTape.advantagesSummary')}</h3>
              <div className="tot-adv-row">
                <div className={`tot-adv-wrestler ${p1Advantages > p2Advantages ? 'tot-adv-leader' : ''}`}>
                  <span className="tot-adv-count">{p1Advantages}</span>
                  <span className="tot-adv-name">{wrestler1?.name}</span>
                </div>
                <div className="tot-adv-middle">
                  <span className="tot-adv-tied">
                    {statRows.length - p1Advantages - p2Advantages} {t('statistics.taleOfTape.tied')}
                  </span>
                </div>
                <div className={`tot-adv-wrestler ${p2Advantages > p1Advantages ? 'tot-adv-leader' : ''}`}>
                  <span className="tot-adv-count">{p2Advantages}</span>
                  <span className="tot-adv-name">{wrestler2?.name}</span>
                </div>
              </div>
              <div className="tot-adv-verdict">
                {p1Advantages > p2Advantages
                  ? `${wrestler1?.name} (${wrestler1?.wrestlerName}) ${t('statistics.taleOfTape.hasTheEdge')}`
                  : p2Advantages > p1Advantages
                    ? `${wrestler2?.name} (${wrestler2?.wrestlerName}) ${t('statistics.taleOfTape.hasTheEdge')}`
                    : t('statistics.taleOfTape.evenlyMatched')}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TaleOfTheTape;
