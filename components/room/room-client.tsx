"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Song, User, Room, PlaybackState } from "@/lib/types";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import YoutubePlayer from "./youtube-player";
import AddSongForm from "./add-song-form";
import SongQueue from "./song-queue";
import RoomHeader from "./room-header";
import ParticipantList from "./participant-list";
import { useToast } from "@/hooks/use-toast";
import { Session } from "next-auth";
import { Button } from "@/components/ui/button";

interface RoomClientProps {
  roomId: string;
  room: Room;
  participants: User[];
  session: Session | null;
}

export default function RoomClient({
  roomId,
  room,
  participants,
  session,
}: RoomClientProps) {
  const socket = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const isHost = room.host_id === session?.user?.id;
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentParticipants, setCurrentParticipants] = useState(participants);
  const [isPlaybackInitialized, setIsPlaybackInitialized] = useState(false);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    is_playing: false,
    playback_position: 0,
    timestamp: 0,
    updated_at: 0,
  });
  
  // Update timestamps on client-side only
  useEffect(() => {
    setPlaybackState(prev => ({
      ...prev,
      timestamp: Date.now(),
      updated_at: Date.now()
    }));
    
    // Auto-start playback if there are songs in the queue when component mounts
    if (currentSong && !hasPlaybackStarted) {
      console.log("Auto-starting playback for initial song");
      // We use a small timeout to ensure the component is fully mounted
      const timer = setTimeout(() => {
        startPlayback();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentSong, hasPlaybackStarted]);
  const ws = useRef<WebSocket | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const [webSocketActive, setWebSocketActive] = useState(false);
  const [webSocketError, setWebSocketError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  // Enable debug mode only for room host
  useEffect(() => {
    setIsDebugMode(isHost);
  }, [isHost]);

  // Memoize the refreshQueue function to avoid unnecessary re-renders
  const refreshQueue = useCallback(async () => {
    console.log("Refreshing song queue for room:", roomId);
    try {
      const res = await fetch(`/api/songs?roomId=${roomId}&includeVotes=true`);
      if (!res.ok) {
        throw new Error(`Failed to fetch songs: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Received songs data:", data);
      
      if (data.songs && Array.isArray(data.songs)) {
        console.log(`Found ${data.songs.length} songs in the queue`);
        
        // Log all songs for debugging
        data.songs.forEach((song: Song, index: number) => {
          console.log(`Song ${index+1}:`, {
            id: song.id,
            title: song.title,
            youtube_id: song.youtube_id,
            is_played: song.is_played,
            upvotes: song.upvotes || 0,
            downvotes: song.downvotes || 0
          });
        });
        
        setSongs(data.songs);
        
        // Sort unplayed songs by vote score
        const unplayedSongs = data.songs
          .filter((song: Song) => !song.is_played)
          .sort((a: any, b: any) => {
            const aScore = (a.upvotes || 0) - (a.downvotes || 0);
            const bScore = (b.upvotes || 0) - (b.downvotes || 0);
            return bScore - aScore; // Higher score first
          });
        
        // Get the first unplayed song as the current song
        const nextSong = unplayedSongs[0];
        
        if (nextSong) {
          console.log("Found next song:", nextSong.title, "with vote score:", (nextSong.upvotes || 0) - (nextSong.downvotes || 0));
          
          // Check if we need to update the current song
          const shouldUpdateCurrentSong = !currentSong || currentSong.id !== nextSong.id;
          
          if (shouldUpdateCurrentSong) {
            setCurrentSong(nextSong);
            
            // Auto-start playback if we already have songs playing
            if (hasPlaybackStarted) {
              console.log("Auto-starting playback for next song since playback was already started");
              // We'll let the effect hook handle starting playback when currentSong changes
            }
          }
        } else {
          console.log("No unplayed songs in queue");
          setCurrentSong(null);
        }
      } else {
        console.warn("Invalid songs data returned from API:", data);
      }
      
      return data;
    } catch (error) {
      console.error("Error refreshing queue:", error);
      toast({
        title: "Error",
        description: "Failed to refresh the song queue",
        variant: "destructive"
      });
      return null;
    }
  }, [roomId, toast, currentSong, hasPlaybackStarted]);

  // Handle when the current video ends
  const handleVideoEnded = useCallback(async () => {
    console.log("Video ended callback triggered");
    
    if (!currentSong) {
      console.warn("No current song to mark as played");
      return;
    }
    
    try {
      console.log(`Marking song ${currentSong.id} as played`);
      
      // 1. First mark the current song as played
      const updateResponse = await fetch(`/api/songs/update?roomId=${roomId}&songId=${currentSong.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          played: true 
        })
      });
      
      if (!updateResponse.ok) {
        console.error("Failed to mark song as played:", await updateResponse.text());
      } else {
        console.log("Successfully marked song as played");
      }
      
      // 2. Directly query for the next song to avoid refresh delays
      // Get all unplayed songs and sort them by votes
      const nextSongsResponse = await fetch(`/api/songs?roomId=${roomId}&unplayedOnly=true&includeVotes=true`);
      
      if (nextSongsResponse.ok) {
        const nextSongsData = await nextSongsResponse.json();
        console.log("Next songs data:", nextSongsData);
        
        if (nextSongsData.songs && nextSongsData.songs.length > 0) {
          // Sort songs by vote score (upvotes - downvotes)
          const sortedSongs = [...nextSongsData.songs].sort((a, b) => {
            const aScore = (a.upvotes || 0) - (a.downvotes || 0);
            const bScore = (b.upvotes || 0) - (b.downvotes || 0);
            return bScore - aScore; // Higher score first
          });
          
          // Get the highest voted song
          const nextSong = sortedSongs[0];
          console.log("Setting next song:", nextSong.title, "with vote score:", (nextSong.upvotes || 0) - (nextSong.downvotes || 0));
          
          // Update current song state
          setCurrentSong(nextSong);
          
          // If playback has been manually started at least once, automatically play the next song
          if (hasPlaybackStarted) {
            // Set playback state to playing and position to 0
            const playbackResponse = await fetch(`/api/playback?roomId=${roomId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                is_playing: true,
                playback_position: 0,
                timestamp: Date.now()
              })
            });
            
            if (!playbackResponse.ok) {
              console.warn("Failed to update playback state:", await playbackResponse.text());
            } else {
              console.log("Updated playback state for new song");
              
              // Update playback state locally
              const now = Date.now();
              setPlaybackState({
                is_playing: true,
                playback_position: 0,
                timestamp: now,
                updated_at: now
              });
            }
          } else {
            // If playback hasn't been started manually yet, keep it paused
            console.log("Playback hasn't been manually started yet, keeping next song paused");
            setPlaybackState({
              ...playbackState,
              is_playing: false,
              playback_position: 0
            });
          }
          
          // Force a refresh to ensure UI is updated
          setRefreshCounter(prev => prev + 1);
        } else {
          console.log("No more songs in queue");
          setCurrentSong(null);
          
          // Set playback state to not playing
          setPlaybackState({
            ...playbackState,
            is_playing: false
          });
        }
      } else {
        console.error("Failed to fetch next songs:", await nextSongsResponse.text());
      }
      
      // 3. Finally refresh the entire queue to ensure UI is updated
      refreshQueue();
    } catch (error) {
      console.error("Error handling video ended:", error);
      toast({
        title: "Error",
        description: "Failed to process song completion",
        variant: "destructive"
      });
      
      // Try to refresh the queue anyway
      refreshQueue();
    }
  }, [currentSong, roomId, refreshQueue, toast, playbackState, hasPlaybackStarted]);

  // Handle playback toggling
  const togglePlayback = async () => {
    try {
      const newPlaybackState = { ...playbackState, is_playing: !playbackState.is_playing };
      setPlaybackState(newPlaybackState);
      await fetch(`/api/playback?roomId=${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_playing: newPlaybackState.is_playing,
          playback_position: newPlaybackState.playback_position,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error("Error toggling playback:", error);
      toast({
        title: "Error",
        description: "Failed to toggle playback",
        variant: "destructive"
      });
    }
  };

  // Set up socket connection
  useEffect(() => {
    if (!roomId) return;

    const setupWebSocketConnection = () => {
      // Close any existing connection
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close();
      }

      // Create a new WebSocket connection
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws?roomId=${roomId}`;
        ws.current = new WebSocket(wsUrl);

        // Handle connection open
        ws.current.onopen = () => {
          console.log('WebSocket connection established');
          setWebSocketActive(true);
          setWebSocketError(null);
          // Clear polling interval if it's active
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
        };

        // Handle connection close
        ws.current.onclose = (event) => {
          console.log('WebSocket connection closed', event);
          setWebSocketActive(false);
          // Start polling as fallback
          startPolling();
        };

        // Handle connection error
        ws.current.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          setWebSocketActive(false);
          setWebSocketError('Failed to connect via WebSocket');
          // Start polling as fallback
          startPolling();
        };

        // Handle incoming messages
        ws.current.onmessage = (event) => {
          try {
            console.log('WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            if (data.type === 'ROOM_UPDATE') {
              console.log('Room update received, refreshing data');
              // Trigger a refresh of the room data
              setRefreshCounter(prev => prev + 1);
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
        setWebSocketActive(false);
        setWebSocketError('Failed to set up WebSocket connection');
        // Start polling as fallback
        startPolling();
      }
    };

    const startPolling = () => {
      // Only start if not already polling
      if (!pollingInterval.current) {
        console.log('Starting polling as WebSocket fallback');
        // Poll every 5 seconds
        pollingInterval.current = setInterval(() => {
          setRefreshCounter(prev => prev + 1);
        }, 5000);
      }
    };

    // Set up the initial connection
    setupWebSocketConnection();

    // Reconnect on network status change
    const handleOnline = () => {
      console.log('Network is online, reconnecting WebSocket');
      setupWebSocketConnection();
    };

    window.addEventListener('online', handleOnline);

    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      
      if (ws.current) {
        ws.current.close();
      }
      
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [roomId]);

  // Initialize playback state when joining a room
  useEffect(() => {
    const initializePlayback = async () => {
      if (isPlaybackInitialized) return;
      
      try {
        // Get current playback state from the server
        const res = await fetch(`/api/playback/initialize?roomId=${roomId}`);
        
        if (res.ok) {
          const data = await res.json();
          
          // Update local state with server state, but don't auto-start playback for new users
          if (data.playback_state) {
            // If this is a new user joining, don't auto-play
            const shouldAutoPlay = data.playback_state.is_playing;
            
            setPlaybackState({
              ...data.playback_state,
              is_playing: shouldAutoPlay
            });
            
            console.log("Initialized playback state:", {
              ...data.playback_state,
              is_playing: shouldAutoPlay
            });
          }
          
          setIsPlaybackInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing playback:', error);
      }
    };
    
    if (session && !isPlaybackInitialized) {
      initializePlayback();
    }
  }, [session, roomId, isPlaybackInitialized]);

  // Refresh songs on mount and when refresh counter changes
  useEffect(() => {
    console.log("Running refreshQueue effect with roomId:", roomId, "refreshCounter:", refreshCounter);
    refreshQueue();
  }, [refreshCounter, roomId, refreshQueue]);

  // Display current song info
  const currentSongInfo = currentSong ? {
    id: currentSong.id,
    youtube_id: currentSong.youtube_id,
    title: currentSong.title,
    thumbnail: currentSong.thumbnail,
    duration: currentSong.duration,
    added_by: currentSong.added_by,
    is_played: currentSong.is_played,
    created_at: currentSong.created_at,
    room_id: currentSong.room_id
  } : null;

  const forceRefresh = useCallback(() => {
    console.log("Force refreshing song queue");
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Initialize component and load data
  useEffect(() => {
    // Force immediate load of songs when component mounts
    console.log("Component mounted, forcing immediate data load");
    
    const loadInitialData = async () => {
      try {
        // Force refresh songs
        await refreshQueue();
        
        // Set up polling for songs
        const interval = setInterval(() => {
          console.log("Polling for songs...");
          refreshQueue();
        }, 3000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error("Error in initial data load:", error);
      }
    };
    
    loadInitialData();
  }, [refreshQueue]);  // Include refreshQueue in the dependency array

  // Manual refresh handler for debugging
  const handleManualRefresh = async () => {
    try {
      console.log("Manual refresh triggered");
      
      // First, get all songs
      const songs = await refreshQueue();
      
      // If no current song is set, try to find one
      if (!currentSong) {
        const nextSong = songs?.songs?.find((s: Song) => !s.is_played);
        if (nextSong) {
          console.log(`Setting current song to: ${nextSong.title}`);
          setCurrentSong(nextSong);
        }
      }
      
      // Refresh participants
      const participantsRes = await fetch(`/api/rooms/join?roomId=${roomId}`);
      if (participantsRes.ok) {
        const data = await participantsRes.json();
        if (data.participants) {
          setCurrentParticipants(data.participants);
        }
      }
      
      setRefreshCounter(prev => prev + 1);
      
      toast({
        title: "Refreshed",
        description: "Queue and participants updated",
      });
    } catch (error) {
      console.error("Manual refresh error:", error);
      toast({
        title: "Refresh Error",
        description: "Failed to update queue or participants",
        variant: "destructive"
      });
    }
  };
  
  // Skip current song
  const skipCurrentSong = async () => {
    if (!currentSong) return;
    
    try {
      console.log(`Skipping song: ${currentSong.title}`);
      await handleVideoEnded();
      
      toast({
        title: "Skipped",
        description: "Current song skipped",
      });
    } catch (error) {
      console.error("Error skipping song:", error);
      toast({
        title: "Error",
        description: "Failed to skip song",
        variant: "destructive"
      });
    }
  };

  // Start playback of the first song
  const startPlayback = async () => {
    if (!currentSong) {
      toast({
        title: "No songs in queue",
        description: "Add songs to the queue first",
        variant: "destructive"
      });
      return;
    }

    try {
      // Set playback state to playing and position to 0
      const playbackResponse = await fetch(`/api/playback/initialize?roomId=${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_playing: true,
          playback_position: 0
        })
      });
      
      if (!playbackResponse.ok) {
        console.warn("Failed to update playback state:", await playbackResponse.text());
        throw new Error("Failed to start playback");
      }
      
      console.log("Started playback for song:", currentSong.title);
      
      // Update playback state locally
      const now = Date.now();
      setPlaybackState({
        is_playing: true,
        playback_position: 0,
        timestamp: now,
        updated_at: now
      });
      
      // Mark that playback has been manually started at least once
      setHasPlaybackStarted(true);
      
      toast({
        title: "Playback Started",
        description: `Now playing: ${currentSong.title}`
      });
    } catch (error) {
      console.error("Error starting playback:", error);
      toast({
        title: "Error",
        description: "Failed to start playback",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <RoomHeader
        room={room}
        isHost={isHost}
        onLeaveRoom={() => router.push('/dashboard')}
      />
      
      {/* Debug controls */}
      {isDebugMode && (
        <div className="bg-slate-100 p-4 rounded-lg border border-slate-300">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Debug Panel</h3>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsDebugMode(false)}
            >
              Hide
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Current Song:</h4>
              <pre className="text-xs bg-slate-200 p-2 rounded overflow-auto max-h-20">
                {currentSong ? JSON.stringify(currentSong, null, 2) : "null"}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Playback State:</h4>
              <pre className="text-xs bg-slate-200 p-2 rounded overflow-auto max-h-20" suppressHydrationWarning>
                {typeof window !== 'undefined' ? JSON.stringify({
                  ...playbackState,
                  hasPlaybackStarted
                }, null, 2) : ''}
              </pre>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" onClick={handleManualRefresh}>
              Refresh Data
            </Button>
            <Button size="sm" variant="outline" onClick={skipCurrentSong}>
              Skip Song
            </Button>
            <Button 
              size="sm" 
              variant={webSocketActive ? "default" : "destructive"}
              onClick={() => {
                if (ws.current) {
                  ws.current.close();
                  setWebSocketActive(false);
                } else {
                  // Reference the setupWebSocketConnection from the useEffect scope
                  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                  const wsUrl = `${protocol}//${window.location.host}/api/ws?roomId=${roomId}`;
                  
                  // Close any existing connection
                  if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
                    ws.current.close();
                  }
                  
                  try {
                    ws.current = new WebSocket(wsUrl);
                    ws.current.onopen = () => {
                      console.log('WebSocket connection established');
                      setWebSocketActive(true);
                      setWebSocketError(null);
                    };
                    ws.current.onclose = () => setWebSocketActive(false);
                    ws.current.onerror = () => setWebSocketActive(false);
                  } catch (error) {
                    console.error('Error setting up WebSocket:', error);
                    setWebSocketActive(false);
                  }
                }
              }}
            >
              {webSocketActive ? "WebSocket Active" : "WebSocket Inactive"}
            </Button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <YoutubePlayer
            currentSong={currentSong || { id: 0, youtube_id: "", title: "" }}
            playbackState={playbackState}
            onVideoEnded={handleVideoEnded}
          />
          
          {/* Start playback button removed for better UX - playback now starts automatically */}
          
          <AddSongForm 
            roomId={roomId} 
            onSongAdded={async () => {
              await refreshQueue();
              // Auto-start playback if this is the first song and playback hasn't started yet
              if (!hasPlaybackStarted && currentSong) {
                startPlayback();
              }
            }} 
          />
          
          <SongQueue
            songs={songs}
            isHost={isHost}
            roomId={roomId}
            onSongUpdated={refreshQueue}
            onSongRemoved={refreshQueue}
            refreshCounter={refreshCounter}
            session={session}
          />
        </div>
        
        <div>
          <ParticipantList 
            participants={currentParticipants} 
            hostId={room.host_id} 
            roomId={roomId}
          />
          
          {!isDebugMode && (
            <Button 
              className="mt-4" 
              size="sm" 
              variant="outline" 
              onClick={() => setIsDebugMode(true)}
            >
              Show Debug Panel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 