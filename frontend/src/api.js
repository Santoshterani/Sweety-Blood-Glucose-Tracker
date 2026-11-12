// Small fetch wrapper. Every failed call throws an ApiError carrying the server's message
// and its per-field messages ({ value: "...", date: "..." }), so forms can show them next to the right input.

const TOKEN_KEY = 'sweety_token';
const NETWORK_MESSAGE = 'Cannot reach the server. Please check your connection and try again.';

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

/** { a: 1, b: undefined, c: '' } -> '?a=1' */
const query = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const text = qs.toString();
  return text ? `?${text}` : '';
};

async function send(method, path, body) {
  const token = tokenStore.get();
  try {
    return await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE);
  }
}

async function fail(res, path, fallback) {
  const data = await res.json().catch(() => ({}));
  // An expired token on a protected call means "log in again". (Wrong password on /auth/login is a 401 too, so skip it.)
  if (res.status === 401 && tokenStore.get() && !path.startsWith('/auth/login')) onUnauthorized();
  return new ApiError(res.status, data.error || fallback, data.errors);
}

async function request(method, path, body) {
  const res = await send(method, path, body);
  if (res.status === 204) return null;
  if (!res.ok) throw await fail(res, path, 'Something went wrong. Please try again.');
  return res.json();
}

let slotsPromise = null;

export const api = {
  signup: (body) => request('POST', '/auth/signup', body),
  login: (body) => request('POST', '/auth/login', body),
  me: () => request('GET', '/auth/me'),

  // Loaded once and reused; a failure is not remembered.
  slots: () => {
    if (!slotsPromise) {
      slotsPromise = request('GET', '/slots').catch((err) => {
        slotsPromise = null;
        throw err;
      });
    }
    return slotsPromise;
  },

  dashboard: () => request('GET', '/dashboard'),

  listReadings: (params) => request('GET', `/readings${query(params)}`),
  createReading: (body) => request('POST', '/readings', body),
  updateReading: (id, body) => request('PUT', `/readings/${id}`, body),
  deleteReading: (id) => request('DELETE', `/readings/${id}`),

  // type: daily | weekly | monthly | yearly | custom;  params: { date } or { from, to }
  report: (type, params) => request('GET', `/reports/${type}${query(params)}`),

  getProfile: () => request('GET', '/profile'),
  updateProfile: (body) => request('PUT', '/profile', body),
};

/** Downloads the report as a PDF file (the browser saves it). */
export async function downloadReportPdf(type, params) {
  const path = `/reports/pdf${query({ type, ...params })}`;
  const res = await send('GET', path);
  if (!res.ok) throw await fail(res, path, 'Could not create the PDF. Please try again.');

  const blob = await res.blob();
  const header = res.headers.get('Content-Disposition') || '';
  const filename = (header.match(/filename="(.+?)"/) || [])[1] || 'sweety-report.pdf';

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
