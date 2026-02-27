import { useState, useCallback } from 'react';
import { X, AlertCircle, Send, Loader2, Key, Mail, Type, List, Lock } from 'lucide-react';
import type { RequiredInputField } from '../../services/automation/executionEngine';
import './UserInputModal.css';

interface UserInputModalProps {
  nodeName: string;
  message?: string;
  requiredInputs: RequiredInputField[];
  onSubmit: (inputs: Record<string, any>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function UserInputModal({
  nodeName,
  message,
  requiredInputs,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: UserInputModalProps) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    requiredInputs.forEach(field => {
      initial[field.key] = '';
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validateAndSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    requiredInputs.forEach(field => {
      if (field.required && !values[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
      if (field.type === 'email' && values[field.key]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(values[field.key].trim())) {
          newErrors[field.key] = 'Please enter a valid email address';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(values);
  }, [requiredInputs, values, onSubmit]);

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail size={16} />;
      case 'password':
        return <Lock size={16} />;
      case 'select':
        return <List size={16} />;
      case 'oauth':
        return <Key size={16} />;
      default:
        return <Type size={16} />;
    }
  };

  return (
    <div className="uim-overlay" onClick={onCancel}>
      <div className="uim-modal" onClick={e => e.stopPropagation()}>
        <div className="uim-header">
          <div className="uim-header-content">
            <div className="uim-header-icon">
              <AlertCircle size={20} />
            </div>
            <div className="uim-header-text">
              <h3 className="uim-title">Input Required</h3>
              <p className="uim-subtitle">{nodeName}</p>
            </div>
          </div>
          <button className="uim-close" onClick={onCancel} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        {message && (
          <div className="uim-message">
            {message}
          </div>
        )}

        <div className="uim-body">
          <div className="uim-fields">
            {requiredInputs.map(field => (
              <div key={field.key} className={`uim-field ${errors[field.key] ? 'error' : ''}`}>
                <label className="uim-label" htmlFor={`uim-${field.key}`}>
                  {getFieldIcon(field.type)}
                  <span>{field.label}</span>
                  {field.required && <span className="uim-required">*</span>}
                </label>
                
                {field.description && (
                  <p className="uim-description">{field.description}</p>
                )}

                {field.type === 'select' && field.options ? (
                  <select
                    id={`uim-${field.key}`}
                    className="uim-input uim-select"
                    value={values[field.key]}
                    onChange={e => handleChange(field.key, e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Select an option...</option>
                    {field.options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'oauth' ? (
                  <button
                    className="uim-oauth-btn"
                    onClick={() => {
                      // Would trigger OAuth flow here
                      handleChange(field.key, 'oauth-pending');
                    }}
                    disabled={isSubmitting}
                  >
                    <Key size={16} />
                    Connect {field.oauthProvider || 'Service'}
                  </button>
                ) : (
                  <input
                    id={`uim-${field.key}`}
                    type={field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
                    className="uim-input"
                    value={values[field.key]}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={isSubmitting}
                    autoFocus={requiredInputs.indexOf(field) === 0}
                  />
                )}

                {errors[field.key] && (
                  <span className="uim-error">{errors[field.key]}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="uim-footer">
          <button 
            className="uim-btn uim-btn-cancel" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="uim-btn uim-btn-submit"
            onClick={validateAndSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="uim-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send size={16} />
                Continue Execution
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
