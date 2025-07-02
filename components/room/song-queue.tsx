"use client";

import { useState, useEffect } from "react";
import { Song } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SongQueueProps {
  songs: Song[];
  isHost: boolean;
  roomId: string;
  onSongUpdated?: () => void;
  onSongRemoved?: () => void;
  refreshCounter?: number;
}

export default function SongQueue({
  songs,
  isHost,
  roomId,
  onSongUpdated,
  onSongRemoved,
  refreshCounter = 0
}: SongQueueProps) {
  const [localSongs, setLocalSongs] = useState<Song[]>(songs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Update local songs when songs prop changes
  useEffect(() => {
    setLocalSongs(songs);
  }, [songs, refreshCounter]);

  // Function to refresh songs directly
  const refreshSongs = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/songs?roomId=${roomId}`);
      if (!response.ok) throw new Error("Failed to refresh songs");
      
      const data = await response.json();
      
      if (data.songs && Array.isArray(data.songs)) {
        setLocalSongs(data.songs);
        console.log(`Refreshed song queue. Found ${data.songs.length} songs.`);
        
        // Call the parent's callback if provided
        if (onSongUpdated) onSongUpdated();
      }
    } catch (error) {
      console.error("Error refreshing songs:", error);
      toast({
        title: "Error",
        description: "Failed to refresh song queue",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to remove a song
  const removeSong = async (songId: number) => {
    try {
      const response = await fetch(`/api/songs?roomId=${roomId}&songId=${songId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error("Failed to remove song");
      
      // Update local state first for immediate feedback
      setLocalSongs(prev => prev.filter(song => song.id !== songId));
      
      // Notify parent
      if (onSongRemoved) onSongRemoved();
      
      toast({
        title: "Song Removed",
        description: "The song has been removed from the queue"
      });
    } catch (error) {
      console.error("Error removing song:", error);
      toast({
        title: "Error",
        description: "Failed to remove song",
        variant: "destructive"
      });
    }
  };

  // Function to play a specific song (mark all previous as played)
  const playSong = async (songId: number) => {
    try {
      // Update the local state first
      setLocalSongs(prev => 
        prev.map(song => ({
          ...song,
          is_played: song.id === songId ? false : (song.id < songId)
        }))
      );
      
      // Call the API to update all songs
      const response = await fetch(`/api/songs/update?roomId=${roomId}&songId=${songId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          playNow: true
        })
      });
      
      if (!response.ok) throw new Error("Failed to update song playback");
      
      // Notify parent
      if (onSongUpdated) onSongUpdated();
      
      toast({
        title: "Song Updated",
        description: "The song will play next"
      });
    } catch (error) {
      console.error("Error playing song:", error);
      toast({
        title: "Error",
        description: "Failed to update song playback",
        variant: "destructive"
      });
      // Refresh to get the correct state
      refreshSongs();
    }
  };

  // Group songs by played status
  const unplayedSongs = localSongs.filter(song => !song.is_played);
  const playedSongs = localSongs.filter(song => song.is_played);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Song Queue</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshSongs}
            disabled={isRefreshing}
          >
            <RefreshCw 
              className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Debug info */}
        <div className="mb-4 text-xs text-gray-500">
          Total songs: {localSongs.length} | 
          Unplayed: {unplayedSongs.length} | 
          Played: {playedSongs.length}
        </div>
        
        {/* Queue is empty */}
        {localSongs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No songs in queue</p>
            <p className="text-sm mt-2">Add a song to get started</p>
          </div>
        )}
        
        {/* Up Next */}
        {unplayedSongs.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Up Next</h3>
            <div className="space-y-2">
              {unplayedSongs.map((song) => (
                <div 
                  key={song.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    {song.thumbnail && (
                      <img 
                        src={song.thumbnail} 
                        alt={song.title} 
                        className="w-12 h-8 object-cover rounded"
                      />
                    )}
                    <div className="overflow-hidden">
                      <p className="font-medium truncate" title={song.title}>
                        {song.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Added by: {song.added_by || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {isHost && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => playSong(song.id)}
                          title="Play now"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeSong(song.id)}
                          title="Remove song"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Already Played */}
        {playedSongs.length > 0 && (
          <div>
            <h3 className="font-medium mb-2 text-gray-500">Already Played</h3>
            <div className="space-y-2">
              {playedSongs.map((song) => (
                <div 
                  key={song.id} 
                  className="flex items-center justify-between p-3 bg-gray-100 rounded-md opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {song.thumbnail && (
                      <img 
                        src={song.thumbnail} 
                        alt={song.title} 
                        className="w-12 h-8 object-cover rounded grayscale"
                      />
                    )}
                    <div className="overflow-hidden">
                      <p className="font-medium truncate" title={song.title}>
                        {song.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Added by: {song.added_by || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {isHost && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => playSong(song.id)}
                          title="Play again"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeSong(song.id)}
                          title="Remove song"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 