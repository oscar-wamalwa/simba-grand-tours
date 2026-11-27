const kesFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});
const wholeNumberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const rateEndpoint = 'https://open.er-api.com/v6/latest/USD';
const rateCacheKey = 'simbaUsdKesRate';
const oneDayMs = 24 * 60 * 60 * 1000;

export function readCachedUsdKesRate() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(rateCacheKey));
    const rate = Number(cached?.rate);
    return Number.isFinite(rate) && rate > 0 ? { ...cached, rate } : null;
  } catch (error) {
    console.warn('Could not read the cached USD/KES rate:', error);
    return null;
  }
}

export async function fetchUsdKesRate() {
  const cached = readCachedUsdKesRate();
  const cachedUntil = Number(cached?.nextUpdateUnix) * 1000;
  const cacheIsFresh = cached && (
    (cachedUntil > 0 && Date.now() < cachedUntil)
    || (Date.now() - Number(cached.fetchedAt) < oneDayMs)
  );
  if (cacheIsFresh) return cached;

  const response = await fetch(rateEndpoint);
  if (!response.ok) throw new Error(`Exchange-rate service returned ${response.status}.`);
  const data = await response.json();
  const rate = Number(data?.rates?.KES);
  if (data?.result !== 'success' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Exchange-rate service returned an invalid USD/KES rate.');
  }

  const rateInfo = {
    rate,
    fetchedAt: Date.now(),
    updatedAt: data.time_last_update_utc || '',
    nextUpdateUnix: Number(data.time_next_update_unix) || 0,
  };
  try {
    window.sessionStorage.setItem(rateCacheKey, JSON.stringify(rateInfo));
  } catch (error) {
    console.warn('Could not cache the USD/KES rate:', error);
  }
  return rateInfo;
}

export function formatCurrencyPair(amountKes, displayCurrency = 'KES', usdKesRate) {
  const numericAmount = Number(amountKes);
  const roundedKes = Number.isFinite(numericAmount) ? Math.round(numericAmount) : 0;
  const kesAmount = wholeNumberFormatter.format(roundedKes);
  const rate = Number(usdKesRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return displayCurrency === 'USD' ? 'USD rate unavailable' : `KES ${kesAmount}`;
  }

  const usdAmount = wholeNumberFormatter.format(Math.round(roundedKes / rate));
  return displayCurrency === 'USD'
    ? `USD ${usdAmount} ≈ KES ${kesAmount}`
    : `KES ${kesAmount} ≈ USD ${usdAmount}`;
}

export function formatKes(amount) {
  return kesFormatter.format(Number(amount) || 0);
}
