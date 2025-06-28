"use client";

import { useEffect, useState } from "react";
import { User, Room, PlaybackState } from "@/lib/types";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoomHeader } from "@/components/room/room-header";
import { SongQueue } from "@/components/room/song-queue";
import { AddSongForm } from "@/components/room/add-song-form";
import { ParticipantList } from "@/components/room/participant-list";
import { YouTubePlayer } from "@/components/room/youtube-player";

interface RoomClientProps {
  room: Room;
  currentUser: User;
  participants: any[];
  isHost: boolean;
}

export function RoomClient({ 
  room, 
  currentUser, 
  participants, 
  isHost 
}: RoomClientProps) {
  const [songs, setSongs] = useState<any[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentParticipants, setCurrentParticipants] = useState(participants);
  const { toast } = useToast();
  
  // Initialize playback state
  useEffect(() => {
    const initializePlaybackState = async () => {
      try {
        const response = await fetch("/api/playback/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          console.error("Error initializing playback state:", data.error);
        } else {
          console.log("Playback state initialized successfully");
        }
      } catch (error) {
        console.error("Error initializing playback state:", error);
      }
    };
    
    if (isHost) {
      initializePlaybackState();
    }
  }, [room.id, isHost]);
  
  useEffect(() => {
    const supabase = createSupabaseClient();
    
    // Initial fetch of songs
    const fetchSongs = async () => {
      const { data, error } = await supabase
        .from("songs")
        .select(`
          *,
          votes:votes(vote_type, user_id)
        `)
        .eq("room_id", room.id)
        .eq("is_played", false)
        .order("id", { ascending: true });
      
      if (error) {
        console.error("Error fetching songs:", error);
        return;
      }
      
      // Process songs to include vote counts
      const processedSongs = data.map(song => {
        const upvotes = song.votes?.filter((v: any) => v.vote_type === 'up').length || 0;
        const downvotes = song.votes?.filter((v: any) => v.vote_type === 'down').length || 0;
        const userVote = song.votes?.find((v: any) => v.user_id === currentUser.id)?.vote_type || null;
        
        return {
          ...song,
          votes_count: upvotes - downvotes,
          user_vote: userVote,
        };
      });
      
      // Sort by votes count (descending)
      processedSongs.sort((a, b) => b.votes_count - a.votes_count);
      setSongs(processedSongs);
      
      // If we're the host and there's a song but no current song playing, set the first song as current
      if (isHost && processedSongs.length > 0 && (!playbackState || !playbackState.current_song_id)) {
        const firstSong = processedSongs[0];
        console.log("Setting first song as current:", firstSong.title);
        
        try {
          await fetch("/api/playback", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              roomId: room.id,
              currentSongId: firstSong.id,
              currentTime: 0,
              isPlaying: true,
            }),
          });
        } catch (error) {
          console.error("Error setting first song as current:", error);
        }
      }
    };
    
    // Initial fetch of playback state
    const fetchPlaybackState = async () => {
      const { data, error } = await supabase
        .from("playback_state")
        .select()
        .eq("room_id", room.id)
        .single();
      
      if (error) {
        console.error("Error fetching playback state:", error);
        return;
      }
      
      console.log("Fetched playback state:", data);
      setPlaybackState(data);
    };
    
    // Subscribe to song changes
    const songSubscription = supabase
      .channel('songs-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'songs', filter: `room_id=eq.${room.id}` },
        fetchSongs
      )
      .subscribe();
    
    // Subscribe to votes changes
    const votesSubscription = supabase
      .channel('votes-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'votes' },
        fetchSongs
      )
      .subscribe();
    
    // Subscribe to playback state changes
    const playbackSubscription = supabase
      .channel('playback-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'playback_state', filter: `room_id=eq.${room.id}` },
        fetchPlaybackState
      )
      .subscribe();
    
    // Subscribe to participant changes
    const participantSubscription = supabase
      .channel('participants-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${room.id}` },
        async () => {
          // Fetch updated participant list
          const { data, error } = await supabase
            .from("room_participants")
            .select(`
              user_id,
              joined_at,
              users:user_id (
                name,
                image
              )
            `)
            .eq("room_id", room.id);
          
          if (error) {
            console.error("Error fetching participants:", error);
            return;
          }
          
          setCurrentParticipants(data);
        }
      )
      .subscribe();
    
    // Initial data fetch
    fetchSongs();
    fetchPlaybackState();
    
    // Cleanup subscriptions
    return () => {
      songSubscription.unsubscribe();
      votesSubscription.unsubscribe();
      playbackSubscription.unsubscribe();
      participantSubscription.unsubscribe();
    };
  }, [room.id, currentUser.id, isHost, playbackState]);
  
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <RoomHeader 
        roomId={room.id} 
        isHost={isHost}
      />
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        <div className="lg:col-span-2 space-y-6">
          {/* YouTube player (visible to everyone now for testing) */}
          {playbackState && (
            <YouTubePlayer 
              playbackState={playbackState}
              roomId={room.id}
              songs={songs}
              currentUser={currentUser}
            />
          )}
          
          {/* Song queue */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Song Queue</h2>
            <AddSongForm 
              roomId={room.id} 
              userId={currentUser.id} 
            />
            <SongQueue 
              songs={songs}
              currentUser={currentUser}
              roomId={room.id}
            />
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <ParticipantList 
            participants={currentParticipants}
            hostId={room.host_id}
          />
        </div>
      </div>
    </div>
  );
} 