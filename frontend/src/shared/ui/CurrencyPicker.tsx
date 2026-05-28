import React from 'react';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';

interface CurrencyPickerProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  label?: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1.5px solid #E2E8F0',
  fontSize: 15,
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  backgroundColor: '#fff',
  appearance: 'auto',
  cursor: 'pointer',
};

const selectDisabledStyle: React.CSSProperties = {
  ...selectStyle,
  backgroundColor: '#F8FAFC',
  color: '#94A3B8',
  cursor: 'not-allowed',
};

export function CurrencyPicker({ value, onChange, disabled = false, label }: CurrencyPickerProps) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={disabled ? selectDisabledStyle : selectStyle}
      >
        {SUPPORTED_CURRENCIES.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code} — {currency.name}
          </option>
        ))}
      </select>
    </div>
  );
}
