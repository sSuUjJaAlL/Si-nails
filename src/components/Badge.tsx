import type { PaymentType } from '../types';

export function Badge({ type }: { type: PaymentType | 'ACTIVE' | 'INACTIVE' | 'ADMIN' | 'USER' | 'EMPLOYEE' }) {
  const label =
    type === 'CASH'
      ? 'Cash'
      : type === 'ONLINE'
        ? 'Online'
        : type === 'ACTIVE'
          ? 'Active'
          : type === 'INACTIVE'
            ? 'Inactive'
            : type === 'ADMIN'
              ? 'Admin'
              : 'User';

  return <span className={`badge badge-${type === 'EMPLOYEE' ? 'user' : type.toLowerCase()}`}>{label}</span>;
}
