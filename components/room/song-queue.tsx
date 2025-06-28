"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/lib/supabase/client";
import { User, Song } from "@/lib/types";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";

interface SongQueueProps {
  songs: Song[];
  currentUser: User;
  roomId: string;
}

export function SongQueue({ songs, currentUser, roomId }: SongQueueProps) {
  const [votingInProgress, setVotingInProgress] = useState<Record<number, boolean>>({});
  
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const handleVote = async (songId: number, voteType: 'up' | 'down') => {
    try {
      setVotingInProgress((prev) => ({ ...prev, [songId]: true }));
      
      const supabase = createSupabaseClient();
      const song = songs.find((s) => s.id === songId);
      
      if (!song) return;
      
      // If user already voted this way, remove their vote
      if (song.user_vote === voteType) {
        await supabase
          .from("votes")
          .delete()
          .match({
            song_id: songId,
            user_id: currentUser.id,
          });
        return;
      }
      
      // If user voted the opposite way, update their vote
      if (song.user_vote) {
        await supabase
          .from("votes")
          .update({ vote_type: voteType })
          .match({
            song_id: songId,
            user_id: currentUser.id,
          });
        return;
      }
      
      // If user hasn't voted yet, insert a new vote
      await supabase
        .from("votes")
        .insert({
          song_id: songId,
          user_id: currentUser.id,
          vote_type: voteType,
        });
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setVotingInProgress((prev) => ({ ...prev, [songId]: false }));
    }
  };
  
  return (
    <div className="space-y-4">
      {songs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No songs in the queue. Add a song to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        songs.map((song) => (
          <Card key={song.id} className="overflow-hidden">
            <div className="flex">
              {/* Voting controls */}
              <div className="flex flex-col items-center justify-center bg-muted p-4 w-16">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    song.user_vote === 'up' ? 'text-primary bg-primary/10' : ''
                  }`}
                  disabled={votingInProgress[song.id]}
                  onClick={() => handleVote(song.id, 'up')}
                >
                  <ChevronUp className="h-5 w-5" />
                </Button>
                <span className="font-bold my-1">{song.votes_count || 0}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    song.user_vote === 'down' ? 'text-destructive bg-destructive/10' : ''
                  }`}
                  disabled={votingInProgress[song.id]}
                  onClick={() => handleVote(song.id, 'down')}
                >
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Song details */}
              <CardContent className="flex-1 p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={song.thumbnail || `https://i.ytimg.com/vi/${song.youtube_id}/hqdefault.jpg`}
                      alt={song.title || 'Song thumbnail'}
                      className="w-24 h-16 object-cover rounded-md"
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base truncate">
                      {song.title || 'Unknown Title'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{song.duration ? formatDuration(song.duration) : '--:--'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))
      )}
    </div>
  );
} 