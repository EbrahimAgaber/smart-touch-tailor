import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // FIX: was `height:100vh; width:100vw` — when used inside AppLayout's scrollable <main>
      // this created an element taller than the scroll container, pushing the Reload button
      // completely off-screen. Changed to minHeight:60vh + width:100% for page-level use.
      // The root-level ErrorBoundary in main.jsx can still use 100vh if needed.
      const isRoot = this.props.fullPage === true;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: isRoot ? '100vh' : '60vh',
          width: isRoot ? '100vw' : '100%',
          background: '#fef2f2', color: '#7f1d1d',
          fontFamily: 'Cairo, sans-serif', textAlign: 'center', padding: '20px'
        }} dir="rtl">
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontWeight: '900', fontSize: '32px', marginBottom: '8px' }}>حدث خطأ غير متوقع</h1>
          <p style={{ fontSize: '18px', marginBottom: '24px', opacity: 0.8 }}>عذراً، واجه النظام مشكلة في عرض هذه الصفحة.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px',
              borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
            }}>إعادة تحميل النظام</button>
          <pre style={{ maxWidth: '80%', overflow: 'auto', background: '#fee2e2', padding: '16px', borderRadius: '8px', marginTop: '24px', fontSize: '12px', textAlign: 'left' }} dir="ltr">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
