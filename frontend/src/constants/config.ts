// Adresse du back-end, configurable via frontend/.env (voir .env.example)
export const SERVER_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const API_URL = `${SERVER_URL}/api`;
