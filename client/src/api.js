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
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
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

export const departuresApi = {
  getForSafari: async (safariId) => {
    const response = await apiRequest(`/departures/?safari=${encodeURIComponent(safariId)}`);
    return response.results || response;
  },
};

export const bookingsApi = {
  create: (data) => apiRequest('/bookings/create/', { method: 'POST', body: data }),
  getStatus: (reference) => apiRequest(`/bookings/${encodeURIComponent(reference)}/status/`),
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
  announcements: announcementsApi,
  blogs: blogsApi,
  subscribers: subscribersApi,
  messages: messagesApi,
  testimonials: testimonialsApi,
  settings: settingsApi,
};

