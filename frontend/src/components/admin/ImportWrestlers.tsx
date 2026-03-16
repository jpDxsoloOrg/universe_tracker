import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { wrestlersApi, companiesApi } from '../../services/api';
import type { BulkImportResponse } from '../../services/api/wrestlers.api';
import type { Company, Wrestler } from '../../types';
import './ImportWrestlers.css';

interface ImportWrestlersProps {
  onImportComplete: () => void;
}

interface ValidationError {
  index: number;
  message: string;
}

type ParsedWrestler = Partial<Wrestler>;

const VALID_ALIGNMENTS = ['face', 'heel', 'tweener'];

/**
 * Parse a CSV line handling quoted fields that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): ParsedWrestler[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const wrestler: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index < values.length && values[index]) {
        wrestler[header] = values[index];
      }
    });
    return wrestler as ParsedWrestler;
  });
}

function validateWrestlers(wrestlers: ParsedWrestler[]): ValidationError[] {
  const errors: ValidationError[] = [];

  wrestlers.forEach((wrestler, index) => {
    if (!wrestler.name || wrestler.name.trim() === '') {
      errors.push({ index, message: 'wrestlers.import.missingName' });
    }

    if (wrestler.alignment && !VALID_ALIGNMENTS.includes(wrestler.alignment)) {
      errors.push({ index, message: 'wrestlers.import.invalidAlignment' });
    }
  });

  return errors;
}

export default function ImportWrestlers({ onImportComplete }: ImportWrestlersProps) {
  const { t } = useTranslation();
  const [parsedWrestlers, setParsedWrestlers] = useState<ParsedWrestler[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    companiesApi.getAll().then(setCompanies).catch(() => {
      // Companies are optional; ignore errors
    });
  }, []);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'json') {
      setError(t('wrestlers.import.invalidFile'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let wrestlers: ParsedWrestler[];

        if (extension === 'json') {
          const parsed: unknown = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            setError(t('wrestlers.import.parseError'));
            return;
          }
          wrestlers = parsed as ParsedWrestler[];
        } else {
          wrestlers = parseCsv(text);
        }

        if (wrestlers.length === 0) {
          setError(t('wrestlers.import.emptyFile'));
          return;
        }

        setParsedWrestlers(wrestlers);
        setValidationErrors(validateWrestlers(wrestlers));
      } catch (_err) {
        setError(t('wrestlers.import.parseError'));
      }
    };
    reader.onerror = () => {
      setError(t('wrestlers.import.parseError'));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedWrestlers.length === 0 || importing) return;

    setImporting(true);
    setError(null);

    try {
      const result = await wrestlersApi.bulkImport(
        parsedWrestlers,
        selectedCompanyId || undefined,
      );
      setImportResult(result);
      if (result.imported > 0) {
        onImportComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wrestlers.import.parseError'));
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setParsedWrestlers([]);
    setValidationErrors([]);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const errorRowIndices = new Set(validationErrors.map(e => e.index));
  const hasValidationErrors = validationErrors.length > 0;

  return (
    <div className="import-wrestlers">
      <div className="import-header">
        <h3>{t('wrestlers.import.title')}</h3>
        <p>{t('wrestlers.import.description')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="file-upload-section">
        <div className="file-actions">
          <div className="file-input-wrapper">
            <label htmlFor="import-file">{t('wrestlers.import.selectFile')}</label>
            <input
              type="file"
              id="import-file"
              ref={fileInputRef}
              accept=".csv,.json"
              onChange={handleFileSelect}
            />
          </div>
          <a
            href="/templates/wrestler-import-template.csv"
            download
            className="template-download-link"
          >
            {t('wrestlers.import.downloadTemplate')}
          </a>
        </div>

        <div className="company-selector">
          <label htmlFor="import-company">{t('wrestlers.import.assignToCompany')}</label>
          <select
            id="import-company"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="">{t('wrestlers.import.noCompany')}</option>
            {companies.map(company => (
              <option key={company.companyId} value={company.companyId}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {parsedWrestlers.length > 0 && !importResult && (
        <div className="preview-section">
          <h4>{t('wrestlers.import.preview')} ({parsedWrestlers.length})</h4>

          {hasValidationErrors && (
            <div className="error-message">
              {validationErrors.map((ve, i) => (
                <div key={i} className="validation-error">
                  #{ve.index + 1}: {t(ve.message)}
                </div>
              ))}
            </div>
          )}

          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Nickname</th>
                  <th>Finisher</th>
                  <th>Weight</th>
                  <th>Height</th>
                  <th>Hometown</th>
                  <th>Alignment</th>
                </tr>
              </thead>
              <tbody>
                {parsedWrestlers.map((wrestler, index) => (
                  <tr key={index} className={errorRowIndices.has(index) ? 'error-row' : ''}>
                    <td>{index + 1}</td>
                    <td>{wrestler.name || ''}</td>
                    <td>{wrestler.nickname || ''}</td>
                    <td>{wrestler.finisher || ''}</td>
                    <td>{wrestler.weight || ''}</td>
                    <td>{wrestler.height || ''}</td>
                    <td>{wrestler.hometown || ''}</td>
                    <td>{wrestler.alignment || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button
              onClick={handleImport}
              disabled={importing || hasValidationErrors}
            >
              {importing ? t('wrestlers.import.importing') : t('wrestlers.import.importButton')}
            </button>
            <button onClick={handleClear} className="cancel-btn">
              {t('wrestlers.import.clear')}
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="results-section">
          <h4>{t('wrestlers.import.results')}</h4>
          <div className="results-summary">
            <span className="result-imported">
              {t('wrestlers.import.imported')}: {importResult.imported}
            </span>
            {importResult.skipped > 0 && (
              <span className="result-skipped">
                {t('wrestlers.import.skipped', 'Skipped (existing)')}: {importResult.skipped}
              </span>
            )}
            <span className="result-failed">
              {t('wrestlers.import.failed')}: {importResult.failed}
            </span>
            <span className="result-total">
              {t('wrestlers.import.total')}: {importResult.total}
            </span>
          </div>

          {importResult.errors.length > 0 && (
            <div className="error-list">
              <h5>{t('wrestlers.import.errors')}</h5>
              <ul>
                {importResult.errors.map((err, i) => (
                  <li key={i}>
                    #{err.index + 1} ({err.name}): {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="import-actions">
            <button onClick={handleClear} className="cancel-btn">
              {t('wrestlers.import.clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
