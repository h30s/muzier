"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/lib/supabase/client";
import { User, PlaybackState, Song } from "@/lib/types";
import YouTubePlayer from "youtube-player";
import { Play, Pause, SkipForward } from "lucide-react";

interface YouTubePlayerProps {
  playbackState: PlaybackState;
  roomId: string;
  songs: Song[];
  currentUser: User;
}

export function YouTubePlayer({ 
  playbackState, 
  roomId, 
  songs, 
  currentUser 
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const playerElementRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(playbackState.is_playing);
  const [currentSong, setCurrentSong] = useState<Song | null>(
    songs.find((s) => s.id === playbackState.current_song_id) || null
  );
  
  // Initialize YouTube player
  useEffect(() => {
    if (!playerElementRef.current) return;
    
    playerRef.current = YouTubePlayer(playerElementRef.current, {
      width: '100%',
      height: '360',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
    });
    
    // Set up event listeners
    playerRef.current.on('ready', () => {
      setIsReady(true);
    });
    
    playerRef.current.on('stateChange', (event: any) => {
      // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
      if (event.data === 0) {
        // Video ended, play next song
        handlePlayNext();
      }
    });
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);
  
  // Update player when current song changes
  useEffect(() => {
    const newCurrentSong = songs.find((s) => s.id === playbackState.current_song_id) || null;
    setCurrentSong(newCurrentSong);
    
    if (isReady && newCurrentSong && playerRef.current) {
      playerRef.current.loadVideoById(newCurrentSong.youtube_id, playbackState.current_time);
      
      if (playbackState.is_playing) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [playbackState.current_song_id, isReady, songs]);
  
  // Sync playback state
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    const syncInterval = setInterval(async () => {
      try {
        const currentTime = await playerRef.current.getCurrentTime();
        const playerState = await playerRef.current.getPlayerState();
        const isPlayerPlaying = playerState === 1; // 1 = playing
        
        // Only update if there's a significant change to avoid unnecessary updates
        if (
          Math.abs(currentTime - playbackState.current_time) > 2 ||
          isPlayerPlaying !== playbackState.is_playing
        ) {
          const supabase = createSupabaseClient();
          await supabase
            .from("playback_state")
            .update({
              current_time: currentTime,
              is_playing: isPlayerPlaying,
            })
            .eq("room_id", roomId);
        }
      } catch (error) {
        console.error("Error syncing playback state:", error);
      }
    }, 2000); // Sync every 2 seconds
    
    return () => clearInterval(syncInterval);
  }, [isReady, playbackState, roomId]);
  
  // Play/pause controls
  const handlePlayPause = async () => {
    if (!playerRef.current || !isReady) return;
    
    try {
      const supabase = createSupabaseClient();
      
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        
        await supabase
          .from("playback_state")
          .update({
            is_playing: false,
          })
          .eq("room_id", roomId);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        
        await supabase
          .from("playback_state")
          .update({
            is_playing: true,
          })
          .eq("room_id", roomId);
      }
    } catch (error) {
      console.error("Error updating playback state:", error);
    }
  };
  
  // Play next song
  const handlePlayNext = async () => {
    if (songs.length === 0) return;
    
    try {
      // Mark current song as played
      if (currentSong) {
        const supabase = createSupabaseClient();
        await supabase
          .from("songs")
          .update({
            is_played: true,
          })
          .eq("id", currentSong.id);
      }
      
      // Get next song (highest voted)
      const nextSong = songs[0];
      
      if (nextSong) {
        const supabase = createSupabaseClient();
        await supabase
          .from("playback_state")
          .update({
            current_song_id: nextSong.id,
            current_time: 0,
            is_playing: true,
          })
          .eq("room_id", roomId);
        
        if (playerRef.current && isReady) {
          playerRef.current.loadVideoById(nextSong.youtube_id);
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      } else {
        // No more songs in queue
        const supabase = createSupabaseClient();
        await supabase
          .from("playback_state")
          .update({
            current_song_id: null,
            current_time: 0,
            is_playing: false,
          })
          .eq("room_id", roomId);
        
        if (playerRef.current) {
          playerRef.current.stopVideo();
        }
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Error playing next song:", error);
    }
  };
  
  return (
    <Card>
      <CardContent className="p-0">
        <div className="aspect-video bg-black">
          <div ref={playerElementRef} />
        </div>
        
        <div className="p-4 flex justify-between items-center">
          <div className="flex-1">
            <h3 className="font-medium truncate">
              {currentSong ? currentSong.title : "No song selected"}
            </h3>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              disabled={!isReady || !currentSong}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayNext}
              disabled={!isReady || songs.length === 0}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 