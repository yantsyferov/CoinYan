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
}: CircleItemProps) {
  const isActive = highlighted || isDragging;

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
