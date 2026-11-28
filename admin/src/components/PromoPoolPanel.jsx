import { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import RefreshButton from './RefreshButton';
import { notify } from '../toast';

export default function PromoPoolPanel() {
  const [codes, setCodes] = useState([]);
  const [rows, setRows] = useState([{ discount_kes: '', quantity: '' }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCodes(await api.promoPool.getAll());
    } catch (error) {
      notify(error.message || 'Could not load the promo pool.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRow = (index, field, value) => setRows(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const generate = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const items = rows.map(row => ({ discount_kes: Number(row.discount_kes), quantity: Number(row.quantity) }));
      const created = await api.promoPool.generate(items);
      setRows([{ discount_kes: '', quantity: '' }]);
      notify(`${created.length} promo codes published.`);
      await load();
    } catch (error) {
      notify(error.message || 'Could not generate codes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async code => {
    try {
      await api.promoPool.update(code.id, { is_active: !code.is_active });
      setCodes(prev => prev.map(item => (item.id === code.id ? { ...item, is_active: !code.is_active } : item)));
    } catch (error) {
      notify(error.message || 'Could not update the code.', 'error');
    }
  };

  const remove = async code => {
    if (!window.confirm(`Delete code ${code.code}?`)) return;
    try {
      await api.promoPool.delete(code.id);
      setCodes(prev => prev.filter(item => item.id !== code.id));
    } catch (error) {
      notify(error.message || 'Could not delete the code.', 'error');
    }
  };

  const clearUsed = async () => {
    if (!window.confirm('Remove all used codes? Their history will be lost.')) return;
    try {
      await api.promoPool.clearUsed();
      notify('Used codes cleared.');
      await load();
    } catch (error) {
      notify(error.message || 'Could not clear used codes.', 'error');
    }
  };

  const active = codes.filter(code => code.is_active);
  const left = active.filter(code => !code.claimed_at).length;

  return (
    <div className="data-card">
      <div className="data-card-header">
        <h3><Gift size={20} /> "Get Code" promo pool</h3>
        <RefreshButton onClick={load} loading={loading} />
      </div>
      <p>{left} of {active.length} active codes left. The Get Code button shows on trip pages only while codes remain.</p>
      <form className="campaign-form" onSubmit={generate}>
        {rows.map((row, index) => (
          <div key={index} className="campaign-actions">
            <label>KES off<input type="number" min="1" required value={row.discount_kes} onChange={event => updateRow(index, 'discount_kes', event.target.value)} placeholder="100" /></label>
            <label>How many codes<input type="number" min="1" max="100" required value={row.quantity} onChange={event => updateRow(index, 'quantity', event.target.value)} placeholder="3" /></label>
            {rows.length > 1 && <button type="button" className="btn-secondary" onClick={() => setRows(prev => prev.filter((_, i) => i !== index))}>Remove</button>}
          </div>
        ))}
        <div className="campaign-actions">
          <button type="button" className="btn-secondary" onClick={() => setRows(prev => [...prev, { discount_kes: '', quantity: '' }])}><Plus size={16} /> Add another amount</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Publishing...' : 'Publish codes'}</button>
        </div>
      </form>
      <div className="campaign-list">
        {codes.map(code => (
          <article key={code.id} className="campaign-row">
            <div>
              <strong>{code.code}</strong>
              <p>
                KES {Number(code.discount_kes).toLocaleString()} off
                {code.claimed_at
                  ? ` · Used ${new Date(code.claimed_at).toLocaleString('en-KE')} on ${code.claimed_trip} (price shown KES ${Number(code.claimed_price_kes).toLocaleString()})`
                  : ' · Available'}
              </p>
            </div>
            <div className="campaign-actions">
              <button type="button" className={`status-badge ${code.is_active ? 'active' : 'archived'}`} onClick={() => toggle(code)}>{code.is_active ? 'Active' : 'Inactive'}</button>
              <button type="button" className="btn-danger" onClick={() => remove(code)} aria-label={`Delete ${code.code}`}><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
        {!loading && codes.length === 0 && <p>No codes published yet.</p>}
      </div>
      {codes.some(code => code.claimed_at) && <button type="button" className="btn-secondary" onClick={clearUsed}>Clear used codes</button>}
    </div>
  );
}
