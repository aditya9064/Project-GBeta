import { useState, useCallback } from 'react';
import { ChevronRight, FileText, Layers, Type } from 'lucide-react';
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

export function DocumentReplicationAgent({ userId, onBack }: DocumentReplicationAgentProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [data, setData] = useState<Record<string, string>>({});

  const handleUploadComplete = useCallback(
    (uploadedFile: File, id: string, detectedFields: DetectedField[]) => {
      setFile(uploadedFile);
      setTemplateId(id);
      setFields(detectedFields.map((f) => ({ ...f, userConfirmed: f.confidence >= 0.7 })));
      setStep('map');
    },
    []
  );

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
