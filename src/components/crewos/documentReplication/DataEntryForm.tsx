import { useCallback } from 'react';
import type { DetectedField, FieldType } from '../../../services/documentReplication/types';

interface DataEntryFormProps {
  fields: DetectedField[];
  data: Record<string, string>;
  onDataChange: (data: Record<string, string>) => void;
  disabled?: boolean;
}

export function DataEntryForm({ fields, data, onDataChange, disabled }: DataEntryFormProps) {
  const confirmed = fields.filter((f) => f.userConfirmed !== false);

  const setValue = useCallback(
    (fieldId: string, value: string) => {
      onDataChange({ ...data, [fieldId]: value });
    },
    [data, onDataChange]
  );

  const inputType = (type: FieldType): string => {
    if (type === 'date') return 'date';
    if (type === 'number' || type === 'currency' || type === 'percentage') return 'text';
    if (type === 'email') return 'email';
    return 'text';
  };

  return (
    <div className="replication-data-form">
      <h4>Enter values</h4>
      <div className="replication-data-fields">
        {confirmed.map((f) => (
          <div key={f.id} className="replication-data-field">
            <label htmlFor={f.id}>{f.name}</label>
            {typeNeedsTextarea(f.type) ? (
              <textarea
                id={f.id}
                value={data[f.id] ?? ''}
                onChange={(e) => setValue(f.id, e.target.value)}
                placeholder={f.sampleValue}
                rows={2}
                disabled={disabled}
                className="replication-input replication-textarea"
              />
            ) : (
              <input
                id={f.id}
                type={inputType(f.type)}
                value={data[f.id] ?? ''}
                onChange={(e) => setValue(f.id, e.target.value)}
                placeholder={f.sampleValue}
                disabled={disabled}
                className="replication-input"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function typeNeedsTextarea(type: FieldType): boolean {
  return type === 'text';
}
