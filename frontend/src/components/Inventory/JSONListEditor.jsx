import React, { useState } from 'react';
import { Plus, Trash2, Tag, Box } from 'lucide-react';

export function JSONListEditor({ label, value = [], onChange, placeholder, icon: Icon = Tag }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onChange([...value, newItem.trim()]);
    setNewItem('');
  };

  const handleRemove = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="input-label mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            className="input pl-9 py-1.5 text-sm"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder={placeholder}
          />
        </div>
        <button 
          type="button" 
          onClick={handleAdd}
          className="btn btn--secondary p-2 aspect-square"
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
        {value.map((item, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-2 bg-surface-elevated px-3 py-1 rounded-full border border-border shadow-sm group animate-in zoom-in-95"
          >
            <span className="text-xs font-medium">{item}</span>
            <button 
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-danger-400 hover:text-danger-600 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <span className="text-[10px] text-muted italic">Sin datos cargados</span>
        )}
      </div>
    </div>
  );
}
