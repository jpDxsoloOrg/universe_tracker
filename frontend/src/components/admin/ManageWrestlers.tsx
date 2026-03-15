import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { wrestlersApi, imagesApi, divisionsApi } from '../../services/api';
import { sanitizeName } from '../../utils/sanitize';
import { logger } from '../../utils/logger';
import { FILE_UPLOAD_LIMITS, VALIDATION } from '../../constants';
import {
  DEFAULT_WRESTLER_IMAGE,
  applyImageFallback,
  resolveImageSrc,
} from '../../constants/imageFallbacks';
import type { Wrestler, Division } from '../../types';
import './ManageWrestlers.css';

export default function ManageWrestlers() {
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    divisionId: '',
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
      const [wrestlersData, divisionsData] = await Promise.all([
        wrestlersApi.getAll(),
        divisionsApi.getAll(),
      ]);
      setWrestlers(wrestlersData);
      setDivisions(divisionsData);
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
        });
      } else {
        await wrestlersApi.create({
          name: sanitizedName,
          imageUrl: imageUrl || undefined,
          divisionId: formData.divisionId || undefined,
          wins: 0,
          losses: 0,
          draws: 0,
        });
      }

      setFormData({ name: '', imageUrl: '', divisionId: '' });
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
    });
    setImagePreview(wrestler.imageUrl || null);
    setSelectedFile(null);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', imageUrl: '', divisionId: '' });
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
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showAddForm && (
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

      <div className="wrestlers-list">
        <h3>All Wrestlers ({wrestlers.length})</h3>
        {wrestlers.length === 0 ? (
          <p>No wrestlers yet. Add your first wrestler!</p>
        ) : (
          <div className="wrestlers-table-wrapper">
          <table className="wrestlers-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Wrestler Name</th>
                <th>Division</th>
                <th>Record</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wrestlers.map((wrestler) => (
                <tr key={wrestler.wrestlerId}>
                  <td>
                    <img
                      src={resolveImageSrc(wrestler.imageUrl, DEFAULT_WRESTLER_IMAGE)}
                      onError={(event) => applyImageFallback(event, DEFAULT_WRESTLER_IMAGE)}
                      alt={wrestler.name}
                      className="wrestler-thumbnail"
                    />
                  </td>
                  <td>{wrestler.name}</td>
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
      </div>
    </div>
  );
}
