import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../utils/format';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={classNames('btn', `btn-${variant}`, `btn-${size}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
