import { User as NextAuthUser } from "next-auth";

// Extend NextAuth User type
export interface User extends NextAuthUser {
  id: string;
}

// Room types
export interface Room {
  id: string;
  host_id: string;
  is_active: boolean;
  created_at: string;
}

export interface RoomParticipant {
  room_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
}

// Song types
export interface Song {
  id: number;
  youtube_id: string;
  room_id: string;
  is_played: boolean;
  added_by: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  votes_count?: number;
  user_vote?: 'up' | 'down' | null;
}

export interface Vote {
  song_id: number;
  user_id: string;
  vote_type: 'up' | 'down';
}

// Playback state
export interface PlaybackState {
  room_id: string;
  current_song_id: number | null;
  playback_position: number;
  is_playing: boolean;
} 