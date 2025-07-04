"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaybackState, Song } from "@/lib/types";
import { Play, Pause, Loader2, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface YouTubePlayerProps {
  currentSong: {
    id: number;
    youtube_id: string;
    title: string;
    thumbnail?: string;
    duration?: number;
    added_by?: string;
    is_played?: boolean;
    created_at?: string;
    room_id?: string;
  };
  playbackState: PlaybackState;
  onVideoEnded: () => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function YoutubePlayer({
  currentSong,
  playbackState,
  onVideoEnded
}: YouTubePlayerProps) {
  // States
  const [playerReady, setPlayerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoEndedRef = useRef<boolean>(false);
  const autoplayNextRef = useRef<boolean>(true);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Toast
  const { toast } = useToast();

  // Load YouTube API
  useEffect(() => {
    // If YouTube API is already loaded
    if (window.YT) {
      console.log("YouTube API already loaded");
      initializePlayer();
      return;
    }
    
    // Create and load the script
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    
    // Set callback for when API is ready
    window.onYouTubeIframeAPIReady = initializePlayer;
    
    // Add script to page
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    
    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying YouTube player:", e);
        }
      }
    };
  }, []);

  // Initialize player
  const initializePlayer = () => {
    if (!containerRef.current || playerRef.current) return;
    
    console.log("Initializing YouTube player");
    
    // Create container for player
    const playerId = 'youtube-player';
    let playerContainer = document.getElementById(playerId);
    
    if (!playerContainer) {
      playerContainer = document.createElement('div');
      playerContainer.id = playerId;
      containerRef.current.appendChild(playerContainer);
    }
    
    // Create player
    playerRef.current = new window.YT.Player(playerId, {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handlePlayerStateChange,
        onError: handlePlayerError
      }
    });
  };

  // Handle player ready event
  const handlePlayerReady = (event: any) => {
    console.log("YouTube player is ready");
    setPlayerReady(true);
    setIsLoading(false);
    
    // Set initial volume
    try {
      event.target.setVolume(volume);
      
      // Check if we should be muted (from browser's stored preferences)
      const isMutedNow = event.target.isMuted();
      setIsMuted(isMutedNow);
    } catch (e) {
      console.error("Error setting initial volume:", e);
    }
    
    // Load current song if available
    if (currentSong?.youtube_id) {
      loadVideo(currentSong.youtube_id, playbackState.playback_position || 0);
    }
  };

  // Handle player state changes
  const handlePlayerStateChange = (event: any) => {
    const states = {
      '-1': 'UNSTARTED',
      '0': 'ENDED',
      '1': 'PLAYING',
      '2': 'PAUSED',
      '3': 'BUFFERING',
      '5': 'CUED'
    };
    
    const stateName = states[event.data.toString()] || event.data;
    console.log(`Player state changed: ${stateName}`);
    
    // Handle video ended
    if (event.data === window.YT.PlayerState.ENDED && !videoEndedRef.current) {
      videoEndedRef.current = true;
      console.log("Video ended, calling onVideoEnded");
      
      // Set autoplay flag to true to ensure next video plays automatically
      autoplayNextRef.current = true;
      
      // Call the onVideoEnded callback which will trigger loading the next song
      onVideoEnded();
    }
    
    // Reset videoEnded flag when video starts playing
    if (event.data === window.YT.PlayerState.PLAYING) {
      videoEndedRef.current = false;
    }
  };

  // Handle player errors
  const handlePlayerError = (event: any) => {
    const errorCodes = {
      2: "Invalid video ID",
      5: "HTML5 player error",
      100: "Video not found or removed",
      101: "Video owner doesn't allow embedding",
      150: "Video owner doesn't allow embedding"
    };
    
    const errorMessage = errorCodes[event.data as keyof typeof errorCodes] || `Error code ${event.data}`;
    console.error(`YouTube player error: ${errorMessage}`);
    
    toast({
      title: "Video Playback Error",
      description: errorMessage,
      variant: "destructive"
    });
  };

  // Load video helper function
  const loadVideo = (videoId: string, startSeconds: number = 0) => {
    if (!playerRef.current || !playerReady) return;
    
    console.log(`Loading video: ${videoId} at ${startSeconds}s`);
    setIsLoading(true);
    
    try {
      // If playback is paused and autoplay is not set, cue the video instead of loading it
      if (!playbackState.is_playing && !autoplayNextRef.current) {
        console.log("Cueing video (no autoplay)");
        playerRef.current.cueVideoById({
          videoId: videoId,
          startSeconds: startSeconds
        });
      } else {
        console.log("Loading video with autoplay");
        playerRef.current.loadVideoById({
          videoId: videoId,
          startSeconds: startSeconds
        });
        
        // If we're supposed to be paused but autoplay was set, reset it after loading
        if (!playbackState.is_playing) {
          setTimeout(() => {
            playerRef.current.pauseVideo();
          }, 500);
        }
      }
      
      // Reset autoplay flag after use
      autoplayNextRef.current = false;
    } catch (e) {
      console.error("Error loading video:", e);
      toast({
        title: "Error Loading Video",
        description: "Failed to load the video. Please try refreshing the page.",
        variant: "destructive"
      });
    } finally {
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  // Update player when current song changes
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    
    if (currentSong?.youtube_id) {
      videoEndedRef.current = false;
      
      // If this is a new song (different ID), ensure autoplay is enabled
      // if playback state is playing (meaning playback has been manually started at least once)
      if (playerRef.current.getVideoData && 
          playerRef.current.getVideoData().video_id !== currentSong.youtube_id) {
        console.log("New song detected, checking autoplay");
        if (playbackState.is_playing) {
          console.log("Playback is active, enabling autoplay for next song");
          autoplayNextRef.current = true;
        }
      }
      
      loadVideo(currentSong.youtube_id, playbackState.playback_position || 0);
    } else {
      console.log("No song to play");
      try {
        playerRef.current.stopVideo();
      } catch (e) {
        console.error("Error stopping video:", e);
      }
    }
  }, [currentSong?.id, playerReady, playbackState.is_playing]);

  // Update playback state
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    
    console.log("Playback state updated:", playbackState);
    
    try {
      if (playbackState.is_playing || autoplayNextRef.current) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.error("Error updating playback state:", e);
    }
  }, [playbackState.is_playing, playerReady]);

  // Manual play/pause toggle
  const togglePlayback = () => {
    if (!playerRef.current || !playerReady) return;
    
    try {
      const state = playerRef.current.getPlayerState();
      if (state === window.YT.PlayerState.PLAYING) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.error("Error toggling playback:", e);
    }
  };

  // Add a safety timer to check for video end
  useEffect(() => {
    let endCheckTimer: NodeJS.Timeout | null = null;
    
    // If we have a player and a video is loaded, start the safety timer
    if (playerRef.current && playerReady && currentSong?.youtube_id) {
      console.log("Starting end check timer for video:", currentSong.youtube_id);
      
      endCheckTimer = setInterval(() => {
        try {
          // Check if player exists and is ready
          if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;
          
          const state = playerRef.current.getPlayerState();
          
          // Only check if the video is playing
          if (state === window.YT.PlayerState.PLAYING) {
            // Get current time and duration
            const currentTime = playerRef.current.getCurrentTime() || 0;
            const duration = playerRef.current.getDuration() || 0;
            
            // If we're near the end of the video and haven't processed the end yet
            if (duration > 0 && currentTime > 0 && duration - currentTime <= 1.5 && !videoEndedRef.current) {
              console.log(`Video near end (${currentTime.toFixed(1)}/${duration.toFixed(1)}), triggering end handler`);
              videoEndedRef.current = true;
              
              // Set autoplay flag to true to ensure next video plays automatically
              autoplayNextRef.current = true;
              
              onVideoEnded();
            }
          }
        } catch (e) {
          console.error("Error in end check timer:", e);
        }
      }, 1000);
    }
    
    // Clean up timer on unmount or when video changes
    return () => {
      if (endCheckTimer) {
        clearInterval(endCheckTimer);
      }
    };
  }, [playerReady, currentSong?.youtube_id, onVideoEnded]);

  // Add a timer to update progress bar
  useEffect(() => {
    // Clear any existing timer
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    
    // Only start the timer if player is ready and we have a current song
    if (playerRef.current && playerReady && currentSong?.youtube_id) {
      progressTimerRef.current = setInterval(() => {
        try {
          // Check if player exists and is ready
          if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
          
          // Get current time and duration
          const time = playerRef.current.getCurrentTime() || 0;
          const totalDuration = playerRef.current.getDuration() || 0;
          
          setCurrentTime(time);
          setDuration(totalDuration);
        } catch (e) {
          console.error("Error updating progress:", e);
        }
      }, 1000);
    }
    
    // Clean up timer on unmount or when video changes
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [playerReady, currentSong?.youtube_id]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    
    if (playerRef.current && playerReady) {
      try {
        playerRef.current.setVolume(newVolume);
        
        // Update mute state
        if (newVolume === 0) {
          setIsMuted(true);
        } else if (isMuted) {
          setIsMuted(false);
        }
      } catch (e) {
        console.error("Error setting volume:", e);
      }
    }
  };
  
  // Handle mute toggle
  const toggleMute = () => {
    if (playerRef.current && playerReady) {
      try {
        if (isMuted) {
          // Unmute
          playerRef.current.unMute();
          playerRef.current.setVolume(volume === 0 ? 50 : volume);
          setVolume(volume === 0 ? 50 : volume);
          setIsMuted(false);
        } else {
          // Mute
          playerRef.current.mute();
          setIsMuted(true);
        }
      } catch (e) {
        console.error("Error toggling mute:", e);
      }
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Video Container */}
        <div className="aspect-video bg-black relative">
          <div ref={containerRef} className="w-full h-full absolute inset-0" />
          
          {/* Loading Overlay */}
          {(isLoading || !playerReady || !currentSong) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p>Loading video...</p>
                </div>
              ) : !currentSong ? (
                <p>No song selected</p>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin" />
              )}
            </div>
          )}
          
          {/* Debug info */}
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2">
            <div>
              Song: {currentSong ? `${currentSong.title} (${currentSong.youtube_id})` : 'None'}
            </div>
            <div>
              Player: {playerReady ? 'Ready' : 'Not ready'} | 
              Playing: {playbackState.is_playing ? 'Yes' : 'No'} | 
              Autoplay Next: {autoplayNextRef.current ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-1">
          <div 
            className="bg-primary h-1 transition-all duration-300 ease-in-out"
            style={{ 
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
            }}
          />
        </div>
        
        {/* Controls */}
        <div className="p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h3 className="font-medium truncate">
                {currentSong ? currentSong.title : "No song selected"}
              </h3>
            </div>
            
            {/* Time Display */}
            <div className="text-sm text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayback}
                disabled={!currentSong || !playerReady}
              >
                {playbackState.is_playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleMute}
                  disabled={!currentSong || !playerReady}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={!currentSong || !playerReady}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (currentSong) {
                    videoEndedRef.current = true;
                    autoplayNextRef.current = true;
                    onVideoEnded();
                  }
                }}
              >
                Skip
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (playerRef.current && playerReady && currentSong) {
                    try {
                      // Force reload the current video
                      console.log("Force reloading video");
                      autoplayNextRef.current = true;
                      playerRef.current.loadVideoById({
                        videoId: currentSong.youtube_id,
                        startSeconds: 0
                      });
                    } catch (e) {
                      console.error("Error reloading video:", e);
                    }
                  }
                }}
              >
                Reload
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 