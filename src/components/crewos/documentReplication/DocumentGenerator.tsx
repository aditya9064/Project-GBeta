import { useState, useCallback } from 'react';
import { FileDown, Loader2, Eye, AlertCircle } from 'lucide-react';
import type { DetectedField, OutputFormat } from '../../../services/documentReplication/types';
import { generateReplicationDocument } from '../../../services/documentReplication/api';

interface DocumentGeneratorProps {
  templateId: string;
  fields: DetectedField[];
  data: Record<string, string>;
  suggestedFileName?: string;
  disabled?: boolean;
}

export function DocumentGenerator({
  templateId,
  fields,
  data,
  suggestedFileName,
  disabled,
}: DocumentGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const confirmedFields = fields.filter((f) => f.userConfirmed !== false);

  const handleGenerate = useCallback(
    async (format: OutputFormat = 'pdf') => {
      if (!templateId || confirmedFields.length === 0) return;
      setError(null);
      setLoading(true);
      setPreviewUrl(null);
      try {
        const res = await generateReplicationDocument({
          templateId,
          fieldMappings: confirmedFields,
          data,
          outputFormat: format,
          fileName: suggestedFileName || `Generated_${Date.now()}.pdf`,
        });
        if (res.generatedUrl) {
          setPreviewUrl(res.generatedUrl);
        } else {
          setError(res.error || 'No download URL returned');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Generation failed');
      } finally {
        setLoading(false);
      }
    },
    [templateId, confirmedFields, data, suggestedFileName]
  );

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = suggestedFileName || `document_${Date.now()}.pdf`;
    a.click();
  }, [previewUrl, suggestedFileName]);

  return (
    <div className="replication-generator">
      <h4>Generate document</h4>
      <div className="replication-generator-actions">
        <button
          type="button"
          className="replication-btn-primary"
          onClick={() => handleGenerate('pdf')}
          disabled={disabled || loading || confirmedFields.length === 0}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="replication-spin" />
              Generating…
            </>
          ) : (
            <>
              <FileDown size={16} />
              Generate PDF
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="replication-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {previewUrl && (
        <div className="replication-preview">
          <p>Preview ready.</p>
          <div className="replication-preview-actions">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="replication-btn-secondary">
              <Eye size={14} />
              Open in new tab
            </a>
            <button type="button" className="replication-btn-primary" onClick={handleDownload}>
              <FileDown size={14} />
              Download PDF
            </button>
          </div>
          <iframe
            src={previewUrl}
            title="Generated document preview"
            className="replication-preview-iframe"
          />
        </div>
      )}
    </div>
  );
}
