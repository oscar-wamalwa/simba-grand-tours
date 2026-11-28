import { useEffect, useState } from 'react';
import { Download, Edit2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import api from '../api';

const emptyItem = () => ({ description: '', quantity: '1', unit_price: '' });
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const emptyInvoice = settings => ({
  issue_date: today(), due_date: '', currency: 'KES',
  issuer_name: settings?.site_name || '', issuer_address: settings?.address || '',
  issuer_email: settings?.site_email || '', issuer_phone: settings?.site_phone || '', issuer_tax_id: '',
  client_name: '', client_contact: '', client_address: '', client_email: '', client_phone: '', client_tax_id: '',
  service_details: '', payment_instructions: '', booking_terms: '', notes: '',
  tax_rate: '0', amount_paid: '0', items: [emptyItem()],
});

function parseHundredths(value) {
  if (!/^\d+(?:\.\d{0,2})?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatHundredths(value, currency) {
  return `${currency} ${(value / 100n).toLocaleString('en-US')}.${String(value % 100n).padStart(2, '0')}`;
}

function previewTotals(form) {
  const taxRate = parseHundredths(form.tax_rate);
  const paid = parseHundredths(form.amount_paid);
  if (taxRate === null || taxRate > 10000n || paid === null) return null;
  let subtotal = 0n;
  for (const item of form.items) {
    const quantity = parseHundredths(item.quantity);
    const price = parseHundredths(item.unit_price);
    if (quantity === null || quantity === 0n || price === null) return null;
    subtotal += (quantity * price + 50n) / 100n;
  }
  const tax = (subtotal * taxRate + 5000n) / 10000n;
  return { subtotal, tax, total: subtotal + tax, paid, balance: subtotal + tax - paid };
}

function InvoiceField({ form, setForm, name, label, type = 'text', required = false, ...props }) {
  const id = `invoice-${name}`;
  const common = {
    id, required, value: form[name], onChange: event => setForm(prev => ({ ...prev, [name]: event.target.value })),
    ...props,
  };
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {type === 'textarea' ? <textarea {...common} rows="3" /> : <input {...common} type={type} />}
    </div>
  );
}

export default function InvoicesView() {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setInvoices(await api.invoices.getAll());
    } catch (requestError) {
      setError(requestError.message || 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    api.settings.get().then(setSettings).catch(requestError => {
      console.error('Could not load business details for invoices:', requestError);
      setError('Could not load business details. You can enter them manually.');
    }).finally(() => setSettingsLoading(false));
  }, []);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyInvoice(settings));
    setError('');
    setMessage('');
  };

  const startEdit = invoice => {
    const fields = emptyInvoice(settings);
    for (const key of Object.keys(fields)) {
      if (key !== 'items') fields[key] = invoice[key] ?? '';
    }
    fields.items = invoice.items.map(item => ({ ...item }));
    setEditingId(invoice.id);
    setForm(fields);
    setError('');
    setMessage('');
  };

  const download = async invoice => {
    setDownloadingId(invoice.id);
    setError('');
    try {
      const blob = await api.invoices.document(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.number}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(`Invoice ${invoice.number} is saved, but the document could not be downloaded: ${requestError.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const remove = async invoice => {
    if (!window.confirm(`Permanently delete invoice ${invoice.number} for ${invoice.client_name}? This cannot be undone.`)) return;
    setError('');
    setMessage('');
    try {
      await api.invoices.delete(invoice.id);
      setInvoices(prev => prev.filter(item => item.id !== invoice.id));
      setMessage(`Invoice ${invoice.number} deleted.`);
    } catch (requestError) {
      setError(`Could not delete invoice ${invoice.number}: ${requestError.message}`);
    }
  };

  const save = async event => {
    event.preventDefault();
    const shouldDownload = event.nativeEvent.submitter?.value === 'download';
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = { ...form, due_date: form.due_date || null };
      const saved = editingId ? await api.invoices.update(editingId, data) : await api.invoices.create(data);
      setInvoices(previous => editingId
        ? previous.map(invoice => invoice.id === saved.id ? saved : invoice)
        : [saved, ...previous]);
      setForm(null);
      setEditingId(null);
      setMessage(`Invoice ${saved.number} saved.`);
      if (shouldDownload) await download(saved);
    } catch (requestError) {
      setError(requestError.message || 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index, field, value) => setForm(prev => ({
    ...prev,
    items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const totals = form ? previewTotals(form) : null;

  return (
    <div className="invoices-view">
      <section className="data-card">
        <div className="data-card-header">
          <div><h3>Invoices</h3><p>Saved invoices can be edited and downloaded again. Amounts are entered in the invoice currency.</p></div>
          <div className="data-actions">
            <button type="button" className="btn-secondary" disabled={loading} onClick={refresh}><RefreshCw size={17} /> Refresh</button>
            <button type="button" className="btn-primary" disabled={Boolean(form) || settingsLoading} onClick={startNew}><Plus size={17} /> New invoice</button>
          </div>
        </div>
        {error && <p className="invoice-status form-status error" role="alert">{error}</p>}
        {message && <p className="invoice-status form-status success" role="status">{message}</p>}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Bill to</th><th>Issued / due</th><th>Total</th><th>Paid</th><th>Balance due</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>{invoice.number}</td><td>{invoice.client_name}</td>
                  <td>{invoice.issue_date}<br />{invoice.due_date || 'No due date'}</td>
                  <td>{invoice.currency} {invoice.total}</td><td>{invoice.currency} {invoice.amount_paid}</td><td>{invoice.currency} {invoice.balance_due}</td>
                  <td><div className="table-actions">
                    <button type="button" className="btn-secondary" disabled={Boolean(form)} onClick={() => startEdit(invoice)}><Edit2 size={15} /> Edit</button>
                    <button type="button" className="btn-secondary" disabled={downloadingId === invoice.id} onClick={() => download(invoice)}><Download size={15} /> DOCX</button>
                    <button type="button" className="btn-danger" disabled={Boolean(form)} onClick={() => remove(invoice)}><Trash2 size={15} /> Delete</button>
                  </div></td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && <tr><td colSpan="7">No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {form && (
        <section className="data-card invoice-editor" aria-labelledby="invoice-editor-title">
          <div className="data-card-header">
            <h3 id="invoice-editor-title">{editingId ? 'Edit invoice' : 'New invoice'}</h3>
            <button type="button" className="modal-close" aria-label="Close invoice editor" disabled={saving} onClick={() => setForm(null)}><X size={20} /></button>
          </div>
          <form onSubmit={save} className="invoice-form">
            <p>Invoice numbers are generated automatically. Currency is not converted; enter all amounts in the selected currency.</p>
            <div className="form-row">
              <InvoiceField form={form} setForm={setForm} name="issue_date" label="Invoice date" type="date" required />
              <InvoiceField form={form} setForm={setForm} name="due_date" label="Due date (optional)" type="date" min={form.issue_date} />
              <div className="form-group"><label htmlFor="invoice-currency">Invoice currency</label><select id="invoice-currency" value={form.currency} onChange={event => setForm(prev => ({ ...prev, currency: event.target.value }))}><option value="KES">KES</option><option value="USD">USD</option></select></div>
            </div>
            <h4>From (your business)</h4>
            <div className="form-row">
              <InvoiceField form={form} setForm={setForm} name="issuer_name" label="Business name" required maxLength={255} />
              <InvoiceField form={form} setForm={setForm} name="issuer_phone" label="Business phone" maxLength={50} />
              <InvoiceField form={form} setForm={setForm} name="issuer_email" label="Business email" type="email" />
              <InvoiceField form={form} setForm={setForm} name="issuer_tax_id" label="Business tax ID (optional)" maxLength={100} />
            </div>
            <InvoiceField form={form} setForm={setForm} name="issuer_address" label="Business address" type="textarea" />
            <h4>Bill to</h4>
            <div className="form-row">
              <InvoiceField form={form} setForm={setForm} name="client_name" label="Company or customer name" required maxLength={255} />
              <InvoiceField form={form} setForm={setForm} name="client_contact" label="Contact person" maxLength={255} />
              <InvoiceField form={form} setForm={setForm} name="client_email" label="Customer email" type="email" />
              <InvoiceField form={form} setForm={setForm} name="client_phone" label="Customer phone" maxLength={50} />
              <InvoiceField form={form} setForm={setForm} name="client_tax_id" label="Customer tax ID (optional)" maxLength={100} />
            </div>
            <InvoiceField form={form} setForm={setForm} name="client_address" label="Billing address" type="textarea" />
            <InvoiceField form={form} setForm={setForm} name="service_details" label="Trip / service details (optional)" type="textarea" />
            <h4>Invoice items</h4>
            {form.items.map((item, index) => (
              <div className="invoice-item" key={index}>
                <div className="form-group"><label htmlFor={`invoice-item-${index}`}>Description</label><input id={`invoice-item-${index}`} required value={item.description} onChange={event => updateItem(index, 'description', event.target.value)} /></div>
                <div className="form-group"><label htmlFor={`invoice-quantity-${index}`}>Quantity</label><input id={`invoice-quantity-${index}`} type="number" min="0.01" max="999999.99" step="0.01" required value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} /></div>
                <div className="form-group"><label htmlFor={`invoice-price-${index}`}>Unit price ({form.currency})</label><input id={`invoice-price-${index}`} type="number" min="0" max="9999999999.99" step="0.01" required value={item.unit_price} onChange={event => updateItem(index, 'unit_price', event.target.value)} /></div>
                <button type="button" className="btn-danger" disabled={form.items.length === 1} onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-secondary" disabled={form.items.length >= 50} onClick={() => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))}><Plus size={16} /> Add item</button>
            <div className="form-row invoice-amounts">
              <InvoiceField form={form} setForm={setForm} name="tax_rate" label="Tax rate (%; added to subtotal)" type="number" min="0" max="100" step="0.01" required />
              <InvoiceField form={form} setForm={setForm} name="amount_paid" label={`Amount already paid (${form.currency})`} type="number" min="0" max="9999999999.99" step="0.01" required />
            </div>
            <div className="invoice-totals" aria-live="polite">
              {totals ? <>
                <p>Subtotal: {formatHundredths(totals.subtotal, form.currency)}</p>
                <p>Tax: {formatHundredths(totals.tax, form.currency)}</p>
                <p>Total: {formatHundredths(totals.total, form.currency)}</p>
                <strong>{totals.balance < 0n ? 'Amount paid cannot exceed the total.' : `Balance due: ${formatHundredths(totals.balance, form.currency)}`}</strong>
              </> : <p>Enter valid quantities, prices, tax and amount paid to calculate totals.</p>}
            </div>
            <InvoiceField form={form} setForm={setForm} name="payment_instructions" label="Payment instructions" type="textarea" />
            <InvoiceField form={form} setForm={setForm} name="booking_terms" label="Booking terms" type="textarea" />
            <InvoiceField form={form} setForm={setForm} name="notes" label="Additional notes" type="textarea" />
            <div className="invoice-actions">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn-secondary" disabled={saving || !totals || totals.balance < 0n}>{saving ? 'Saving...' : 'Save invoice'}</button>
              <button type="submit" className="btn-primary" value="download" disabled={saving || !totals || totals.balance < 0n}><Download size={17} /> Save and download DOCX</button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
