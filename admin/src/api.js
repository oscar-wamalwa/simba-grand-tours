// Django REST API Configuration for Simba Grand Tours

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');

function formatApiErrors(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => (
      item && typeof item === 'object' ? `${index + 1}: ${formatApiErrors(item)}` : formatApiErrors(item)
    )).filter(Boolean).join('; ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([field, errors]) => `${field}: ${formatApiErrors(errors)}`).join('; ');
  }
  return String(value ?? '');
}

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('adminToken');
  const { responseType, ...requestOptions } = options;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
    ...requestOptions,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorData;
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = await response.text();
      }
      console.error(`API Error [${endpoint}]:`, errorData);
      const message = errorData?.detail
        || errorData?.message
        || formatApiErrors(errorData);
      const error = new Error(message || `HTTP error! status: ${response.status}`);
      error.code = errorData?.code;
      throw error;
    }
    
    const contentType = response.headers.get('content-type');
    if (responseType === 'docx') {
      if (!contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        throw new Error('The server did not return a Word document.');
      }
      return await response.blob();
    }
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return { success: true };
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

async function getAllPages(endpoint, params = {}) {
  let queryString = new URLSearchParams(params).toString();
  const seen = new Set();
  const results = [];
  do {
    if (seen.has(queryString)) throw new Error(`${endpoint} pagination returned a repeated page.`);
    seen.add(queryString);
    const response = await apiRequest(`${endpoint}${queryString ? `?${queryString}` : ''}`);
    if (Array.isArray(response)) return [...results, ...response];
    results.push(...response.results);
    queryString = response.next ? new URL(response.next, API_BASE_URL + '/').search.slice(1) : '';
  } while (queryString);
  return results;
}

// Safari API
export const safarisApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/safaris/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getById: (id) => apiRequest(`/safaris/${id}/`),
  create: (data) => apiRequest('/safaris/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/safaris/${id}/`, { method: 'PUT', body: data }),
  partialUpdate: (id, data) => apiRequest(`/safaris/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/safaris/${id}/`, { method: 'DELETE' }),
  getSignature: () => apiRequest('/safaris/signature/'),
};

