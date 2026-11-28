// Trip type: what the trip is about.
export const TRIP_TYPES = [
  'Wildlife & Game Drives',
  'Beach Getaway',
  'Hiking & Adventure',
  'Road Trip',
  'Cultural Experience',
  'Corporate & Team Building',
  'Lakeside & Boat Excursions',
];

// Maps older free-text trip types (e.g. "3-Day SGR Beach Getaway") to TRIP_TYPES.
export function normalizeTripType(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const exact = TRIP_TYPES.find(item => item.toLowerCase() === text.toLowerCase());
  if (exact) return exact;
  const lower = text.toLowerCase();
  const rules = [
    ['beach', 'Beach Getaway'],
    ['road', 'Road Trip'],
    ['hik', 'Hiking & Adventure'],
    ['adventure', 'Hiking & Adventure'],
    ['wildlife', 'Wildlife & Game Drives'],
    ['game', 'Wildlife & Game Drives'],
    ['cultur', 'Cultural Experience'],
    ['corporate', 'Corporate & Team Building'],
    ['team', 'Corporate & Team Building'],
    ['lake', 'Lakeside & Boat Excursions'],
    ['boat', 'Lakeside & Boat Excursions'],
  ];
  const rule = rules.find(([keyword]) => lower.includes(keyword));
  return rule ? rule[1] : text;
}

// Trip style: how the trip is organised, paced or accommodated.
export const TRIP_STYLES = [
  { value: 'group_joining', label: 'Group Joining' },
  { value: 'private_custom', label: 'Private & Custom' },
  { value: 'budget', label: 'Budget / Backpacker' },
  { value: 'mid_range', label: 'Mid-Range' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'camping', label: 'Camping' },
  { value: 'sgr_train', label: 'SGR Train Safari' },
  { value: 'solo_family', label: 'Solo Traveller / Family Friendly' },
];

// Older records used group / private / either.
export function normalizeTripStyle(value) {
  if (value === 'group') return 'group_joining';
  if (value === 'private') return 'private_custom';
  if (value === 'either') return 'group_joining';
  return value || '';
}

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
