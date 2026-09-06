import type { ReactNode } from 'react';

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  mobileCard?: (row: T) => ReactNode;
};

export function Table<T>({ columns, rows, rowKey, mobileCard }: Props<T>) {
  return (
    <>
      <div className="table-wrap desktop-table">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileCard && (
        <div className="mobile-cards">
          {rows.map((row) => (
            <div key={rowKey(row)} className="mobile-card">
              {mobileCard(row)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
