import { useCallback } from 'react';
import { Check, X, Plus, Tag } from 'lucide-react';
import type { DetectedField, FieldType } from '../../../services/documentReplication/types';

const FIELD_TYPES: FieldType[] = ['text', 'number', 'date', 'currency', 'email', 'phone', 'id', 'percentage'];

interface FieldMapperProps {
  fields: DetectedField[];
  onFieldsChange: (fields: DetectedField[]) => void;
  disabled?: boolean;
}

export function FieldMapper({ fields, onFieldsChange, disabled }: FieldMapperProps) {
  const confirm = useCallback(
    (id: string) => {
      onFieldsChange(
        fields.map((f) => (f.id === id ? { ...f, userConfirmed: true } : f))
      );
    },
    [fields, onFieldsChange]
  );

  const reject = useCallback(
    (id: string) => {
      onFieldsChange(fields.filter((f) => f.id !== id));
    },
    [fields, onFieldsChange]
  );

  const setType = useCallback(
    (id: string, type: FieldType) => {
      onFieldsChange(
        fields.map((f) => (f.id === id ? { ...f, type } : f))
      );
    },
    [fields, onFieldsChange]
  );

  const setName = useCallback(
    (id: string, name: string) => {
      onFieldsChange(
        fields.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f))
      );
    },
    [fields, onFieldsChange]
  );

  const addField = useCallback(() => {
    const newField: DetectedField = {
      id: `manual-${Date.now()}`,
      name: 'New field',
      type: 'text',
      page: 1,
      confidence: 1,
      aiSuggested: false,
      userConfirmed: true,
    };
    onFieldsChange([...fields, newField]);
  }, [fields, onFieldsChange]);

  return (
    <div className="replication-field-mapper">
      <div className="replication-field-mapper-header">
        <h4>Variable fields</h4>
        <button type="button" className="replication-btn-add" onClick={addField} disabled={disabled}>
          <Plus size={14} />
          Add field
        </button>
      </div>
      <ul className="replication-field-list">
        {fields.map((f) => (
          <li key={f.id} className={`replication-field-item ${f.userConfirmed ? 'confirmed' : ''}`}>
            <div className="replication-field-row">
              <input
                type="text"
                value={f.name}
                onChange={(e) => setName(f.id, e.target.value)}
                className="replication-field-name"
                placeholder="Field name"
                disabled={disabled}
              />
              <select
                value={f.type}
                onChange={(e) => setType(f.id, e.target.value as FieldType)}
                className="replication-field-type"
                disabled={disabled}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {f.aiSuggested && (
                <span className="replication-field-confidence">
                  {Math.round(f.confidence * 100)}%
                </span>
              )}
              {!f.userConfirmed && (
                <>
                  <button type="button" onClick={() => confirm(f.id)} className="replication-field-btn accept" title="Accept">
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => reject(f.id)} className="replication-field-btn reject" title="Reject">
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
            {f.sampleValue && (
              <div className="replication-field-sample">Sample: {f.sampleValue}</div>
            )}
          </li>
        ))}
      </ul>
      {fields.length === 0 && (
        <p className="replication-field-empty">No fields yet. Add one manually or re-upload a document.</p>
      )}
    </div>
  );
}
