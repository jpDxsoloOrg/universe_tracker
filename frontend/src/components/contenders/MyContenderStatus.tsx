import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './MyContenderStatus.css';

export default function MyContenderStatus() {
  const { t } = useTranslation();

  // Wrestler-specific contender status requires wrestler authentication,
  // which is not yet implemented. Show a placeholder for now.
  return (
    <div className="my-contender-status">
      <header className="status-header">
        <h2>{t('contenders.myStatus.title')}</h2>
        <p className="subtitle">
          {t('contenders.myStatus.comingSoon', 'This feature will be available once wrestler accounts are set up.')}
        </p>
      </header>
      <div className="championships-status">
        <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>
            {t('contenders.myStatus.requiresAuth', 'Wrestler authentication is required to view your personal contender status.')}
          </p>
          <Link to="/contenders" style={{ color: '#60a5fa', marginTop: '1rem', display: 'inline-block' }}>
            {t('contenders.myStatus.viewRankings', 'View Overall Rankings')}
          </Link>
        </div>
      </div>
    </div>
  );
}
