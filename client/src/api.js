// Django REST API Configuration for Simba Grand Tours (Client)

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // If body is provided, stringify it
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const fieldMessage = Object.entries(errorData)
        .filter(([key]) => key !== 'detail')
        .map(([key, value]) => `${key}: ${[].concat(value).join(' ')}`)
        .join(' ');
      const message = response.status === 429
        ? 'You have sent too many requests. Please wait a while and try again.'
        : errorData.detail || fieldMessage;
      throw new Error(message || `Something went wrong (error ${response.status}). Please try again.`);
    }
    
    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return { success: true };
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// Safari API
export const safarisApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/safaris/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getById: (id) => apiRequest(`/safaris/${id}/`),
  getSignature: () => apiRequest('/safaris/signature/'),
};

export const destinationsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/destinations/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
};

async function getDeparturePages(params, include, limit = Infinity) {
  let query = new URLSearchParams(params).toString();
  const seen = new Set();
  const departures = [];
  do {
    if (seen.has(query)) throw new Error('Departure pagination returned a repeated page.');
    seen.add(query);
    const response = await apiRequest(`/departures/${query ? `?${query}` : ''}`);
    const results = Array.isArray(response) ? response : response.results;
    if (!Array.isArray(results)) throw new Error('Invalid departure list response.');
    departures.push(...results.filter(include));
    query = departures.length >= limit || Array.isArray(response) || !response.next
      ? null
      : new URL(response.next, API_BASE_URL + '/').search.slice(1);
  } while (query !== null);
  return departures.slice(0, limit);
}

export const departuresApi = {
  getForSafari: (safariId) => getDeparturePages({ safari: safariId }, () => true),
  getUpcoming: () => getDeparturePages({}, departure => departure.seats_available > 0, 15),
};

export const bookingsApi = {
  create: (data) => apiRequest('/bookings/create/', { method: 'POST', body: data }),
  getStatus: (reference) => apiRequest(`/bookings/${encodeURIComponent(reference)}/status/`),
};

export const promoPoolApi = {
  getStatus: (safari, code = '') => apiRequest(`/promo-pool-public/status/?safari=${encodeURIComponent(safari)}${code ? `&code=${encodeURIComponent(code)}` : ''}`),
  claim: (safari) => apiRequest('/promo-pool-public/claim/', { method: 'POST', body: { safari } }),
};

export const waitlistApi = {
  create: (data) => apiRequest('/waitlist/', { method: 'POST', body: data }),
};

export const announcementsApi = {
  getAll: async () => {
    const response = await apiRequest('/announcements/');
    return response.results || response;
  },
};

// Blog API
export const blogsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/blogs/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  create: (data) => apiRequest('/blogs/', { method: 'POST', body: data }),
};

export const blogCommentsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/blog-comments/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  create: (data) => apiRequest('/blog-comments/', { method: 'POST', body: data }),
};

// Subscriber API
export const subscribersApi = {
  create: (data) => apiRequest('/subscribers/', { method: 'POST', body: data }),
};

// Contact Message API
export const messagesApi = {
  create: (data) => apiRequest('/contact-messages/', { method: 'POST', body: data }),
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/contact-messages/${queryString ? `?${queryString}` : ''}`);
  },
  getFeatured: () => apiRequest('/contact-messages/featured/'),
};

// Testimonial API
export const testimonialsApi = {
  create: (data) => apiRequest('/testimonials/', { method: 'POST', body: data }),
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/testimonials/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getFeatured: () => apiRequest('/testimonials/featured/'),
};

// Settings API
export const settingsApi = {
  get: () => apiRequest('/settings/website_settings/'),
};

export default {
  safaris: safarisApi,
  destinations: destinationsApi,
  departures: departuresApi,
  bookings: bookingsApi,
  waitlist: waitlistApi,
  promoPool: promoPoolApi,
  announcements: announcementsApi,
  blogs: blogsApi,
  blogComments: blogCommentsApi,
  subscribers: subscribersApi,
  messages: messagesApi,
  testimonials: testimonialsApi,
  settings: settingsApi,
};

