# AudioBook Creator - Text to Speech Web Application

A web-based application that converts text content into high-quality audiobooks using AI voice technology.

## Core Functionality

- Upload text files (TXT, EPUB, PDF) or input text directly
- Automatic chapter detection and text chunking
- Text-to-speech conversion using ElevenLabs AI voices
- Audio playback and chapter-by-chapter download
- Modern, responsive user interface

## Technical Architecture

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Radix UI components for accessible UI elements
- React Query for data management
- Wouter for routing
- Framer Motion for animations

### Backend
- Express.js server
- TypeScript
- File processing with Multer
- Database integration with Drizzle ORM
- WebSocket support for real-time features
- Session management and authentication

## Key Features

### Text Processing
- Automatic chapter detection
- Support for multiple file formats (TXT, EPUB, PDF)
- Text extraction and formatting

### Audio Generation
- Integration with ElevenLabs TTS API
- Multiple voice options
- Chapter-by-chapter audio generation

### User Interface
- Clean, modern design
- Responsive layout
- File upload with drag-and-drop
- Audio player controls
- Progress indicators
- Error handling and user feedback

## Project Structure

- `client/`: Frontend React application
- `server/`: Backend Express server
- `shared/`: Common code and types
- `public/`: Static assets
- `uploads/`: Temporary file storage
- `audio/`: Generated audio files
- `test/`: Test files

## Development Features

- Hot module reloading
- TypeScript for type safety
- Development and production builds
- Environment configuration
- Error handling and logging
- Analytics tracking

## Getting Started

### 1. Install dependencies for both backend and frontend:
```bash
cd harmonicai_replit
npm install
cd client
npm install
```

### 2. Start the development servers (in two terminals):
- **Backend:**
  ```bash
  cd harmonicai_replit
  npm run dev
  ```
- **Frontend:**
  ```bash
  cd harmonicai_replit/client
  npm run dev
  ```

Or, use the root-level script (see below) to start both at once.

### 3. Access your app:
Open your browser to the port shown by the frontend (usually http://localhost:5173 or http://localhost:5176).

### 4. Build for production:
```bash
npm run build
```

### 5. Start production server:
```bash
npm start
```

## Running Both Servers with One Command

You can use the `concurrently` package to start both backend and frontend servers with a single command. To set this up:

1. Install concurrently at the root:
   ```bash
   npm install --save-dev concurrently
   ```
2. Add this script to your root `package.json`:
   ```json
   "scripts": {
     "dev:all": "concurrently \"npm run dev\" \"cd client && npm run dev\""
   }
   ```
3. Run both servers:
   ```bash
   npm run dev:all
   ```

## API URLs in Production

- In development, use `/api/...` in your frontend code. The Vite dev server proxies these to the backend.
- In production, make sure your frontend makes requests to the correct backend URL (e.g., `https://yourdomain.com/api/...`), or set up a reverse proxy to forward `/api` requests to your backend.

## Environment Variables

Create a `.env` file in the root directory with the following variables:
```
ELEVENLABS_API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
```

### Security Best Practices

1. **Never commit `.env` files to version control**
   - Add `.env` to your `.gitignore` file
   - Use `.env.example` as a template for required variables
   - Keep sensitive keys secure and rotate them periodically

2. **API Key Security**
   - Store your ElevenLabs API key securely
   - Never expose API keys in client-side code
   - Use environment variables for all sensitive credentials
   - Consider using a secrets management service in production

3. **ElevenLabs API Usage**
   - Free tier: 10,000 characters per month
   - Rate limits: 100 requests per minute
   - Character limits: 5,000 characters per request
   - Monitor usage in your ElevenLabs dashboard
   - Consider implementing request queuing for high-volume usage

4. **Production Deployment**
   - Use different API keys for development and production
   - Implement proper error handling for API rate limits
   - Set up monitoring for API usage and errors
   - Consider implementing a caching layer for frequently used audio

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Production Reverse Proxy Example (Nginx)

To deploy in production, use Nginx to serve your frontend and proxy API requests to your backend:

```
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- Replace `/path/to/frontend/dist` with your actual frontend build output path.
- Make sure your backend is running on port 3000.
- All `/api` requests will be proxied to the backend, everything else will be served as static files. 