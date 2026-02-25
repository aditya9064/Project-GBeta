import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';

const ACCEPT = '.pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain';
const MAX_MB = 10;

interface DocumentUploaderProps {
  onUploadComplete: (file: File, templateId: string, fields: import('../../../services/documentReplication/types').DetectedField[]) => void;
  uploadDocument: (file: File, userId: string) => Promise<{ templateId: string; fields?: import('../../../services/documentReplication/types').DetectedField[] }>;
  userId: string;
}

export function DocumentUploader({ onUploadComplete, uploadDocument, userId }: DocumentUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`File must be under ${MAX_MB}MB`);
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const { templateId, fields } = await uploadDocument(file, userId);
        onUploadComplete(file, templateId, fields || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        const isNetwork = /fetch|network|connection|reset/i.test(msg) || msg === 'Failed to fetch';
        setError(isNetwork
          ? 'Cannot reach the server. Start the backend: in the server/ folder run npm run dev (port 3001).'
          : msg);
      } finally {
        setLoading(false);
      }
    },
    [onUploadComplete, uploadDocument, userId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="replication-uploader">
      <div
        className={`replication-dropzone ${dragOver ? 'drag-over' : ''} ${loading ? 'loading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={ACCEPT}
          onChange={onInputChange}
          disabled={loading}
          className="replication-dropzone-input"
        />
        {loading ? (
          <>
            <Loader2 size={32} className="replication-spin" />
            <p>Analyzing document and detecting fields…</p>
          </>
        ) : (
          <>
            <Upload size={32} />
            <p>Drop a PDF or DOCX here, or click to browse</p>
            <span className="replication-dropzone-hint">Max {MAX_MB}MB. We’ll extract text and suggest variable fields.</span>
          </>
        )}
      </div>
      {error && (
        <div className="replication-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
