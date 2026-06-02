import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { User, Lock, ArrowRight, ShieldCheck, UserCircle2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState('select_user'); // 'select_user' | 'enter_pin'
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [bizName, setBizName] = useState('البصمة الذكية');
  const [supportInfo, setSupportInfo] = useState({ phone: '', email: '' });
  
  const { login, role } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (role) navigate('/shift', { replace: true });
    
    // Fetch Business Name & Staff List & Support Info
    window.api?.getSettings?.().then(s => {
      if (s?.business_name_ar) setBizName(s.business_name_ar);
      setSupportInfo({ 
        phone: s?.phone || '966533174895', 
        email: s?.email || 'ea.gaber10@gmail.com' 
      });
    });
    
    window.api?.getStaff?.().then(list => {
      setStaffList(list || []);
    });
  }, [role]);

  const handleKey = useCallback((key) => {
    setError('');
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1));
    } else if (key === 'enter') {
      if (pin.length >= 4) doLogin(pin);
      else setError('يرجى إدخال 4 أرقام على الأقل');
    } else if (pin.length < 6 && /^\d$/.test(key)) {
      const newPin = pin + key;
      setPin(newPin);
      
      // Auto-submit ONLY at 6 digits for power users, 
      // but 4-digit PINs require clicking Enter or the Check button.
      if (newPin.length === 6) {
        setTimeout(() => doLogin(newPin), 300);
      }
    }
  }, [pin, selectedStaff]);

  useEffect(() => {
    if (step !== 'enter_pin') return;
    const keyHandler = (e) => {
      if (e.key === 'Backspace') handleKey('backspace');
      else if (e.key === 'Enter') handleKey('enter');
      else if (/^\d$/.test(e.key)) handleKey(e.key);
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [step, handleKey]);

  const doLogin = async (p) => {
    if (!p || p.length < 4) return;
    const res = await login(p, selectedStaff?.id);
    if (res.success) {
      navigate('/shift', { replace: true });
    } else {
      setError(res.error || 'رمز المرور غير صحيح');
      setPin('');
      // Flash the border red
      const display = document.getElementById('pin-display');
      if (display) {
        display.style.borderColor = '#ef4444';
        setTimeout(() => { if (display) display.style.borderColor = '#e2e8f0'; }, 500);
      }
    }
  };

  const handleLogin = () => doLogin(pin);

  return (
    <div style={wrapperStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          {/* Header */}
        <header style={headerStyle}>
          <div style={logoBadgeStyle}>🏪</div>
          <h1 style={titleStyle}>{bizName}</h1>
          <p style={subtitleStyle}>نظام إدارة نقاط البيع المتكامل</p>
        </header>

        {step === 'select_user' ? (
          <div style={fadeAnim}>
            <h2 style={sectionTitleStyle}>اختر ملفك الشخصي</h2>
            <div style={staffGridStyle}>
              {staffList.map(staff => (
                <button 
                  key={staff.id} 
                  onClick={() => { setSelectedStaff(staff); setStep('enter_pin'); }}
                  style={staffCardStyle}
                >
                  <div style={avatarStyle}>
                    {staff.role === 'Admin' ? <ShieldCheck size={32} /> : <UserCircle2 size={32} />}
                  </div>
                  <div style={staffNameStyle}>{staff.name}</div>
                  <div style={staffRoleStyle}>{staff.role === 'Admin' ? 'مدير' : staff.role === 'Manager' ? 'مشرف' : 'كاشير'}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={fadeAnim}>
            <div style={backBtnContainer}>
               <button onClick={() => { setStep('select_user'); setPin(''); setError(''); }} style={backBtnStyle}>
                 <ArrowRight size={18} /> العودة لاختيار الموظف
               </button>
            </div>
            
            <div style={selectedUserHeader}>
               <div style={smallAvatarStyle}>
                  {selectedStaff?.role === 'Admin' ? <ShieldCheck size={20} /> : <UserCircle2 size={20} />}
               </div>
               <div style={{ textAlign:'right' }}>
                 <div style={{ fontWeight:'700', fontSize:'16px' }}>{selectedStaff?.name}</div>
                 <div style={{ fontSize:'12px', color:'#94a3b8' }}>أدخل رمز الدخول</div>
               </div>
            </div>

            {/* PIN Display */}
            <div style={{ position:'relative', marginBottom:'32px' }}>
              <div id="pin-display" style={{ ...pinDisplayStyle, borderColor: error ? '#ef4444' : (pin.length > 0 ? '#3b82f6' : '#e2e8f0') }}>
                {showPin 
                  ? (pin || <span style={{ color:'#cbd5e1', letterSpacing:'normal', fontSize:'14px' }}>رمز الدخول</span>)
                  : ('•'.repeat(pin.length) || <span style={{ color:'#cbd5e1', letterSpacing:'normal', fontSize:'14px' }}>رمز الدخول</span>)
                }
              </div>
              {pin.length > 0 && (
                <button 
                  onClick={() => setShowPin(!showPin)}
                  style={{ position:'absolute', left:'15px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}
                >
                  {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              )}
            </div>

            {error && <p style={errorStyle}>{error}</p>}

            {/* Keypad */}
            <div style={keypadStyle}>
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button key={n} onClick={() => handleKey(n)} style={numKeyStyle}>{n}</button>
              ))}
              <button onClick={() => handleKey('backspace')} style={{ ...numKeyStyle, background:'#ef4444', color:'#ffffff', boxShadow:'0 4px 12px rgba(239,68,68,0.35)' }}>⌫</button>
              <button onClick={() => handleKey('0')} style={numKeyStyle}>0</button>
              <button onClick={handleLogin} style={{ ...numKeyStyle, background:'#2563eb', color:'#ffffff', boxShadow:'0 4px 12px rgba(37,99,235,0.35)' }}>✓</button>
            </div>
          </div>
        )}

        <footer style={footerStyle}>
          <div style={{ marginBottom:'12px', display:'flex', flexDirection:'column', gap:'8px', alignItems:'center' }}>
            <div style={{ fontSize:'12px', fontWeight:'800', color:'#475569' }}>💡 تحتاج مساعدة؟ تواصل معنا:</div>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
              <a href={`https://wa.me/${supportInfo.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={supportLinkStyle}>💬 واتساب: {supportInfo.phone}</a>
              <a href={`mailto:${supportInfo.email}`} style={supportLinkStyle}>📧 البريد: {supportInfo.email}</a>
            </div>
          </div>
          <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'12px', fontSize:'10px' }}>
            © 2026 {bizName} - جميع الحقوق محفوظة
          </div>
        </footer>
      </div>
      </div>
    </div>
  );
}

// STYLES
// FIX: was 'Inter, sans-serif' — Inter has no Arabic glyphs, breaking all Arabic text.
// Also added direction:'rtl' explicitly to prevent LTR rendering artifacts on the card.
const wrapperStyle = {
  height: '100vh', overflowY: 'auto',
  background: 'radial-gradient(circle at top right, #f8fafc, #e2e8f0)', direction: 'rtl',
  fontFamily: "'Tajawal', 'Outfit', sans-serif"
};

const containerStyle = {
  display: 'flex', minHeight: '100%', alignItems: 'center', justifyContent: 'center',
  padding: 'clamp(20px, 4vh, 40px) 16px'
};

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(20px)',
  padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 40px)', borderRadius: '32px', 
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)',
  width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.5)',
  textAlign: 'center', position: 'relative'
};

const headerStyle = { marginBottom:'40px' };

const logoBadgeStyle = {
  width:'72px', height:'72px', background:'linear-gradient(135deg, #3b82f6, #2563eb)',
  color:'white', borderRadius:'20px', display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:'32px', margin:'0 auto 20px', boxShadow:'0 10px 15px -3px rgba(37,99,235,0.3)'
};

const titleStyle = { fontSize:'28px', fontWeight:'900', color:'#0f172a', marginBottom:'4px' };
const subtitleStyle = { color:'#64748b', fontSize:'14px', fontWeight:'500' };

const sectionTitleStyle = { fontSize:'16px', fontWeight:'800', color:'#475569', marginBottom:'24px', textAlign:'right' };

const staffGridStyle = { display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px' };

const staffCardStyle = {
  background:'white', border:'1px solid #f1f5f9', borderRadius:'24px', padding:'24px 16px',
  cursor:'pointer', transition:'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display:'flex', 
  flexDirection:'column', alignItems:'center', gap:'12px', outline:'none',
};

const avatarStyle = {
  width:'64px', height:'64px', background:'#f8fafc', color:'#64748b', borderRadius:'50%',
  display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #e2e8f0',
  transition:'all 0.2s'
};

const staffNameStyle = { fontWeight:'700', fontSize:'15px', color:'#1e293b' };
const staffRoleStyle = { fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px' };

const backBtnContainer = { display:'flex', marginBottom:'24px' };
const backBtnStyle = { 
  background:'transparent', border:'none', color:'#3b82f6', fontSize:'13px', 
  fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' 
};

const selectedUserHeader = { 
  display:'flex', alignItems:'center', gap:'16px', background:'white', 
  padding:'16px', borderRadius:'16px', border:'1px solid #f1f5f9', marginBottom:'32px' 
};

const smallAvatarStyle = {
  width:'44px', height:'44px', background:'#eff6ff', color:'#3b82f6', borderRadius:'12px',
  display:'flex', alignItems:'center', justifyContent:'center'
};

const pinDisplayStyle = {
  height:'72px', border:'2px solid #e2e8f0', borderRadius:'20px', fontSize:'36px', 
  fontWeight:'800', letterSpacing:'12px', display:'flex', alignItems:'center', 
  justifyContent:'center', marginBottom:'32px', background:'#f8fafc', transition:'all 0.2s'
};

const keypadStyle = { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px' };

const numKeyStyle = {
  background:'#1e293b', border:'none', borderRadius:'18px',
  height:'clamp(48px, 8vh, 68px)', fontSize:'clamp(20px, 4vh, 26px)', fontWeight:'800', color:'#ffffff',
  cursor:'pointer', boxShadow:'0 4px 12px rgba(15,23,42,0.18)', transition:'all 0.15s',
  fontFamily:'inherit'
};

const errorStyle = { color:'#ef4444', fontWeight:'700', fontSize:'13px', marginBottom:'20px' };
const footerStyle = { marginTop:'48px', fontSize:'11px', color:'#94a3b8', fontWeight:'500' };
const supportLinkStyle = { color:'#3b82f6', textDecoration:'none', fontWeight:'700', fontSize:'12px', transition:'opacity 0.2s' };
const fadeAnim = { animation: 'fadeIn 0.3s ease-out' };
