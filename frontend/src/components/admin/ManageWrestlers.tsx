import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { wrestlersApi, imagesApi, divisionsApi, companiesApi } from '../../services/api';
import { sanitizeName } from '../../utils/sanitize';
import { logger } from '../../utils/logger';
import { FILE_UPLOAD_LIMITS, VALIDATION } from '../../constants';
import {
  DEFAULT_WRESTLER_IMAGE,
  applyImageFallback,
  resolveImageSrc,
} from '../../constants/imageFallbacks';
import type { Wrestler, Division, Company } from '../../types';
import ImportWrestlers from './ImportWrestlers';
import './ManageWrestlers.css';

export default function ManageWrestlers() {
  const { t } = useTranslation();
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);
  const [bulkAssignCompany, setBulkAssignCompany] = useState('');
  const [bulkAssignDivision, setBulkAssignDivision] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    divisionId: '',
    companyId: '',
  });

  // Image upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wrestlersData, divisionsData, companiesData] = await Promise.all([
        wrestlersApi.getAll(),
        divisionsApi.getAll(),
        companiesApi.getAll(),
      ]);
      setWrestlers(wrestlersData);
      setDivisions(divisionsData);
      setCompanies(companiesData);
    } catch (_err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getDivisionName = (divisionId?: string) => {
    if (!divisionId) return 'None';
    const division = divisions.find(d => d.divisionId === divisionId);
    return division?.name || 'Unknown';
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'None';
    const company = companies.find(c => c.companyId === companyId);
    return company?.name || 'Unknown';
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!FILE_UPLOAD_LIMITS.ALLOWED_TYPES.includes(file.type as typeof FILE_UPLOAD_LIMITS.ALLOWED_TYPES[number])) {
        setError(`Invalid file type. Only ${FILE_UPLOAD_LIMITS.ALLOWED_EXTENSIONS} images are allowed.`);
        return;
      }

      // Validate file size
      if (file.size > FILE_UPLOAD_LIMITS.MAX_SIZE) {
        setError(`File too large. Maximum size is ${FILE_UPLOAD_LIMITS.MAX_SIZE_MB}MB.`);
        return;
      }

      setSelectedFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, imageUrl: '' }));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return formData.imageUrl || null;

    try {
      setUploading(true);

      // Get presigned URL with specific error handling
      let uploadUrl: string;
      let imageUrl: string;
      try {
        const response = await imagesApi.generateUploadUrl(
          selectedFile.name,
          selectedFile.type,
          'wrestlers'
        );
        uploadUrl = response.uploadUrl;
        imageUrl = response.imageUrl;
      } catch (err) {
        logger.error('Failed to get upload URL for wrestler image');
        if (err instanceof Error && err.message.includes('401')) {
          throw new Error('Session expired. Please log in again to upload images.');
        }
        throw new Error('Unable to prepare image upload. Please check your connection and try again.');
      }

      // Upload to S3 with specific error handling
      try {
        await imagesApi.uploadToS3(uploadUrl, selectedFile);
      } catch (err) {
        logger.error('Failed to upload wrestler image to storage');
        if (err instanceof TypeError && err.message.includes('network')) {
          throw new Error('Network error during upload. Please check your internet connection and try again.');
        }
        throw new Error('Failed to upload image to storage. Please try again or use a different image.');
      }

      return imageUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || uploading) return; // Prevent double submission

    setError(null);
    setSubmitting(true);

    try {
      // Upload image first if one is selected
      const imageUrl = await uploadImage();

      // Sanitize inputs before sending to API
      const sanitizedName = sanitizeName(formData.name, VALIDATION.MAX_NAME_LENGTH);

      if (!sanitizedName) {
        setError('Name cannot be empty');
        return;
      }

      if (editingWrestler) {
        await wrestlersApi.update(editingWrestler.wrestlerId, {
          name: sanitizedName,
          imageUrl: imageUrl || undefined,
          divisionId: formData.divisionId || undefined,
          companyId: formData.companyId || undefined,
        });
      } else {
        await wrestlersApi.create({
          name: sanitizedName,
          imageUrl: imageUrl || undefined,
          divisionId: formData.divisionId || undefined,
          companyId: formData.companyId || undefined,
          wins: 0,
          losses: 0,
          draws: 0,
        });
      }

      setFormData({ name: '', imageUrl: '', divisionId: '', companyId: '' });
      setSelectedFile(null);
      setImagePreview(null);
      setShowAddForm(false);
      setEditingWrestler(null);
      setSuccess(editingWrestler ? 'Wrestler updated successfully!' : 'Wrestler created successfully!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wrestler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (wrestler: Wrestler) => {
    setEditingWrestler(wrestler);
    setFormData({
      name: wrestler.name,
      imageUrl: wrestler.imageUrl || '',
      divisionId: wrestler.divisionId || '',
      companyId: wrestler.companyId || '',
    });
    setImagePreview(wrestler.imageUrl || null);
    setSelectedFile(null);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', imageUrl: '', divisionId: '', companyId: '' });
    setSelectedFile(null);
    setImagePreview(null);
    setShowAddForm(false);
    setEditingWrestler(null);
  };

  const handleDelete = async (wrestlerId: string, wrestlerName: string) => {
    if (!confirm(`Are you sure you want to delete ${wrestlerName}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(wrestlerId);
    setError(null);
    setSuccess(null);

    try {
      await wrestlersApi.delete(wrestlerId);
      setSuccess('Wrestler deleted successfully!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete wrestler');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelect = (wrestlerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wrestlerId)) next.delete(wrestlerId);
      else next.add(wrestlerId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === wrestlers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(wrestlers.map((w) => w.wrestlerId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} wrestler(s)? This cannot be undone.`)) return;

    setBulkAction(true);
    setError(null);
    setSuccess(null);
    const errors: string[] = [];
    let deleted = 0;

    for (const id of selectedIds) {
      try {
        await wrestlersApi.delete(id);
        deleted++;
      } catch (err) {
        const name = wrestlers.find((w) => w.wrestlerId === id)?.name || id;
        errors.push(`${name}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }

    setSelectedIds(new Set());
    setBulkAction(false);
    await loadData();

    if (errors.length > 0) {
      setError(`Deleted ${deleted}, failed ${errors.length}: ${errors.join('; ')}`);
    } else {
      setSuccess(`${deleted} wrestler(s) deleted successfully!`);
    }
  };

  const handleBulkAssignCompany = async () => {
    if (selectedIds.size === 0) return;
    const companyName = bulkAssignCompany
      ? companies.find((c) => c.companyId === bulkAssignCompany)?.name || 'selected company'
      : 'No Company';
    if (!confirm(`Assign ${selectedIds.size} wrestler(s) to ${companyName}?`)) return;

    setBulkAction(true);
    setError(null);
    setSuccess(null);
    let updated = 0;

    for (const id of selectedIds) {
      try {
        await wrestlersApi.update(id, { companyId: bulkAssignCompany || undefined });
        updated++;
      } catch (_err) {
        // continue with others
      }
    }

    setSelectedIds(new Set());
    setBulkAssignCompany('');
    setBulkAction(false);
    await loadData();
    setSuccess(`${updated} wrestler(s) assigned to ${companyName}!`);
  };

  const handleBulkAssignDivision = async () => {
    if (selectedIds.size === 0) return;
    const divisionName = bulkAssignDivision
      ? divisions.find((d) => d.divisionId === bulkAssignDivision)?.name || 'selected division'
      : 'No Division';
    if (!confirm(`Assign ${selectedIds.size} wrestler(s) to ${divisionName}?`)) return;

    setBulkAction(true);
    setError(null);
    setSuccess(null);
    let updated = 0;

    for (const id of selectedIds) {
      try {
        await wrestlersApi.update(id, { divisionId: bulkAssignDivision || undefined });
        updated++;
      } catch (_err) {
        // continue
      }
    }

    setSelectedIds(new Set());
    setBulkAssignDivision('');
    setBulkAction(false);
    await loadData();
    setSuccess(`${updated} wrestler(s) assigned to ${divisionName}!`);
  };

  // Determine if all selected wrestlers share the same company (for division assignment)
  const selectedWrestlers = wrestlers.filter((w) => selectedIds.has(w.wrestlerId));
  const selectedCompanyIds = new Set(selectedWrestlers.map((w) => w.companyId || ''));
  const sharedCompanyId = selectedCompanyIds.size === 1 ? [...selectedCompanyIds][0] : null;
  const eligibleDivisions = sharedCompanyId
    ? divisions.filter((d) => d.companyId === sharedCompanyId)
    : [];

  if (loading) {
    return <div className="loading">Loading wrestlers...</div>;
  }

  return (
    <div className="manage-wrestlers">
      <div className="wrestlers-header">
        <div>
          <h2>Manage Wrestlers</h2>
          <p className="wrestlers-subtext">
            Edit existing wrestlers, assign divisions, and keep wrestler profiles current. Need process
            details? <Link to="/guide/wiki/admin-manage-wrestlers">Learn more</Link>.
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className={showImport ? 'cancel-btn' : ''}
        >
          {showImport ? t('wrestlers.import.backToList') : t('wrestlers.import.title')}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showImport && (
        <ImportWrestlers
          onImportComplete={() => {
            setShowImport(false);
            loadData();
          }}
        />
      )}

      {!showImport && showAddForm && (
        <div className="wrestler-form-container">
          <h3>{editingWrestler ? 'Edit Wrestler' : 'Add New Wrestler'}</h3>
          <form onSubmit={handleSubmit} className="wrestler-form">
            <div className="form-group">
              <label htmlFor="name">Wrestler Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="form-group">
              <label htmlFor="division">Division</label>
              <select
                id="division"
                value={formData.divisionId}
                onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
              >
                <option value="">No Division</option>
                {divisions.map((division) => (
                  <option key={division.divisionId} value={division.divisionId}>
                    {division.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="company">Company</label>
              <select
                id="company"
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

            <div className="form-group">
              <label htmlFor="image">Wrestler Image</label>
              <div className="image-upload-container">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button type="button" onClick={clearImage} className="remove-image-btn">
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div className="image-upload-box">
                    <input
                      type="file"
                      id="image"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileSelect}
                      className="file-input"
                    />
                    <label htmlFor="image" className="file-input-label">
                      Click to upload image
                    </label>
                    <p className="upload-hint">{FILE_UPLOAD_LIMITS.ALLOWED_EXTENSIONS} (max {FILE_UPLOAD_LIMITS.MAX_SIZE_MB}MB)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting || uploading}>
                {submitting ? 'Saving...' : uploading ? 'Uploading...' : editingWrestler ? 'Update Wrestler' : 'Add Wrestler'}
              </button>
              <button type="button" onClick={handleCancel} className="cancel-btn" disabled={submitting || uploading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!showImport && <div className="wrestlers-list">
        <h3>All Wrestlers ({wrestlers.length})</h3>

        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <span className="bulk-selected-count">{selectedIds.size} selected</span>
            <div className="bulk-actions">
              <div className="bulk-assign-group">
                <select
                  value={bulkAssignCompany}
                  onChange={(e) => setBulkAssignCompany(e.target.value)}
                  disabled={bulkAction}
                >
                  <option value="">No Company</option>
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssignCompany}
                  disabled={bulkAction}
                  className="bulk-assign-btn"
                >
                  {bulkAction ? 'Assigning...' : 'Assign Company'}
                </button>
              </div>
              {sharedCompanyId && eligibleDivisions.length > 0 && (
                <div className="bulk-assign-group">
                  <select
                    value={bulkAssignDivision}
                    onChange={(e) => setBulkAssignDivision(e.target.value)}
                    disabled={bulkAction}
                  >
                    <option value="">No Division</option>
                    {eligibleDivisions.map((division) => (
                      <option key={division.divisionId} value={division.divisionId}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssignDivision}
                    disabled={bulkAction}
                    className="bulk-assign-btn"
                  >
                    Assign Division
                  </button>
                </div>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={bulkAction}
                className="bulk-delete-btn"
              >
                {bulkAction ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        )}

        {wrestlers.length === 0 ? (
          <p>No wrestlers yet. Add your first wrestler!</p>
        ) : (
          <div className="wrestlers-table-wrapper">
          <table className="wrestlers-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === wrestlers.length && wrestlers.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Image</th>
                <th>Wrestler Name</th>
                <th>Company</th>
                <th>Division</th>
                <th>Record</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wrestlers.map((wrestler) => (
                <tr
                  key={wrestler.wrestlerId}
                  className={selectedIds.has(wrestler.wrestlerId) ? 'row-selected' : ''}
                >
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(wrestler.wrestlerId)}
                      onChange={() => toggleSelect(wrestler.wrestlerId)}
                    />
                  </td>
                  <td>
                    <img
                      src={resolveImageSrc(wrestler.imageUrl, DEFAULT_WRESTLER_IMAGE)}
                      onError={(event) => applyImageFallback(event, DEFAULT_WRESTLER_IMAGE)}
                      alt={wrestler.name}
                      className="wrestler-thumbnail"
                    />
                  </td>
                  <td>{wrestler.name}</td>
                  <td className="company-cell">{getCompanyName(wrestler.companyId)}</td>
                  <td className="division-cell">{getDivisionName(wrestler.divisionId)}</td>
                  <td>
                    <span className="record">
                      {wrestler.wins}W - {wrestler.losses}L - {wrestler.draws}D
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        onClick={() => handleEdit(wrestler)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(wrestler.wrestlerId, wrestler.name)}
                        className="delete-btn"
                        disabled={deleting === wrestler.wrestlerId}
                      >
                        {deleting === wrestler.wrestlerId ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>}
    </div>
  );
}
