# Tunely - Real-Time Collaborative Music App

> Your Room. Your Queue. Your Music Democracy.

Tunely is a real-time collaborative music application that empowers groups to listen to music together. Think of it as Spotify Group Session meets YouTube meets democracy, built with modern web technologies.

## Features

- **Google Authentication**: Secure sign-in with Google OAuth
- **Room Creation & Management**: Create rooms with unique codes and invite friends
- **YouTube Integration**: Add any YouTube video to the shared queue
- **Democratic Voting**: Vote songs up or down to determine what plays next
- **Synchronized Playback**: Host controls playback while everyone stays in sync
- **Real-Time Updates**: Everything updates instantly across all devices

## Tech Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: TypeScript with strict typing
- **Authentication**: NextAuth.js v5 + Google OAuth
- **Database**: Supabase (Postgres + Realtime + Edge Functions)
- **Styling**: Tailwind CSS + shadcn/ui
- **YouTube API**: YouTube Data API v3 + YouTube Player API
- **Hosting**: Vercel (Optimized for Edge performance)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Google OAuth credentials
- YouTube   API key

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# YouTube API
NEXT_PUBLIC_YOUTUBE_API_KEY=your-youtube-api-key
```

### Database Setup

1. Create a new Supabase project
2. Run the SQL from `schema.sql` in the Supabase SQL editor
3. Enable Realtime for the required tables

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

- `/app`: Next.js app router pages and layouts
- `/components`: React components organized by feature
- `/lib`: Utility functions and type definitions
  - `/supabase`: Supabase client configuration
  - `/youtube`: YouTube API utilities
  - `/types`: TypeScript type definitions

## Usage Flow

1. **Sign In**: Users sign in with Google
2. **Create or Join**: Create a new room or join with a 6-character code
3. **Add Songs**: Paste YouTube URLs to add songs to the queue
4. **Vote**: Everyone votes on songs to determine the play order
5. **Listen Together**: Host controls playback while everyone stays in sync

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [YouTube API](https://developers.google.com/youtube/v3)
