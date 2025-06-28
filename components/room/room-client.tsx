"use client";

import { useEffect, useState } from "react";
import { User, Room } from "@/lib/types";
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
  const [playbackState, setPlaybackState] = useState<any>(null);
  const [currentParticipants, setCurrentParticipants] = useState(participants);
  const { toast } = useToast();
  
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
  }, [room.id, currentUser.id]);
  
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <RoomHeader 
        roomId={room.id} 
        isHost={isHost}
      />
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        <div className="lg:col-span-2 space-y-6">
          {/* YouTube player (only visible to host) */}
          {isHost && playbackState && (
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