export const destinationsApi = {
  getAll: async () => {
    const response = await apiRequest('/destinations/');
    return response.results || response;
  },
  create: (data) => apiRequest('/destinations/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/destinations/${id}/`, { method: 'PUT', body: data }),
  partialUpdate: (id, data) => apiRequest(`/destinations/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/destinations/${id}/`, { method: 'DELETE' }),
};

export const departuresApi = {
  getAll: (params = {}) => getAllPages('/departures/', params),
  create: (data) => apiRequest('/departures/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/departures/${id}/`, { method: 'PUT', body: data }),
  partialUpdate: (id, data) => apiRequest(`/departures/${id}/`, { method: 'PATCH', body: data }),
  delete: (id, deleteBookings = false) => apiRequest(`/departures/${id}/${deleteBookings ? '?delete_bookings=true' : ''}`, { method: 'DELETE' }),
};

export const bookingsApi = {
  getAll: (params = {}) => getAllPages('/bookings/', params),
  getReport: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/bookings/report/${queryString ? `?${queryString}` : ''}`);
  },
  cancel: (id) => apiRequest(`/bookings/${id}/`, { method: 'PATCH', body: { status: 'cancelled' } }),
  editDetails: (id, data) => apiRequest(`/bookings/${id}/edit-details/`, { method: 'PATCH', body: data }),
  createManual: (data) => apiRequest('/bookings/manual/', { method: 'POST', body: data }),
  editManual: (id, data) => apiRequest(`/bookings/${id}/manual/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/bookings/${id}/`, { method: 'DELETE' }),
};

export const invoicesApi = {
  getAll: () => getAllPages('/invoices/'),
  create: (data) => apiRequest('/invoices/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/invoices/${id}/`, { method: 'PUT', body: data }),
  document: (id) => apiRequest(`/invoices/${id}/document/`, { responseType: 'docx' }),
};

export const promoCodesApi = {
  getAll: async () => {
    const response = await apiRequest('/promocodes/');
    return response.results || response;
  },
  create: (data) => apiRequest('/promocodes/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/promocodes/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/promocodes/${id}/`, { method: 'DELETE' }),
};

export const announcementsApi = {
  getAll: async () => {
    const response = await apiRequest('/announcements/');
    return response.results || response;
  },
  create: (data) => apiRequest('/announcements/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/announcements/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/announcements/${id}/`, { method: 'DELETE' }),
};

export const waitlistApi = {
  getAll: async () => {
    const response = await apiRequest('/waitlist/');
    return response.results || response;
  },
  update: (id, data) => apiRequest(`/waitlist/${id}/`, { method: 'PATCH', body: data }),
};

// Blog API
export const blogsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/blogs/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getById: (id) => apiRequest(`/blogs/${id}/`),
  create: (data) => apiRequest('/blogs/', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/blogs/${id}/`, { method: 'PUT', body: data }),
  partialUpdate: (id, data) => apiRequest(`/blogs/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/blogs/${id}/`, { method: 'DELETE' }),
};

export const blogCommentsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/blog-comments/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  partialUpdate: (id, data) => apiRequest(`/blog-comments/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/blog-comments/${id}/`, { method: 'DELETE' }),
};

// Subscriber API
export const subscribersApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/subscribers/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  create: (data) => apiRequest('/subscribers/', { method: 'POST', body: data }),
  partialUpdate: (id, data) => apiRequest(`/subscribers/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/subscribers/${id}/`, { method: 'DELETE' }),
  sendUpdate: (data) => apiRequest('/subscribers/send_update/', { method: 'POST', body: data }),
};

// Contact Message API
export const messagesApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/contact-messages/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getById: (id) => apiRequest(`/contact-messages/${id}/`),
  create: (data) => apiRequest('/contact-messages/', { method: 'POST', body: data }),
  partialUpdate: (id, data) => apiRequest(`/contact-messages/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/contact-messages/${id}/`, { method: 'DELETE' }),
  reply: (id, message) => apiRequest(`/contact-messages/${id}/reply/`, { method: 'POST', body: { message } }),
  getUnreadCount: () => apiRequest('/contact-messages/unread_count/'),
  getFeatured: () => apiRequest('/contact-messages/featured/'),
};

// Testimonial API
export const testimonialsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiRequest(`/testimonials/${queryString ? `?${queryString}` : ''}`);
    return response.results || response;
  },
  getById: (id) => apiRequest(`/testimonials/${id}/`),
  create: (data) => apiRequest('/testimonials/', { method: 'POST', body: data }),
  partialUpdate: (id, data) => apiRequest(`/testimonials/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => apiRequest(`/testimonials/${id}/`, { method: 'DELETE' }),
  getFeatured: () => apiRequest('/testimonials/featured/'),
};

// Settings API
export const settingsApi = {
  get: () => apiRequest('/settings/website_settings/'),
  update: (data) => apiRequest('/settings/website_settings/', { method: 'PATCH', body: data }),
};

export const authApi = {
  login: async (username, password) => {
    const baseUrl = API_BASE_URL.replace(/\/api$/, '');
    const response = await fetch(`${baseUrl}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      throw new Error('Invalid username or password');
    }
    return response.json();
  }
};

export default {
  safaris: safarisApi,
  destinations: destinationsApi,
  departures: departuresApi,
  bookings: bookingsApi,
  invoices: invoicesApi,
  promoCodes: promoCodesApi,
  announcements: announcementsApi,
  waitlist: waitlistApi,
  blogs: blogsApi,
  blogComments: blogCommentsApi,
  subscribers: subscribersApi,
  messages: messagesApi,
  testimonials: testimonialsApi,
  settings: settingsApi,
  auth: authApi,
};
