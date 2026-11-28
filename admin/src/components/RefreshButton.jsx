import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Keeps the icon spinning long enough to be noticed even when the data loads quickly.
export default function RefreshButton({ onClick, loading = false }) {
  const [spinning, setSpinning] = useState(false);
  const busy = loading || spinning;

  const handleClick = async () => {
    setSpinning(true);
    const minimum = new Promise(resolve => setTimeout(resolve, 800));
    try {
      await Promise.all([onClick(), minimum]);
    } finally {
      setSpinning(false);
    }
  };

  return (
    <button type="button" className="btn-secondary" onClick={handleClick} disabled={busy}>
      <RefreshCw size={17} className={busy ? 'refresh-spin' : undefined} /> {busy ? 'Refreshing...' : 'Refresh'}
    </button>
  );
}
