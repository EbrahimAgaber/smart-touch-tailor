import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Mic, Bot, User, Receipt, Package, DollarSign, Paperclip } from 'lucide-react';

export default function SmartAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'مرحباً! أنا المساعد الذكي. كيف يمكنني مساعدتك اليوم؟ يمكنك إضافة مصروف، الاستعلام عن المبيعات، أو رفع فاتورة مشتريات.', sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isProcessing]);

  const addMessage = (text, sender) => {
    setMessages(prev => [...prev, { id: Date.now(), text, sender }]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    addMessage(`📎 تم إرفاق ملف: ${file.name}`, 'user');
    setIsProcessing(true);

    try {
      addMessage('جاري تحليل الفاتورة باستخدام الذكاء الاصطناعي المحلي...', 'ai');
      
      const filePath = file.path;

      if (!window.api || !window.api.processInvoiceFile) {
        addMessage('عذراً، خدمة التحليل غير متوفرة حالياً.', 'ai');
        setIsProcessing(false);
        return;
      }

      const result = await window.api.processInvoiceFile(filePath);

      if (result && result.success) {
        const itemNames = result.items.map(i => i.name).join('، ');
        addMessage(`وجدت ${result.items.length} أصناف (${itemNames}) بإجمالي ${result.totalAmount} ريال من المورد "${result.supplierName}". جاري تسجيل عملية الشراء...`, 'ai');
        
        // Auto-record purchase
        if (window.api.createPurchaseOrder) {
          try {
            // 1. Resolve Supplier
            let supplierId = null;
            if (window.api.getSuppliers && window.api.addSupplier) {
              const suppliers = await window.api.getSuppliers();
              // Suppliers return { id, name } or similar, let's try both cases
              const existingSupplier = suppliers.find(s => (s.name || s.Name) === result.supplierName);
              if (existingSupplier) {
                supplierId = existingSupplier.id || existingSupplier.ID;
              } else {
                const newSupplier = await window.api.addSupplier({ name: result.supplierName, phone: '', address: '' });
                supplierId = newSupplier.id || newSupplier.ID || null;
              }
            }
            
            // 2. Resolve Items
            const menu = window.api.getMenu ? await window.api.getMenu() : [];
            const resolvedItems = [];
            for (const item of result.items) {
              let productId = null;
              if (window.api.addMenuItem) {
                const existingProduct = menu.find(p => (p.name || p.Name) === item.name);
                if (existingProduct) {
                  productId = existingProduct.id || existingProduct.ID;
                } else {
                  const newProductRes = await window.api.addMenuItem({
                    Name: item.name,
                    Price: item.price,
                    Cost: item.price,
                    Category: 'مشتريات آلية',
                    Stock: 0,
                    SupplierID: supplierId
                  });
                  productId = newProductRes.id || newProductRes.ID || null;
                }
              }
              resolvedItems.push({
                product_id: productId || null,
                product_name: item.name,
                quantity: item.quantity,
                unit_cost: item.price,
                total: item.quantity * item.price,
                is_bulk: 0,
                unit_name: '',
                pieces_per_unit: 1
              });
            }

            // 3. Create Purchase Order
            const poData = {
              supplier_id: supplierId,
              supplier_name: result.supplierName,
              status: 'received',
              total_amount: result.totalAmount,
              reference_no: `AI-${Date.now()}`,
              items: resolvedItems
            };
            
            const poResult = await window.api.createPurchaseOrder(poData);
            
            // 4. Auto-receive to update stock
            if (poResult && poResult.success && window.api.receivePurchaseOrder) {
               await window.api.receivePurchaseOrder(poResult.id);
            }
            
            addMessage('✅ تم اعتماد الفاتورة وتسجيل المشتريات وإضافتها للمخزون بنجاح.', 'ai');
          } catch (poErr) {
            console.error(poErr);
            addMessage(`❌ خطأ أثناء تسجيل المشتريات: ${poErr.message}`, 'ai');
          }
        } else {
          addMessage('✅ (محاكاة) تم تسجيل الفاتورة بنجاح.', 'ai');
        }
      } else {
        addMessage(`❌ حدث خطأ أثناء التحليل: ${result.error}`, 'ai');
      }
    } catch (err) {
      addMessage(`❌ خطأ غير متوقع: ${err.message}`, 'ai');
    }
    
    setIsProcessing(false);
  };

  const parseIntent = async (text) => {
    setIsProcessing(true);
    const normalized = text.toLowerCase();

    // Context: Awaiting Confirmation for T3 Action
    if (awaitingApproval) {
      if (normalized.includes('نعم') || normalized.includes('اعتمد') || normalized.includes('موافق') || normalized.includes('اكيد')) {
        const res = await window.api.assistant.confirmAction(awaitingApproval);
        addMessage(res.message, 'ai');
        setAwaitingApproval(false);
      } else if (normalized.includes('لا') || normalized.includes('الغاء')) {
        const res = await window.api.assistant.cancelAction(awaitingApproval);
        addMessage(res.message, 'ai');
        setAwaitingApproval(false);
      } else {
        addMessage('أنا بانتظار تأكيدك، هل أعتمد الإجراء السابق؟ (نعم / لا)', 'ai');
      }
      setIsProcessing(false);
      return;
    }

    try {
      if (window.api && window.api.assistant) {
        const response = await window.api.assistant.chat(text);
        
        if (response.status === 'pending_confirmation') {
            setAwaitingApproval(response.actionId);
            addMessage(response.message, 'ai');
        } else if (response.status === 'action_required') {
            addMessage(response.message, 'ai');
        } else if (response.message) {
            addMessage(response.message, 'ai');
        } else {
            addMessage('عذراً، لم أتمكن من فهم طلبك.', 'ai');
        }
      } else {
        addMessage('عذراً، خدمة المساعد الذكي غير متصلة حالياً.', 'ai');
      }
    } catch (e) {
      addMessage(`❌ حدث خطأ: ${e.message}`, 'ai');
    }
    
    setIsProcessing(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userText = input.trim();
    addMessage(userText, 'user');
    setInput('');
    parseIntent(userText);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '30px',
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Bot size={28} />
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '14px',
            height: '14px',
            background: '#10b981',
            borderRadius: '50%',
            border: '2px solid white'
          }} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          width: '350px',
          height: '500px',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          direction: 'rtl'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px' }}>
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>مساعد البصمة الذكية</div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>متصل وجاهز للمساعدة</div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'var(--bg-app)'
          }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}>
                {msg.sender === 'ai' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#4f46e5' }}>
                    <Bot size={16} />
                  </div>
                )}
                
                <div style={{
                  background: msg.sender === 'user' ? '#6366f1' : 'white',
                  color: msg.sender === 'user' ? 'white' : '#1e293b',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  border: msg.sender === 'ai' ? '1px solid #e2e8f0' : 'none'
                }}>
                  {msg.text}
                </div>

                {msg.sender === 'user' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            
            {isProcessing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <Bot size={16} />
                </div>
                <div style={{ background: 'white', padding: '12px', borderRadius: '16px 16px 16px 0', border: '1px solid #e2e8f0', display: 'flex', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                  <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
                  <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s infinite 0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (Suggestions) */}
          {messages.length < 3 && !isProcessing && (
            <div style={{ padding: '10px 20px', display: 'flex', gap: '8px', overflowX: 'auto', background: 'var(--bg-card)', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => {setInput('كم مبيعات اليوم؟'); parseIntent('كم مبيعات اليوم؟'); addMessage('كم مبيعات اليوم؟', 'user');}} style={{ whiteSpace: 'nowrap', padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: '99px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}>مبيعات اليوم</button>
              <button onClick={() => fileInputRef.current?.click()} style={{ whiteSpace: 'nowrap', padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: '99px', fontSize: '11px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Paperclip size={12}/> رفع فاتورة</button>
            </div>
          )}

          {/* Hidden File Input */}
          <input 
            type="file" 
            accept="image/*,.pdf" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />

          {/* Input Area */}
          <form onSubmit={handleSubmit} style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', flexShrink: 0 }} title="إرفاق صورة فاتورة">
              <Paperclip size={18} />
            </button>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب طلبك هنا..."
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            <button type="submit" disabled={!input.trim()} style={{ 
              background: input.trim() ? '#6366f1' : '#cbd5e1', 
              border: 'none', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transform: 'rotate(180deg)' // RTL adjustment for send icon
            }}>
              <Send size={16} style={{ marginRight: '-2px' }}/>
            </button>
          </form>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
          `}} />
        </div>
      )}
    </>
  );
}
