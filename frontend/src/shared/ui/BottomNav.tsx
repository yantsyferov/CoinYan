import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { label: 'Home', icon: '🏠', path: '/' },
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        backgroundColor: '#fff',
        borderTop: '1px solid #E2E8F0',
        height: 64,
        display: 'flex',
      }}
    >
      {TABS.map(tab => {
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              color: isActive ? '#4F46E5' : '#94A3B8',
              fontWeight: isActive ? 700 : 500,
              gap: 2,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 11 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
