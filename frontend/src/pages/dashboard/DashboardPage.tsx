import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { DASHBOARD_QUERY } from '../../entities/dashboard/api/dashboard.query';
import type { DashboardData } from '../../entities/dashboard/api/dashboard.query';
import { formatCurrency } from '../../shared/lib/format-currency';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface SummaryCardProps {
  label: string;
  value: string;
  valueColor: string;
}

function SummaryCard({ label, value, valueColor }: SummaryCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: '#94A3B8',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: valueColor,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const now = new Date();
  const navigate = useNavigate();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [showPicker, setShowPicker] = useState(false);

  const isCurrentMonth =
    period.year === now.getFullYear() && period.month === now.getMonth() + 1;

  const goToPrev = () =>
    setPeriod((p) =>
      p.month === 1
        ? { year: p.year - 1, month: 12 }
        : { year: p.year, month: p.month - 1 },
    );

  const goToNext = () =>
    setPeriod((p) =>
      p.month === 12
        ? { year: p.year + 1, month: 1 }
        : { year: p.year, month: p.month + 1 },
    );

  const goToToday = () =>
    setPeriod({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const { data, loading } = useQuery<DashboardData>(DASHBOARD_QUERY, {
    variables: { year: period.year, month: period.month },
    fetchPolicy: 'cache-and-network',
  });

  const summary = data?.dashboard;
  const baseCurrency = summary?.baseCurrency;

  const navButtonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 9999,
    background: '#fff',
    border: '1.5px solid #E2E8F0',
    cursor: 'pointer',
    fontSize: 16,
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  return (
    <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Top bar */}
      <div
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 1px 0 #E2E8F0',
          padding: '0 20px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Dashboard
        </span>
      </div>

      {/* Page content */}
      <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
        {/* Period selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          {/* Left group: prev arrow + label + next arrow */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <button style={navButtonStyle} onClick={goToPrev} aria-label="Previous month">
              ‹
            </button>

            {/* Month/year label with inline picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPicker((v) => !v)}
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#0F172A',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                {MONTH_NAMES[period.month - 1]} {period.year}
              </button>

              {showPicker ? (
                <input
                  type="month"
                  value={`${period.year}-${String(period.month).padStart(2, '0')}`}
                  max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    if (y && m) {
                      setPeriod({ year: y, month: m });
                    }
                    setShowPicker(false);
                  }}
                  style={{
                    position: 'absolute',
                    top: 36,
                    left: 0,
                    zIndex: 10,
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    backgroundColor: '#fff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  }}
                />
              ) : null}
            </div>

            <button
              style={isCurrentMonth ? { ...navButtonStyle, opacity: 0.3, cursor: 'not-allowed' } : navButtonStyle}
              onClick={goToNext}
              disabled={isCurrentMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Right group: Today button (only when not on current month) */}
          {!isCurrentMonth ? (
            <button
              onClick={goToToday}
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          ) : null}
        </div>

        {loading && !data ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 60,
              fontSize: 16,
              color: '#94A3B8',
            }}
          >
            Loading...
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                padding: 20,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0F172A',
                  margin: '0 0 16px 0',
                }}
              >
                {MONTH_NAMES[period.month - 1]} {period.year}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20,
                }}
              >
                <SummaryCard
                  label="Total Income"
                  value={formatCurrency(summary?.totalIncome ?? 0, baseCurrency)}
                  valueColor="#22C55E"
                />
                <SummaryCard
                  label="Total Expenses"
                  value={formatCurrency(summary?.totalExpenses ?? 0, baseCurrency)}
                  valueColor="#EF4444"
                />
                <SummaryCard
                  label="Net Balance"
                  value={formatCurrency(summary?.netBalance ?? 0, baseCurrency)}
                  valueColor={(summary?.netBalance ?? 0) >= 0 ? '#22C55E' : '#EF4444'}
                />
                <SummaryCard
                  label="Total Balance"
                  value={summary?.totalAccountBalance == null ? '—' : formatCurrency(summary.totalAccountBalance, baseCurrency)}
                  valueColor="#4F46E5"
                />
              </div>
              {summary?.ratesStale === true ? (
                <p
                  style={{
                    margin: '12px 0 0 0',
                    fontSize: 11,
                    color: '#94A3B8',
                    fontStyle: 'italic',
                  }}
                >
                  * rates may be approximate
                </p>
              ) : null}
            </div>

            {/* Spending by Category */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                padding: 20,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0F172A',
                  margin: '0 0 4px 0',
                }}
              >
                Spending by Category
              </h2>

              {(summary?.categories ?? []).length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 14,
                    color: '#94A3B8',
                    paddingTop: 24,
                    paddingBottom: 24,
                  }}
                >
                  No transactions for this period
                </div>
              ) : (
                <div>
                  {(summary?.categories ?? []).map((category, index, arr) => {
                    const isLast = index === arr.length - 1;

                    let barColor: string;
                    let barWidth: string;
                    if (category.monthlyLimit == null) {
                      barColor = '#94A3B8';
                      barWidth = `${category.share}%`;
                    } else {
                      const pct = category.budgetPercent ?? 0;
                      barWidth = `${Math.min(pct, 100)}%`;
                      if (pct < 60) {
                        barColor = '#22C55E';
                      } else if (pct < 85) {
                        barColor = '#F97316';
                      } else {
                        barColor = '#EF4444';
                      }
                    }

                    return (
                      <div
                        key={category.id}
                        onClick={() => navigate(`/categories/expense/${category.id}`)}
                        style={{
                          cursor: 'pointer',
                          padding: '10px 0',
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {/* Icon circle */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9999,
                            background: '#EFF6FF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: 18,
                          }}
                        >
                          {ACCOUNT_ICONS[category.icon] ?? '📁'}
                        </div>

                        {/* Text + progress bar */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#0F172A',
                            }}
                          >
                            {category.name}
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: 6,
                              borderRadius: 9999,
                              background: '#F1F5F9',
                              marginTop: 4,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                borderRadius: 9999,
                                width: barWidth,
                                background: barColor,
                              }}
                            />
                          </div>
                        </div>

                        {/* Amount */}
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#0F172A',
                            flexShrink: 0,
                          }}
                        >
                          {formatCurrency(category.amount, baseCurrency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
