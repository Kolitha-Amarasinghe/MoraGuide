const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function getApiUrl(path) {
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(getApiUrl(path), {
      ...options,
      credentials: apiBaseUrl ? 'include' : 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    throw new Error('Cannot reach the MoraGuide server. Start the backend and try again.');
  }

  if (response.status === 204) return null;

  const result = await response.json().catch(() => {
    throw new Error('The server returned an invalid response.');
  });
  if (!response.ok) {
    const error = new Error(result.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
