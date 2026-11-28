import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const textOf = node => Children.toArray(node).map(child => (isValidElement(child) ? textOf(child.props.children) : String(child))).join('');

function collectOptions(children, found = []) {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      found.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
    } else {
      collectOptions(child.props.children, found);
    }
  });
  return found;
}

// Styled drop-in replacement for a single-choice <select>; onChange receives { target: { value } }.
export default function Select({ value, onChange, children, disabled, required, id, className = '', compact = false, title, ...rest }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const options = collectOptions(children);
  const current = options.find(option => option.value === String(value ?? ''));

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
    <div className={`styled-select${open ? ' open' : ''}${compact ? ' compact' : ''} ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="styled-select-trigger"
        title={title}
        aria-label={rest['aria-label']}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className={current ? '' : 'placeholder'}>{current ? current.label : 'Select...'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {required && <input className="styled-select-proxy" tabIndex={-1} aria-hidden="true" required value={String(value ?? '')} onChange={() => {}} />}
      {open && (
        <ul className="styled-select-menu" role="listbox" aria-label={rest['aria-label']}>
          {options.map(option => (
            <li key={option.value} role="option" aria-selected={option.value === String(value ?? '')}>
              <button
                type="button"
                className={option.value === String(value ?? '') ? 'active' : ''}
                disabled={option.disabled}
                onClick={() => { onChange?.({ target: { value: option.value } }); setOpen(false); }}
              >
                {option.label}
                {option.value === String(value ?? '') && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
