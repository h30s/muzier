"use client";

import { useState, useEffect } from "react";
import { Song, Vote } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "next-auth";

interface SongQueueProps {
  songs: Song[];
  isHost: boolean;
  roomId: string;
  session: Session | null;
  onSongUpdated?: () => void;
  onSongRemoved?: () => void;
  refreshCounter?: number;
}

interface SongWithVotes extends Song {
  upvotes?: number;
  downvotes?: number;
  userVote?: 'up' | 'down' | null;
}

export default function SongQueue({
  songs,
  isHost,
  roomId,
  session,
  onSongUpdated,
  onSongRemoved,
  refreshCounter = 0
}: SongQueueProps) {
  const [localSongs, setLocalSongs] = useState<SongWithVotes[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [votes, setVotes] = useState<Record<number, { up: number, down: number }>>({});
  const [userVotes, setUserVotes] = useState<Record<number, 'up' | 'down' | null>>({});
  const { toast } = useToast();

  // Update local songs when songs prop changes
  useEffect(() => {
    setLocalSongs(songs.map(song => ({
      ...song,
      upvotes: votes[song.id]?.up || 0,
      downvotes: votes[song.id]?.down || 0,
      userVote: userVotes[song.id] || null
    })));
  }, [songs, refreshCounter, votes, userVotes]);

  // Fetch votes when component mounts
  useEffect(() => {
    if (songs.length > 0 && session?.user?.id) {
      fetchVotes();
    }
  }, [songs, session]);

  // Function to fetch votes for all songs
  const fetchVotes = async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch(`/api/songs/vote?roomId=${roomId}`);
      if (!response.ok) throw new Error("Failed to fetch votes");
      
      const data = await response.json();
      
      if (data.votes) {
        // Process votes into a more usable format
        const votesByType: Record<number, { up: number, down: number }> = {};
        const userVotesByType: Record<number, 'up' | 'down' | null> = {};
        
        data.votes.forEach((vote: Vote) => {
          if (!votesByType[vote.song_id]) {
            votesByType[vote.song_id] = { up: 0, down: 0 };
          }
          
          votesByType[vote.song_id][vote.vote_type]++;
          
          // Track user's own votes
          if (vote.user_id === session.user.id) {
            userVotesByType[vote.song_id] = vote.vote_type;
          }
        });
        
        setVotes(votesByType);
        setUserVotes(userVotesByType);
      }
    } catch (error) {
      console.error("Error fetching votes:", error);
    }
  };

  // Function to refresh songs directly
  const refreshSongs = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/songs?roomId=${roomId}&includeVotes=true`);
      if (!response.ok) throw new Error("Failed to refresh songs");
      
      const data = await response.json();
      
      if (data.songs && Array.isArray(data.songs)) {
        setLocalSongs(data.songs.map(song => ({
          ...song,
          upvotes: votes[song.id]?.up || 0,
          downvotes: votes[song.id]?.down || 0,
          userVote: userVotes[song.id] || null
        })));
        console.log(`Refreshed song queue. Found ${data.songs.length} songs.`);
        
        // Fetch votes
        fetchVotes();
        
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

  // Function to handle voting
  const handleVote = async (songId: number, voteType: 'up' | 'down') => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to vote",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const currentVote = userVotes[songId];
      let method = 'POST';
      let action = 'add';
      
      // If user already voted this way, remove the vote
      if (currentVote === voteType) {
        method = 'DELETE';
        action = 'remove';
      } 
      // If user already voted the other way, update the vote
      else if (currentVote) {
        method = 'PUT';
        action = 'update';
      }
      
      const response = await fetch('/api/songs/vote', {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          songId,
          userId: session.user.id,
          voteType
        })
      });
      
      if (!response.ok) throw new Error("Failed to vote");
      
      // Update local state for immediate feedback
      setUserVotes(prev => ({
        ...prev,
        [songId]: action === 'remove' ? null : voteType
      }));
      
      // Update vote counts
      setVotes(prev => {
        const newVotes = { ...prev };
        if (!newVotes[songId]) {
          newVotes[songId] = { up: 0, down: 0 };
        }
        
        // Handle different actions
        if (action === 'add') {
          newVotes[songId][voteType]++;
        } else if (action === 'remove') {
          newVotes[songId][voteType]--;
        } else if (action === 'update') {
          // Decrement the old vote type
          newVotes[songId][currentVote]--;
          // Increment the new vote type
          newVotes[songId][voteType]++;
        }
        
        return newVotes;
      });
      
      toast({
        title: "Vote Recorded",
        description: `Your ${voteType} vote has been recorded`
      });
    } catch (error) {
      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: "Failed to record your vote",
        variant: "destructive"
      });
      // Refresh votes to get the correct state
      fetchVotes();
    }
  };

  // Sort unplayed songs by votes (highest upvotes - downvotes first)
  const sortSongsByVotes = (songs: SongWithVotes[]) => {
    return [...songs].sort((a, b) => {
      const aScore = (a.upvotes || 0) - (a.downvotes || 0);
      const bScore = (b.upvotes || 0) - (b.downvotes || 0);
      return bScore - aScore;
    });
  };

  // Group songs by played status
  const unplayedSongs = sortSongsByVotes(localSongs.filter(song => !song.is_played));
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
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="truncate">Added by: {song.added_by_name || 'Unknown'}</span>
                        <div className="ml-2 flex items-center space-x-1">
                          <span className="flex items-center">
                            <ThumbsUp className={`h-3 w-3 mr-1 ${song.userVote === 'up' ? 'text-green-500' : ''}`} />
                            {song.upvotes || 0}
                          </span>
                          <span className="flex items-center">
                            <ThumbsDown className={`h-3 w-3 mr-1 ${song.userVote === 'down' ? 'text-red-500' : ''}`} />
                            {song.downvotes || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {session?.user && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleVote(song.id, 'up')}
                          title="Upvote"
                          className={song.userVote === 'up' ? 'text-green-500' : ''}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleVote(song.id, 'down')}
                          title="Downvote"
                          className={song.userVote === 'down' ? 'text-red-500' : ''}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </>
                    )}
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
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="truncate">Added by: {song.added_by_name || 'Unknown'}</span>
                        <div className="ml-2 flex items-center space-x-1">
                          <span className="flex items-center">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {song.upvotes || 0}
                          </span>
                          <span className="flex items-center">
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            {song.downvotes || 0}
                          </span>
                        </div>
                      </div>
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