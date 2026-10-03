export const environment = {
  production: typeof window !== 'undefined' && window.location.hostname !== 'localhost',
  apiUrl: typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://campus-pulse-eonm.onrender.com'
    : 'http://localhost:5000'
};
