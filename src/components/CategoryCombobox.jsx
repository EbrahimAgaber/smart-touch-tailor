import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { STANDARD_CATEGORIES } from '../utils/categoryDictionary';

const CategoryCombobox = ({ value, onChange, existingCategories = [], suggestedCategory = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const newCategoryInputRef = useRef(null);

  const customCategories = (existingCategories || []).filter(
    cat => typeof cat === 'string' && cat.trim() && !STANDARD_CATEGORIES.find(s => s.name === cat)
  ).map(cat => ({ name: cat, icon: '📌' }));

  const allCategories = [...STANDARD_CATEGORIES, ...customCategories];

  const searchTarget = (inputValue || '').toLowerCase();
  const filteredCategories = allCategories.filter(cat =>
    cat && cat.name && cat.name.toLowerCase().includes(searchTarget)
  );

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setInputValue(value || '');
        setIsAddingNew(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  useEffect(() => {
    if (isAddingNew && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleSelect = (categoryName) => {
    onChange(categoryName);
    setInputValue(categoryName);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (isAddingNew) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewSubmit();
      } else if (e.key === 'Escape') {
        setIsAddingNew(false);
      }
      return;
    }

    if (!isOpen && e.key !== 'Tab' && e.key !== 'Enter' && e.key !== 'Escape') {
      setIsOpen(true);
    }

    const maxIndex = filteredCategories.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > -1 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen) {
          if (highlightedIndex >= 0 && highlightedIndex < filteredCategories.length) {
            handleSelect(filteredCategories[highlightedIndex].name);
          } else if (highlightedIndex === filteredCategories.length) {
            setIsAddingNew(true);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setInputValue(value || '');
        break;
      default:
        break;
    }
  };

  const handleAddNewSubmit = () => {
    if (newCategoryName.trim()) {
      handleSelect(newCategoryName.trim());
      setIsAddingNew(false);
      setNewCategoryName('');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    color: '#0f172a',
    fontWeight: '600',
    paddingRight: '40px'
  };

  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 0,
    marginTop: '4px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    maxHeight: '300px',
    overflowY: 'auto',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column'
  };

  const itemStyle = (isActive) => ({
    padding: '10px 16px',
    cursor: 'pointer',
    backgroundColor: isActive ? '#f8fafc' : 'transparent',
    color: isActive ? '#3b82f6' : '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '700',
    transition: 'background-color 0.2s ease'
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', direction: 'rtl' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
          placeholder="اختر أو ابحث عن قسم..."
        />
        <ChevronDown 
          size={20} 
          color="#475569" 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            right: '12px', 
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }} 
        />
      </div>

      {isOpen && (
        <div style={dropdownStyle}>
          {suggestedCategory && suggestedCategory.name !== value && (
            <div 
              style={{
                backgroundColor: '#eff6ff',
                padding: '8px 16px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: '#1e40af',
                fontSize: '13px',
                fontWeight: '800'
              }}
              onClick={() => handleSelect(suggestedCategory.name)}
            >
              <span>💡 اقتراح:</span>
              <span>{suggestedCategory.icon} {suggestedCategory.name}</span>
            </div>
          )}
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredCategories.map((cat, index) => (
              <div
                key={cat.name}
                style={itemStyle(index === highlightedIndex)}
                onClick={() => handleSelect(cat.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                {value === cat.name && <Check size={16} color="#3b82f6" style={{ marginRight: 'auto' }} />}
              </div>
            ))}
            
            {filteredCategories.length === 0 && (
              <div style={{ padding: '12px 16px', color: '#475569', fontSize: '14px', textAlign: 'center', fontWeight: '700' }}>
                لا توجد نتائج
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', padding: '8px' }}>
            {isAddingNew ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={newCategoryInputRef}
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اسم القسم الجديد..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}
                />
                <button
                  onClick={handleAddNewSubmit}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 16px',
                    cursor: 'pointer',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}
                >
                  إضافة
                </button>
              </div>
            ) : (
              <div
                style={{
                  ...itemStyle(highlightedIndex === filteredCategories.length),
                  color: '#3b82f6',
                  borderRadius: '8px',
                  justifyContent: 'center'
                }}
                onClick={() => setIsAddingNew(true)}
                onMouseEnter={() => setHighlightedIndex(filteredCategories.length)}
              >
                <Plus size={18} />
                <span>إضافة قسم جديد</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryCombobox;
