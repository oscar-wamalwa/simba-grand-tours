import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function FilterDropdown({ labelledBy, ariaLabel, title, value, options, allLabel, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const choices = allLabel ? [{ value: '', label: allLabel }, ...options] : options;
  const current = choices.find(choice => choice.value === value) || choices[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className={`filter-dropdown${open ? ' open' : ''}${compact ? ' compact' : ''}`} ref={wrapRef}>
      <button type="button" className="filter-dropdown-trigger" title={title} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : labelledBy} onClick={() => setOpen(prev => !prev)}>
        <span className={value ? 'selected' : ''}>{current?.label}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <ul className="filter-dropdown-menu" role="listbox" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : labelledBy}>
          {choices.map(choice => (
            <li key={choice.value || 'all'} role="option" aria-selected={choice.value === value}>
              <button type="button" className={choice.value === value ? 'active' : ''} disabled={choice.disabled} onClick={() => { onChange(choice.value); setOpen(false); }}>
                {choice.label}
                {choice.value === value && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
