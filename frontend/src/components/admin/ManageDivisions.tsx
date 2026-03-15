import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { divisionsApi, companiesApi } from '../../services/api';
import type { Division, Company } from '../../types';
import Skeleton from '../ui/Skeleton';
import './ManageDivisions.css';

export default function ManageDivisions() {
  const { t } = useTranslation();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    companyId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [divisionsData, companiesData] = await Promise.all([
        divisionsApi.getAll(),
        companiesApi.getAll(),
      ]);
      setDivisions(divisionsData);
      setCompanies(companiesData);
    } catch (_err) {
      setError('Failed to load divisions');
    } finally {
      setLoading(false);
    }
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'None';
    const company = companies.find(c => c.companyId === companyId);
    return company?.name || t('common.unknown');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingDivision) {
        await divisionsApi.update(editingDivision.divisionId, {
          name: formData.name,
          description: formData.description || undefined,
          companyId: formData.companyId || undefined,
        });
        setSuccess('Division updated successfully!');
      } else {
        await divisionsApi.create({
          name: formData.name,
          description: formData.description || undefined,
          companyId: formData.companyId || undefined,
        });
        setSuccess('Division created successfully!');
      }

      setFormData({ name: '', description: '', companyId: '' });
      setShowAddForm(false);
      setEditingDivision(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save division');
    }
  };

  const handleEdit = (division: Division) => {
    setEditingDivision(division);
    setFormData({
      name: division.name,
      description: division.description || '',
      companyId: division.companyId || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (divisionId: string) => {
    if (!confirm('Are you sure you want to delete this division?')) {
      return;
    }

    setDeleting(divisionId);
    setError(null);
    setSuccess(null);

    try {
      await divisionsApi.delete(divisionId);
      setSuccess('Division deleted successfully!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete division');
    } finally {
      setDeleting(null);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', companyId: '' });
    setShowAddForm(false);
    setEditingDivision(null);
  };

  if (loading) {
    return <Skeleton variant="block" count={4} />;
  }

  return (
    <div className="manage-divisions">
      <div className="divisions-header">
        <h2>Manage Divisions</h2>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)}>
            Create Division
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showAddForm && (
        <div className="division-form-container">
          <h3>{editingDivision ? 'Edit Division' : 'Create New Division'}</h3>
          <form onSubmit={handleSubmit} className="division-form">
            <div className="form-group">
              <label htmlFor="name">Division Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Heavyweight, Cruiserweight, Main Event"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description (Optional)</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this division"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="division-company">Company</label>
              <select
                id="division-company"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
              >
                <option value="">No Company</option>
                {companies.map((company) => (
                  <option key={company.companyId} value={company.companyId}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button type="submit">
                {editingDivision ? 'Update Division' : 'Create Division'}
              </button>
              <button type="button" onClick={handleCancel} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divisions-list">
        <h3>All Divisions ({divisions.length})</h3>
        {divisions.length === 0 ? (
          <p>No divisions yet. Create your first division to group wrestlers!</p>
        ) : (
          <div className="divisions-grid">
            {divisions.map(division => (
              <div key={division.divisionId} className="division-card">
                <h4>{division.name}</h4>
                {division.companyId && (
                  <p className="division-company">Company: {getCompanyName(division.companyId)}</p>
                )}
                {division.description && (
                  <p className="division-description">{division.description}</p>
                )}
                <div className="division-actions">
                  <button
                    onClick={() => handleEdit(division)}
                    className="division-edit-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(division.divisionId)}
                    className="division-delete-btn"
                    disabled={deleting === division.divisionId}
                  >
                    {deleting === division.divisionId ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
