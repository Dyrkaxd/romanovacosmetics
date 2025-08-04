// This is a simple wrapper around the native fetch API.
// It automatically adds the Authorization header to requests.

export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('authToken');

  // If there's no token, we cannot make an authenticated request.
  // Redirect to login and stop the execution flow.
  if (!token) {
    console.error('Authentication error: No token found. Redirecting to login.');
    localStorage.removeItem('authToken');
    window.location.hash = '/login';
    // Return a promise that never resolves to prevent the caller from continuing.
    return new Promise<Response>(() => {});
  }

  // Create a new Headers object based on existing headers or create a new one.
  const headers = new Headers(options.headers || {});
  
  headers.set('Authorization', `Bearer ${token}`);

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
    localStorage.removeItem('authToken');
    // Force a reload to redirect to the login page via the App's routing logic.
    window.location.hash = '/login';
    // Return a promise that never resolves to prevent the caller from continuing.
    return new Promise<Response>(() => {});
  }

  return response;
};
