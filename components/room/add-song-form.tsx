"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import { extractYouTubeVideoId, fetchVideoDetails } from "@/lib/youtube/api";

interface AddSongFormProps {
  roomId: string;
  userId: string;
}

export function AddSongForm({ roomId, userId }: AddSongFormProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Extract video ID from URL
      const videoId = extractYouTubeVideoId(url);
      
      if (!videoId) {
        toast({
          title: "Invalid YouTube URL",
          description: "Please enter a valid YouTube video URL",
          variant: "destructive",
        });
        return;
      }
      
      const supabase = createSupabaseClient();
      
      // Check if song already exists in the queue
      const { data: existingSong } = await supabase
        .from("songs")
        .select()
        .eq("youtube_id", videoId)
        .eq("room_id", roomId)
        .eq("is_played", false)
        .single();
      
      if (existingSong) {
        toast({
          title: "Song already in queue",
          description: "This song is already in the queue",
          variant: "destructive",
        });
        return;
      }
      
      // Fetch video details from YouTube API
      const videoDetails = await fetchVideoDetails(videoId);
      
      // Add song to queue
      const { data: song, error } = await supabase
        .from("songs")
        .insert({
          youtube_id: videoId,
          room_id: roomId,
          is_played: false,
          added_by: userId,
          title: videoDetails.title,
          thumbnail: videoDetails.thumbnail,
          duration: videoDetails.duration,
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Add initial upvote from the user who added the song
      await supabase
        .from("votes")
        .insert({
          song_id: song.id,
          user_id: userId,
          vote_type: "up",
        });
      
      toast({
        title: "Song added",
        description: "Your song has been added to the queue",
      });
      
      // Clear input
      setUrl("");
    } catch (error) {
      console.error("Error adding song:", error);
      toast({
        title: "Error adding song",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Paste YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isLoading}
        className="flex-1"
      />
      <Button type="submit" disabled={isLoading || !url.trim()}>
        {isLoading ? "Adding..." : "Add"}
      </Button>
    </form>
  );
} 