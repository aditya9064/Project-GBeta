import { useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface DocumentViewerProps {
  file: File | null;
  fileUrl?: string | null;
  className?: string;
}

export function DocumentViewer({ file, fileUrl, className = '' }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const objectUrl = useMemo(() => {
    if (fileUrl && (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:'))) return fileUrl;
    if (file) return URL.createObjectURL(file);
    return null;
  }, [file, fileUrl]);

  if (!objectUrl && !file) {
    return (
      <div className={`replication-viewer replication-viewer-empty ${className}`}>
        <p>No document to display</p>
      </div>
    );
  }

  const isPdf = file?.type === 'application/pdf' || (typeof fileUrl === 'string' && fileUrl.includes('pdf'));
  const isImage = file?.type?.startsWith('image/');

  return (
    <div className={`replication-viewer ${className}`}>
      <div className="replication-viewer-toolbar">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">
          <ZoomOut size={18} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} aria-label="Zoom in">
          <ZoomIn size={18} />
        </button>
      </div>
      <div className="replication-viewer-content" style={{ transform: `scale(${zoom})` }}>
        {isPdf && (
          <object
            data={objectUrl || undefined}
            type="application/pdf"
            className="replication-viewer-object"
            title="PDF preview"
          >
            <p>PDF preview not supported. Download the file to view.</p>
          </object>
        )}
        {isImage && (
          <img src={objectUrl || undefined} alt="Document" className="replication-viewer-img" />
        )}
        {!isPdf && !isImage && objectUrl && (
          <iframe src={objectUrl} title="Document" className="replication-viewer-object" />
        )}
      </div>
    </div>
  );
}
