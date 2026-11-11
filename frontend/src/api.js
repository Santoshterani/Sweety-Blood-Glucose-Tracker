// Small fetch wrapper. Every failed call throws an ApiError carrying the server's message
// and its per-field messages ({ value: "...", date: "..." }), so forms can show them next to the right input.

const TOKEN_KEY = 'sweety_token';

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: user will simply have to log in again next time */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, path, body) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // An expired token on a protected call means "log in again". (Wrong password on /auth/login is a 401 too, so skip it.)
    if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(res.status, data.error || 'Something went wrong. Please try again.', data.errors);
  }
  return data;
}

export const api = {
  signup: (body) => request('POST', '/auth/signup', body),
  login: (body) => request('POST', '/auth/login', body),
  me: () => request('GET', '/auth/me'),
  slots: () => request('GET', '/slots'),
  listReadings: (date) => request('GET', `/readings?limit=100${date ? `&date=${date}` : ''}`),
  createReading: (body) => request('POST', '/readings', body),
  updateReading: (id, body) => request('PUT', `/readings/${id}`, body),
  deleteReading: (id) => request('DELETE', `/readings/${id}`),
  report: (type, date) => request('GET', `/reports/${type}?date=${date}`),
};
