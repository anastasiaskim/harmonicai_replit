## API Base URL Configuration

This project uses the `VITE_API_URL` environment variable to configure the base URL for all API requests.

- In development, set `VITE_API_URL=` (empty) in `.env` to use the Vite proxy.
- In production, set `VITE_API_URL=https://yourdomain.com` in `.env.production` to use your deployed backend.

All API calls in the codebase use `import.meta.env.VITE_API_URL` as the base URL. 