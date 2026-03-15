import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { statisticsApi } from '../../services/api';
import type { StatsWrestler } from '../../services/api';
import type { Achievement } from '../../types/statistics';
import Skeleton from '../ui/Skeleton';
import './Achievements.css';

type FilterType = 'all' | 'milestone' | 'record' | 'special';

function Achievements() {
  const { t } = useTranslation();
  const [wrestlers, setWrestlers] = useState<StatsWrestler[]>([]);
  const [selectedWrestlerId, setSelectedWrestlerId] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [allAchievementDefs, setAllAchievementDefs] = useState<Omit<Achievement, 'wrestlerId' | 'earnedAt'>[]>([]);
  const [wrestlerAchievements, setWrestlerAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  // Load wrestler list and achievement definitions on mount
  useEffect(() => {
    const abortController = new AbortController();
    const fetchInitial = async () => {
      try {
        const result = await statisticsApi.getAchievements(undefined, abortController.signal);
        setWrestlers(result.wrestlers);
        setAllAchievementDefs(result.allAchievements);
        if (result.wrestlers.length > 0 && result.wrestlers[0]) {
          setSelectedWrestlerId(result.wrestlers[0].wrestlerId);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load achievements', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
    return () => abortController.abort();
  }, []);

  // Load achievements for selected wrestler
  useEffect(() => {
    if (!selectedWrestlerId) return;
    const abortController = new AbortController();
    const fetchWrestlerAchievements = async () => {
      try {
        const result = await statisticsApi.getAchievements(selectedWrestlerId, abortController.signal);
        setWrestlerAchievements(result.achievements || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load wrestler achievements', err);
        }
      }
    };
    fetchWrestlerAchievements();
    return () => abortController.abort();
  }, [selectedWrestlerId]);

  const earnedIds = useMemo(
    () => new Set(wrestlerAchievements.map((a) => a.achievementId)),
    [wrestlerAchievements]
  );

  const filteredAchievements = useMemo(() => {
    return allAchievementDefs.filter(
      (a) => activeFilter === 'all' || a.achievementType === activeFilter
    );
  }, [allAchievementDefs, activeFilter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('statistics.achievements.filters.all') },
    { key: 'milestone', label: t('statistics.achievements.filters.milestones') },
    { key: 'record', label: t('statistics.achievements.filters.records') },
    { key: 'special', label: t('statistics.achievements.filters.special') },
  ];

  const wrestler = wrestlers.find((p) => p.wrestlerId === selectedWrestlerId);

  const earnedCount = filteredAchievements.filter((a) => earnedIds.has(a.achievementId)).length;
  const totalCount = filteredAchievements.length;

  if (loading) {
    return (
      <div className="achievements-page">
        <h2>{t('statistics.achievements.title')}</h2>
        <Skeleton variant="block" count={4} />
      </div>
    );
  }

  return (
    <div className="achievements-page">
      <div className="ach-header">
        <h2>{t('statistics.achievements.title')}</h2>
        <div className="ach-nav-links">
          <Link to="/stats">{t('statistics.nav.wrestlerStats')}</Link>
          <Link to="/stats/records">{t('statistics.nav.records')}</Link>
          <Link to="/stats/leaderboards">{t('statistics.nav.leaderboards')}</Link>
        </div>
      </div>

      {/* Wrestler Selector */}
      <div className="ach-wrestler-selector">
        <label htmlFor="ach-wrestler-select">{t('statistics.wrestlerStats.selectWrestler')}</label>
        <select
          id="ach-wrestler-select"
          value={selectedWrestlerId}
          onChange={(e) => setSelectedWrestlerId(e.target.value)}
        >
          {wrestlers.map((p) => (
            <option key={p.wrestlerId} value={p.wrestlerId}>
              {p.name} ({p.wrestlerName})
            </option>
          ))}
        </select>
      </div>

      {/* Wrestler Summary */}
      <div className="ach-summary">
        <span className="ach-summary-name">
          {wrestler?.name} ({wrestler?.wrestlerName})
        </span>
        <span className="ach-summary-count">
          {earnedCount}/{totalCount} {t('statistics.achievements.earned')}
        </span>
        <div className="ach-progress-bar">
          <div
            className="ach-progress-fill"
            style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="ach-filters">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`ach-filter-btn ${activeFilter === f.key ? 'ach-filter-active' : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="ach-grid">
        {filteredAchievements.map((achievement) => {
          const earned = earnedIds.has(achievement.achievementId);
          const earnedAch = earned
            ? wrestlerAchievements.find((a) => a.achievementId === achievement.achievementId)
            : null;

          return (
            <div
              key={achievement.achievementId}
              className={`ach-card ${earned ? 'ach-card-earned' : 'ach-card-locked'}`}
            >
              <div className={`ach-icon ${earned ? '' : 'ach-icon-locked'}`}>
                {achievement.icon}
              </div>
              <div className="ach-info">
                <span className="ach-name">{achievement.achievementName}</span>
                <span className="ach-desc">{achievement.description}</span>
                <span className="ach-type-badge" data-type={achievement.achievementType}>
                  {achievement.achievementType}
                </span>
              </div>
              {earned && earnedAch && (
                <div className="ach-earned-date">
                  {t('statistics.achievements.earnedOn')} {earnedAch.earnedAt}
                </div>
              )}
              {!earned && (
                <div className="ach-locked-label">{t('statistics.achievements.locked')}</div>
              )}
            </div>
          );
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="ach-empty">
          {t('statistics.achievements.noAchievements')}
        </div>
      )}
    </div>
  );
}

export default Achievements;
