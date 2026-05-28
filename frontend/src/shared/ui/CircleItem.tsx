import React from 'react';

interface CircleItemProps {
  icon: string;
  name: string;
  subtitle?: string;
  highlighted?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
  dragRef?: React.Ref<HTMLDivElement>;
  budgetRatio?: number;
}

export const CircleItem = React.memo(function CircleItem({
  icon,
  name,
  subtitle,
  highlighted = false,
  isDragging = false,
  onClick,
  dragListeners,
  dragAttributes,
  dragRef,
  budgetRatio,
}: CircleItemProps) {
  const isActive = highlighted || isDragging;

  const ringColor =
    budgetRatio !== undefined
      ? budgetRatio < 0.6
        ? '#22c55e'
        : budgetRatio < 0.85
          ? '#f97316'
          : '#ef4444'
      : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
      onClick={onClick}
    >
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <div
          ref={dragRef}
          {...(dragAttributes as React.HTMLAttributes<HTMLDivElement>)}
          {...(dragListeners as React.HTMLAttributes<HTMLDivElement>)}
          style={{
            width: 72,
            height: 72,
            borderRadius: 9999,
            backgroundColor: '#F8FAFC',
            border: isActive ? '2px solid #7C3AED' : '2px solid #E2E8F0',
            boxShadow: isActive ? '0 0 0 4px rgba(124,58,237,0.15)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {icon}
        </div>
        {budgetRatio !== undefined && (
          <svg
            style={{ position: 'absolute', top: -4, left: -4, pointerEvents: 'none' }}
            width={80}
            height={80}
            viewBox="0 0 80 80"
          >
            <circle cx={40} cy={40} r={34} fill="none" stroke="#E2E8F0" strokeWidth={4} />
            <circle
              cx={40}
              cy={40}
              r={34}
              fill="none"
              stroke={ringColor}
              strokeWidth={4}
              strokeDasharray="213.63"
              strokeDashoffset={213.63 * (1 - Math.min(1, Math.max(0, budgetRatio)))}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#0F172A',
          textAlign: 'center',
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {name}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#7C3AED',
            textAlign: 'center',
            display: 'block',
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
});
