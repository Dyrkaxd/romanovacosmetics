// This is a simple wrapper around the native fetch API.
// It automatically adds the Authorization header to requests.

export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = sessionStorage.getItem('authToken');

  // Create a new Headers object based on existing headers or create a new one.
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure the Content-Type is set for methods that have a body.
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // This is a critical step for security. If the server responds with 401,
  // it means the token is invalid or expired. We should clear the session.
  if (response.status === 401) {
    console.error('Authentication error: Token is invalid or expired. Forcing logout.');
    sessionStorage.removeItem('authToken');
    // Force a reload to redirect to the login page via the App's routing logic.
    window.location.hash = '/login';
  }

  return response;
};
