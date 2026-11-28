import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (event) => {
      const toast = event.detail;
      setToasts(current => [...current.slice(-2), toast]);
      setTimeout(() => setToasts(current => current.filter(item => item.id !== toast.id)), 4500);
    };
    window.addEventListener('admin-toast', handler);
    return () => window.removeEventListener('admin-toast', handler);
  }, []);

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
