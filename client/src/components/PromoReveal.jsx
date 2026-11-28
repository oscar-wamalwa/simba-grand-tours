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

export function usePromoPool(safari) {
  const safariId = safari?.id;
  const [counts, setCounts] = useState(null);
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = safariId ? readClaim(safariId) : null;
    setClaim(stored);
    setError('');
    setCounts(null);
    if (!safariId) return;
    api.promoPool.getStatus(safariId, stored?.code).then(status => {
      if (stored && status.claim_valid === false) {
        localStorage.removeItem(storageKey(safariId));
        setClaim(null);
      }
      setCounts(status);
    }).catch(() => setCounts(null));
  }, [safariId]);

  const getCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.promoPool.claim(safariId);
      localStorage.setItem(storageKey(safariId), JSON.stringify(result));
      setClaim(result);
      setCounts({ total: result.total, remaining: result.remaining });
    } catch (requestError) {
      setError(requestError.message || 'Could not get a code. Please try again.');
      api.promoPool.getStatus(safariId).then(setCounts).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return { counts, claim, loading, error, getCode, available: !claim && counts?.remaining > 0 };
}

export function GetCodeButton({ promo }) {
  if (!promo.available) return null;
  return (
    <button type="button" className="btn-outline-full get-code-button" onClick={promo.getCode} disabled={promo.loading}
      title={`${promo.counts.remaining} of ${promo.counts.total} codes left`}>
      <Gift size={16} /> {promo.loading ? 'Getting...' : `Get Code (${promo.counts.remaining} of ${promo.counts.total} left)`}
    </button>
  );
}

export function PromoResult({ promo, safari, settings, formatPrice }) {
  const { claim, error } = promo;
  if (!claim && !error) return null;
  if (!claim) return <p className="form-status error" role="alert">{error}</p>;

  const whatsappNumber = String(settings.whatsapp || settings.sitePhone || '').replace(/\D/g, '');
  const till = settings.mpesaTillNumber;
  const message = [
    `Hello Simba Grand Tours, I would like to book ${safari.title}.`,
    `Promo code: ${claim.code}`,
    `Discounted price: ${formatPrice(claim.discounted_price_kes)} per person`,
  ].join('\n');

  return (
    <section className="promo-reveal" aria-label="Promo code">
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
    </section>
  );
}
