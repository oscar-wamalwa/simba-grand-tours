import { useEffect, useState } from 'react';
import { Gift, MessageCircle } from 'lucide-react';
import api from '../api';

const storageKey = safariId => `promo-pool-${safariId}`;

function readClaim(safariId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(safariId)) || 'null');
  } catch {
    return null;
  }
}

export default function PromoReveal({ safari, settings, formatPrice }) {
  const [counts, setCounts] = useState(null);
  const [claim, setClaim] = useState(() => readClaim(safari.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setClaim(readClaim(safari.id));
    setError('');
    api.promoPool.getStatus().then(setCounts).catch(() => setCounts(null));
  }, [safari.id]);

  const getCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.promoPool.claim(safari.id);
      localStorage.setItem(storageKey(safari.id), JSON.stringify(result));
      setClaim(result);
      setCounts({ total: result.total, remaining: result.remaining });
    } catch (requestError) {
      setError(requestError.message || 'Could not get a code. Please try again.');
      api.promoPool.getStatus().then(setCounts).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  if (!claim && !(counts && counts.remaining > 0)) return null;

  const whatsappNumber = String(settings.whatsapp || settings.sitePhone || '').replace(/\D/g, '');
  const till = settings.mpesaTillNumber;
  const message = claim && [
    `Hello Simba Grand Tours, I would like to book ${safari.title}.`,
    `Promo code: ${claim.code}`,
    `Discounted price: ${formatPrice(claim.discounted_price_kes)} per person`,
  ].join('\n');

  return (
    <section className="promo-reveal" aria-label="Promo code">
      {!claim ? (
        <>
          <div>
            <h3><Gift size={20} /> Get a promo code</h3>
            <p>{counts.remaining} of {counts.total} codes left. First come, first served.</p>
          </div>
          <button type="button" className="btn-gold" onClick={getCode} disabled={loading}>
            {loading ? 'Getting code...' : 'Get Code'}
          </button>
          {error && <p className="form-status error" role="alert">{error}</p>}
        </>
      ) : (
        <div className="promo-reveal-result" role="status">
          <h3><Gift size={20} /> Your code: <strong>{claim.code}</strong></h3>
          <p className="promo-price">
            <s>{formatPrice(claim.original_price_kes)}</s>{' '}
            <strong>{formatPrice(claim.discounted_price_kes)}</strong> per person
            <small> (KES {Number(claim.discount_kes).toLocaleString()} off)</small>
          </p>
          {till && (
            <p className="promo-mpesa">
              Pay via M-Pesa Till <strong>{till}</strong>
              {settings.mpesaTillName ? ` (${settings.mpesaTillName})` : ''}
            </p>
          )}
          {whatsappNumber && (
            <a
              className="btn-gold btn-large"
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} /> Book &amp; Send on WhatsApp
            </a>
          )}
        </div>
      )}
    </section>
  );
}
