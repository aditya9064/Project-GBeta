import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Layers, Type, Database } from 'lucide-react';
import { DocumentUploader } from './DocumentUploader';
import { DocumentViewer } from './DocumentViewer';
import { FieldMapper } from './FieldMapper';
import { DataEntryForm } from './DataEntryForm';
import { DocumentGenerator } from './DocumentGenerator';
import { uploadDocument } from '../../../services/documentReplication/api';
import type { DetectedField } from '../../../services/documentReplication/types';
import './DocumentReplication.css';

type Step = 'upload' | 'map' | 'data' | 'generate';

interface DocumentReplicationAgentProps {
  userId: string;
  onBack?: () => void;
}

interface SavedTemplate {
  id: string;
  name: string;
  originalFileName: string;
  fields: DetectedField[];
  savedAt: string;
}

export function DocumentReplicationAgent({ userId, onBack }: DocumentReplicationAgentProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [data, setData] = useState<Record<string, string>>({});

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [savedTemplatesOpen, setSavedTemplatesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/documents/templates?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) setSavedTemplates(json.templates || []);
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleUploadComplete = useCallback(
    async (uploadedFile: File, id: string, detectedFields: DetectedField[]) => {
      setFile(uploadedFile);
      setTemplateId(id);
      setFields(detectedFields.map((f) => ({ ...f, userConfirmed: f.confidence >= 0.7 })));
      setStep('map');

      try {
        const res = await fetch('http://localhost:3001/api/documents/templates/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: id,
            name: uploadedFile.name,
            userId,
            fields: detectedFields,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.template) {
            setSavedTemplates(prev => [json.template, ...prev.filter(t => t.id !== id)]);
          }
        }
      } catch { /* save non-fatal */ }
    },
    [userId]
  );

  const loadSavedTemplate = useCallback((tpl: SavedTemplate) => {
    setTemplateId(tpl.id);
    setFields(tpl.fields.map(f => ({ ...f, userConfirmed: f.confidence >= 0.7 })));
    setFile(null);
    setStep('map');
    setSavedTemplatesOpen(false);
  }, []);

  const goToDataEntry = useCallback(() => {
    const confirmed = fields.filter((f) => f.userConfirmed !== false);
    if (confirmed.length > 0) {
      setData((prev) => {
        const next = { ...prev };
        confirmed.forEach((f) => {
          if (f.sampleValue && next[f.id] === undefined) next[f.id] = f.sampleValue;
        });
        return next;
      });
      setStep('data');
    }
  }, [fields]);

  const goToGenerate = useCallback(() => setStep('generate'), []);

  return (
    <div className="replication-agent">
      <div className="replication-agent-header">
        {onBack && (
          <button type="button" className="replication-back" onClick={onBack}>
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            Back
          </button>
        )}
        <h2 className="replication-agent-title">Document Replication</h2>
        <p className="replication-agent-subtitle">
          Upload a template, map variable fields, fill in data, and generate new documents.
        </p>
        {savedTemplates.length > 0 && (
          <div style={{ position: 'relative', marginTop: 8 }}>
            <button
              type="button"
              className="replication-back"
              onClick={() => setSavedTemplatesOpen(!savedTemplatesOpen)}
              style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}
            >
              <Database size={14} />
              Saved Templates ({savedTemplates.length})
              <ChevronDown size={14} style={{ transform: savedTemplatesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {savedTemplatesOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 20,
                background: 'var(--bg-secondary, #1e1e2e)', border: '1px solid var(--border, #2a2a3e)',
                borderRadius: 8, padding: 4, minWidth: 260, maxHeight: 220, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', marginTop: 4,
              }}>
                {savedTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => loadSavedTemplate(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', background: 'none', border: 'none',
                      color: 'var(--text-primary, #e0e0e0)', cursor: 'pointer',
                      borderRadius: 6, fontSize: 13, textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #2a2a3e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <FileText size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tpl.name || tpl.originalFileName}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>
                      {tpl.fields?.length || 0} fields
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="replication-steps">
          {[
            { id: 'upload' as const, label: 'Upload', icon: FileText },
            { id: 'map' as const, label: 'Map fields', icon: Layers },
            { id: 'data' as const, label: 'Data', icon: Type },
            { id: 'generate' as const, label: 'Generate', icon: FileText },
          ].map((s, i) => (
            <div
              key={s.id}
              className={`replication-step ${step === s.id ? 'active' : ''} ${stepOrder(step) > i ? 'done' : ''}`}
            >
              {i > 0 && <span className="replication-step-connector" />}
              <span className="replication-step-dot">
                <s.icon size={14} />
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="replication-agent-content">
        {step === 'upload' && (
          <DocumentUploader
            onUploadComplete={handleUploadComplete}
            uploadDocument={uploadDocument}
            userId={userId}
          />
        )}

        {step === 'map' && templateId && (
          <div className="replication-map-layout">
            <div className="replication-map-viewer">
              <DocumentViewer file={file} />
            </div>
            <div className="replication-map-sidebar">
              <FieldMapper fields={fields} onFieldsChange={setFields} />
              <button type="button" className="replication-btn-primary replication-next" onClick={goToDataEntry}>
                Continue to data entry
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 'data' && (
          <div className="replication-data-layout">
            <DataEntryForm
              fields={fields}
              data={data}
              onDataChange={setData}
            />
            <button type="button" className="replication-btn-primary replication-next" onClick={goToGenerate}>
              Continue to generate
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 'generate' && templateId && (
          <div className="replication-generate-layout">
            <DataEntryForm fields={fields} data={data} onDataChange={setData} disabled />
            <DocumentGenerator
              templateId={templateId}
              fields={fields}
              data={data}
              suggestedFileName={file ? file.name.replace(/\.[^.]+$/, '') + '_generated.pdf' : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function stepOrder(step: Step): number {
  const order: Record<Step, number> = { upload: 0, map: 1, data: 2, generate: 3 };
  return order[step] ?? 0;
}
