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

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:
```
ELEVENLABS_API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 