import type { InputHTMLAttributes } from 'react';
import { classNames } from '../utils/format';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, id, ...rest }: Props) {
  const inputId = id || rest.name;
  return (
    <label className={classNames('field', className)} htmlFor={inputId}>
      {label && <span className="field-label">{label}</span>}
      <input id={inputId} className={classNames('field-input', error && 'has-error')} {...rest} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
