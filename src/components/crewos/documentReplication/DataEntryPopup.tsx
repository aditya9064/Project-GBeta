import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { DetectedField, FieldType } from '../../../services/documentReplication/types';

interface DataEntryPopupProps {
  fields: DetectedField[];
  data: Record<string, string>;
  documentType: string;
  onSubmit: (data: Record<string, string>) => void;
  onClose: () => void;
}

export function DataEntryPopup({ fields, data: initialData, documentType, onSubmit, onClose }: DataEntryPopupProps) {
  const [formData, setFormData] = useState<Record<string, string>>({ ...initialData });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Focus first empty required field
    const firstEmpty = fields.find(f => !formData[f.id]?.trim());
    if (firstEmpty) {
      setFocusedField(firstEmpty.id);
    }
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleChange = useCallback((fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const filledCount = fields.filter(f => formData[f.id]?.trim()).length;
  const progress = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 100;
  const allFilled = filledCount === fields.length;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  }, [formData, onSubmit]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const inputType = (type: FieldType): string => {
    if (type === 'date') return 'date';
    if (type === 'email') return 'email';
    return 'text';
  };

  const getPlaceholder = (field: DetectedField): string => {
    if (field.sampleValue) return `e.g. ${field.sampleValue}`;
    switch (field.type) {
      case 'date': return 'Select a date';
      case 'email': return 'email@example.com';
      case 'phone': return '(555) 123-4567';
      case 'currency': return '$0.00';
      case 'percentage': return '0%';
      default: return `Enter ${field.name.toLowerCase()}`;
    }
  };

  const getFieldIcon = (type: FieldType): string => {
    switch (type) {
      case 'date': return '📅';
      case 'email': return '✉️';
      case 'phone': return '📞';
      case 'currency': return '💰';
      case 'percentage': return '📊';
      case 'id': return '🔢';
      case 'number': return '#';
      default: return '📝';
    }
  };

  return (
    <div className="data-popup-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="data-popup">
        {/* Header */}
        <div className="data-popup-header">
          <div className="data-popup-header-left">
            <div className="data-popup-header-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="data-popup-title">Fill in Document Fields</h2>
              <p className="data-popup-subtitle">
                Enter the values for your new {documentType}. These fields were detected from your uploaded document.
              </p>
            </div>
          </div>
          <button type="button" className="data-popup-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="data-popup-progress">
          <div className="data-popup-progress-bar">
            <div
              className="data-popup-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="data-popup-progress-label">
            {filledCount} of {fields.length} fields completed
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="data-popup-form">
          <div className="data-popup-fields">
            {fields.map((field, i) => {
              const isFilled = !!formData[field.id]?.trim();
              const isActive = focusedField === field.id;

              return (
                <div
                  key={field.id}
                  className={`data-popup-field ${isFilled ? 'filled' : ''} ${isActive ? 'active' : ''}`}
                >
                  <div className="data-popup-field-header">
                    <span className="data-popup-field-icon">{getFieldIcon(field.type)}</span>
                    <label htmlFor={`popup-${field.id}`} className="data-popup-field-label">
                      {field.name}
                    </label>
                    <span className="data-popup-field-type">{field.type}</span>
                    {isFilled && <CheckCircle2 size={14} className="data-popup-field-check" />}
                  </div>

                  {field.type === 'text' && field.name.toLowerCase().includes('address') ? (
                    <textarea
                      id={`popup-${field.id}`}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onFocus={() => setFocusedField(field.id)}
                      onBlur={() => setFocusedField(null)}
                      placeholder={getPlaceholder(field)}
                      rows={2}
                      className="data-popup-input data-popup-textarea"
                      ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                    />
                  ) : (
                    <input
                      id={`popup-${field.id}`}
                      type={inputType(field.type)}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onFocus={() => setFocusedField(field.id)}
                      onBlur={() => setFocusedField(null)}
                      placeholder={getPlaceholder(field)}
                      className="data-popup-input"
                      ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                    />
                  )}

                  {field.sampleValue && !isFilled && (
                    <button
                      type="button"
                      className="data-popup-field-autofill"
                      onClick={() => handleChange(field.id, field.sampleValue!)}
                    >
                      Use sample: {field.sampleValue.slice(0, 40)}
                      {field.sampleValue.length > 40 ? '...' : ''}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="data-popup-footer">
            {!allFilled && (
              <div className="data-popup-footer-warning">
                <AlertCircle size={14} />
                <span>Some fields are empty. You can fill them now or leave blank.</span>
              </div>
            )}
            <div className="data-popup-footer-actions">
              <button type="button" className="data-popup-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="data-popup-btn-primary">
                <FileText size={16} />
                Generate Document
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
