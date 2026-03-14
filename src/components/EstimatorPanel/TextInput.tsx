import { useState, useRef, useEffect } from 'react';
import type { InputType } from '../../lib/types';

interface TextInputProps {
  inputType: InputType;
  placeholder?: string;
  onSubmit: (value: string) => void;
  error?: string | null;
}

const TextInput = ({ inputType, placeholder, onSubmit, error }: TextInputProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const htmlType = (() => {
    switch (inputType) {
      case 'number':
      case 'zip':
        return 'text';
      case 'email':
        return 'email';
      case 'tel':
        return 'tel';
      default:
        return 'text';
    }
  })();

  const inputMode = (() => {
    switch (inputType) {
      case 'number':
      case 'zip':
        return 'numeric' as const;
      case 'email':
        return 'email' as const;
      case 'tel':
        return 'tel' as const;
      default:
        return 'text' as const;
    }
  })();

  return (
    <form onSubmit={handleSubmit} className="estimator-text-input-form">
      <div className="estimator-text-input-wrapper">
        <input
          ref={inputRef}
          type={htmlType}
          inputMode={inputMode}
          className={`estimator-text-input ${error ? 'has-error' : ''}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="submit"
          className="estimator-submit-btn"
          disabled={!value.trim()}
        >
          Next
        </button>
      </div>
      {error && <p className="estimator-error">{error}</p>}
    </form>
  );
};

export default TextInput;
