import type { SelectHTMLAttributes } from 'react';
import { classNames } from '../utils/format';

type Option = { value: string; label: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
};

export function Select({ label, error, options, placeholder, className, id, ...rest }: Props) {
  const selectId = id || rest.name;
  return (
    <label className={classNames('field', className)} htmlFor={selectId}>
      {label && <span className="field-label">{label}</span>}
      <select id={selectId} className={classNames('field-input', error && 'has-error')} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
