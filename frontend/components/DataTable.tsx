'use client';

import { useState } from 'react';

interface Props {
  data: Record<string, unknown>[];
  pageSize?: number;
}

const PAGE_SIZE = 20;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleDateString();
  const str = String(value);
  // Format ISO dates
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return str;
}

export default function DataTable({ data, pageSize = PAGE_SIZE }: Props) {
  const [page, setPage] = useState(0);

  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        color: '#475569',
        gap: '8px',
      }}>
        <span style={{ fontSize: '2rem' }}>🗂️</span>
        <p style={{ fontSize: '0.9rem' }}>No data to display</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-indigo">{data.length.toLocaleString()} rows</span>
          <span className="badge badge-cyan">{columns.length} columns</span>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
            <button
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ←
            </button>
            <span>Page {page + 1} / {totalPages}</span>
            <button
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table className="data-table data-table-mini">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              {columns.map(col => (
                <th key={col}>{col.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, ri) => (
              <tr key={ri}>
                {columns.map(col => (
                  <td key={col} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
