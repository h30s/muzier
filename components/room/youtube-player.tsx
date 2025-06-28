"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, PlaybackState, Song } from "@/lib/types";
import { Play, Pause, SkipForward } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [isPlaying, setIsPlaying] = useState(playbackState.is_playing);
  const [currentSong, setCurrentSong] = useState<Song | null>(
    songs.find((s) => s.id === playbackState.current_song_id) || null
  );
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Update current song when playback state changes
  useEffect(() => {
    const newCurrentSong = songs.find((s) => s.id === playbackState.current_song_id) || null;
    console.log("Current song updated:", newCurrentSong?.title, "ID:", playbackState.current_song_id);
    setCurrentSong(newCurrentSong);
    setIsPlaying(playbackState.is_playing);
  }, [playbackState.current_song_id, songs, playbackState.is_playing]);
  
  // Play/pause controls
  const handlePlayPause = async () => {
    try {
      const newIsPlaying = !isPlaying;
      setIsPlaying(newIsPlaying);
      
      await fetch("/api/playback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          isPlaying: newIsPlaying,
        }),
      });
      
      // Try to control the iframe player if possible
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const message = newIsPlaying ? 'playVideo' : 'pauseVideo';
        iframeRef.current.contentWindow.postMessage(`{"event":"command","func":"${message}","args":""}`, '*');
      }
    } catch (error) {
      console.error("Error updating playback state:", error);
      toast({
        title: "Error",
        description: "Failed to update playback state",
        variant: "destructive",
      });
    }
  };
  
  // Play next song
  const handlePlayNext = async () => {
    if (songs.length === 0) return;
    
    try {
      // Mark current song as played
      if (currentSong) {
        await fetch("/api/songs/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            songId: currentSong.id,
            isPlayed: true,
          }),
        });
      }
      
      // Get next song (highest voted)
      const nextSong = songs[0];
      
      if (nextSong) {
        await fetch("/api/playback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            currentSongId: nextSong.id,
            currentTime: 0,
            isPlaying: true,
          }),
        });
      } else {
        // No more songs in queue
        await fetch("/api/playback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            currentSongId: null,
            currentTime: 0,
            isPlaying: false,
          }),
        });
      }
    } catch (error) {
      console.error("Error playing next song:", error);
      toast({
        title: "Error",
        description: "Failed to play next song",
        variant: "destructive",
      });
    }
  };
  
  // Build YouTube embed URL
  const getYouTubeEmbedUrl = () => {
    if (!currentSong) return "";
    
    // Base YouTube embed URL with autoplay and controls
    const baseUrl = `https://www.youtube.com/embed/${currentSong.youtube_id}?`;
    
    // Parameters
    const params = new URLSearchParams({
      autoplay: isPlaying ? "1" : "0",
      controls: "1",
      enablejsapi: "1",
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      start: Math.floor(playbackState.playback_position || 0).toString(),
      rel: "0",
      modestbranding: "1"
    });
    
    return baseUrl + params.toString();
  };
  
  return (
    <Card>
      <CardContent className="p-0">
        <div className="aspect-video bg-black">
          {currentSong ? (
            <iframe
              ref={iframeRef}
              width="100%"
              height="100%"
              src={getYouTubeEmbedUrl()}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No song selected
            </div>
          )}
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
              disabled={!currentSong}
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
              disabled={songs.length === 0}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 