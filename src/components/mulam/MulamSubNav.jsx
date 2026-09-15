import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * MulamSubNav — Unified Navigation Rail for Master Tailor Experience
 * 
 * Props:
 * - activeTab: 'pos' | 'board' | 'alterations' | 'measurements'
 * - counters?: { activeOrders?: number, pendingAlterations?: number, totalMeasurements?: number }
 * - currentUnit?: 'in' | 'cm'
 * - onUnitChange?: (unit: 'in' | 'cm') => void
 * - subtitle?: string
 */
export default function MulamSubNav({
  activeTab = 'pos',
  counters: externalCounters,
  currentUnit: externalUnit,
  onUnitChange,
  subtitle
}) {
  const navigate = useNavigate();

  // Unit State (Sync with localStorage & events)
  const [unit, setUnit] = useState(() => {
    return externalUnit || localStorage.getItem('mulam_preferred_unit') || 'in';
  });

  useEffect(() => {
    if (externalUnit && externalUnit !== unit) {
      setUnit(externalUnit);
    }
  }, [externalUnit]);

  const handleUnitToggle = (newUnit) => {
    setUnit(newUnit);
    localStorage.setItem('mulam_preferred_unit', newUnit);
    window.dispatchEvent(new CustomEvent('mulam:unit-changed', { detail: { unit: newUnit } }));
    if (typeof onUnitChange === 'function') {
      onUnitChange(newUnit);
    }
  };

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Internal Counters
  const [internalCounters, setInternalCounters] = useState({
    activeOrders: 0,
    pendingAlterations: 0,
    totalMeasurements: 0
  });

  const loadCounters = useCallback(async () => {
    try {
      if (window.api?.tailor) {
        const stats = await window.api.tailor.getDashboardStats?.();
        if (stats) {
          setInternalCounters({
            activeOrders: stats.inProgress || 0,
            pendingAlterations: stats.pendingAlterations || 0,
            totalMeasurements: stats.totalMeasurements || 0
          });
          return;
        }

        // Fallbacks if stats not provided
        const [orders, alts, measurements] = await Promise.all([
          window.api.tailor.getOrders?.({ exclude_status: 'delivered' }).catch(() => []),
          window.api.tailor.getAlterations?.().catch(() => []),
          window.api.tailor.getMeasurements?.({}).catch(() => [])
        ]);

        setInternalCounters({
          activeOrders: Array.isArray(orders) ? orders.length : 0,
          pendingAlterations: Array.isArray(alts) ? alts.filter(a => a.status !== 'delivered').length : 0,
          totalMeasurements: Array.isArray(measurements) ? measurements.length : 0
        });
      }
    } catch {
      // Ignore background counter errors
    }
  }, []);

  useEffect(() => {
    if (!externalCounters) {
      loadCounters();
      const interval = setInterval(loadCounters, 20000);
      return () => clearInterval(interval);
    }
  }, [externalCounters, loadCounters]);

  const counts = {
    activeOrders: externalCounters?.activeOrders ?? internalCounters.activeOrders,
    pendingAlterations: externalCounters?.pendingAlterations ?? internalCounters.pendingAlterations,
    totalMeasurements: externalCounters?.totalMeasurements ?? internalCounters.totalMeasurements
  };

  const navTabs = [
    {
      id: 'pos',
      label: 'تفصيل جديد',
      icon: '✂️',
      path: '/tailor-pos',
      shortcut: 'F1'
    },
    {
      id: 'board',
      label: 'لوحة المعمل',
      icon: '🏭',
      path: '/orders-board',
      count: counts.activeOrders,
      badgeColor: '#3b82f6',
      shortcut: 'F2'
    },
    {
      id: 'alterations',
      label: 'إدارة التعديلات',
      icon: '🏷️',
      path: '/alterations',
      count: counts.pendingAlterations,
      badgeColor: '#f59e0b',
      shortcut: 'F3'
    },
    {
      id: 'measurements',
      label: 'دفتر المقاسات',
      icon: '📐',
      path: '/measurements',
      count: counts.totalMeasurements,
      badgeColor: '#10b981',
      shortcut: 'F4'
    }
  ];

  return (
    <nav
      dir="rtl"
      role="navigation"
      aria-label="مسار المعلم"
      style={{
        background: 'var(--bg-card, #ffffff)',
        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        zIndex: 50,
        color: 'var(--text-main, #0f172a)',
        fontFamily: "'Cairo', 'Tajawal', sans-serif",
        flexShrink: 0
      }}
    >
      {/* Right Side: Back to Home + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Return to Home button */}
        <button
          onClick={() => navigate('/home')}
          title="العودة للشاشة الرئيسية"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            color: 'var(--text-main, #0f172a)',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary, #6366f1)';
            e.currentTarget.style.background = '#f1f5f9';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
            e.currentTarget.style.background = '#f8fafc';
          }}
        >
          <span style={{ fontSize: '15px' }}>←</span>
          <span>الرئيسية</span>
        </button>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle, #e2e8f0)', margin: '0 4px' }} />

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: isActive
                    ? '1px solid var(--primary, #6366f1)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'transparent',
                  color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-muted, #64748b)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = 'var(--text-main, #0f172a)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted, #64748b)';
                  }
                }}
              >
                <span>{tab.label}</span>

                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    style={{
                      background: tab.badgeColor || '#3b82f6',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 900,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontFamily: "'IBM Plex Mono', monospace",
                      minWidth: '18px',
                      textAlign: 'center',
                    }}
                  >
                    {tab.count}
                  </span>
                )}

                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      left: '20%',
                      right: '20%',
                      height: '3px',
                      background: 'var(--primary, #6366f1)',
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Left Side: Unit Switcher + Clock + Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Universal Unit Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '3px',
            borderRadius: '999px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            gap: '2px'
          }}
          title="وحدة قياس المقاسات الموحدة"
        >
          <button
            type="button"
            onClick={() => handleUnitToggle('in')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
              fontFamily: "'Cairo', 'Tajawal', sans-serif",
              background: unit === 'in' ? 'var(--primary, #6366f1)' : 'transparent',
              color: unit === 'in' ? '#ffffff' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease'
            }}
          >
            إنش
          </button>
          <button
            type="button"
            onClick={() => handleUnitToggle('cm')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
              fontFamily: "'Cairo', 'Tajawal', sans-serif",
              background: unit === 'cm' ? 'var(--primary, #6366f1)' : 'transparent',
              color: unit === 'cm' ? '#ffffff' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease'
            }}
          >
            سم
          </button>
        </div>

        {/* Shift / Workshop Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#10b981',
            padding: '5px 12px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 800
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
            }}
          />
          <span>الوردية نشطة</span>
        </div>

        {/* Real-time Clock */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            color: 'var(--text-main, #0f172a)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ color: 'var(--primary, #6366f1)' }}>⏱</span>
          <span>{currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </nav>
  );
}
