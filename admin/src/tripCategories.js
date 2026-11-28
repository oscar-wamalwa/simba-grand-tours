export const TRIP_TYPES = [
  'Wildlife Safari',
  'Beach Getaway',
  'Day Trip',
  'Road Trip',
  'SGR Train Trip',
  'Hiking & Adventure',
  'Cultural Experience',
  'Camping',
  'Honeymoon & Romantic',
  'Corporate & Team Building',
];

export const DURATION_CATEGORIES = ['1 Day', '2 Days', '3 Days', '4 Days', '5 Days', '6-10 Days', 'Over 10 Days'];

// Maps any duration text (e.g. "3 Days / 1 Night") to one of DURATION_CATEGORIES.
export function durationCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  const exact = DURATION_CATEGORIES.find(item => item.toLowerCase() === text);
  if (exact) return exact;
  const match = text.match(/(\d+)\s*-?\s*days?/);
  if (!match) return '';
  const days = Number(match[1]);
  if (days <= 5) return days === 1 ? '1 Day' : `${days} Days`;
  return days <= 10 ? '6-10 Days' : 'Over 10 Days';
}
