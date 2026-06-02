import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineBanner() {
  const [status, setStatus] = useState('online');
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const s = await window.api.getSyncStatus();
        setStatus(s.status);
        setLastSync(s.lastSync);
      } catch (e) {
        setStatus('offline');
      }
    };

    const interval = setInterval(checkStatus, 10000);
    checkStatus();

    // Listen for manual sync notifications to update immediately
    if (window.api && window.api.onSyncNotify) {
      window.api.onSyncNotify(() => checkStatus());
    }

    return () => clearInterval(interval);
  }, []);

  if (status !== 'sync_error' && status !== 'offline' && status !== 'server_error') return null;

  return (
    <div style={bannerStyle}>
      <div style={contentStyle}>
        <WifiOff size={18} />
        <span style={{ fontWeight: '700' }}>أنت تعمل في وضع الأوفلاين</span>
        <span style={{ opacity: 0.8, fontSize: '12px' }}>
          | آخر مزامنة: {lastSync ? new Date(lastSync).toLocaleTimeString('ar-SA') : 'غير معروف'}
        </span>
      </div>
      <button onClick={() => window.api.forceSync()} style={btnStyle}>
        <RefreshCw size={14} /> مزامنة الآن
      </button>
    </div>
  );
}

const bannerStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '40px',
  background: '#ef4444',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  zIndex: 9999,
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  fontSize: '13px'
};

const contentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px'
};

const btnStyle = {
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.3)',
  color: 'white',
  padding: '4px 12px',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontFamily: 'inherit'
};
