"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { extractYoutubeVideoId, fetchVideoDetails } from "@/lib/youtube/api";
import { Song } from "@/lib/types";

interface AddSongFormProps {
  roomId: string;
  onSongAdded?: () => void;
  directSetSongs?: (songs: Song[]) => void;
}

export default function AddSongForm({ roomId, onSongAdded, directSetSongs }: AddSongFormProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Extract video ID from URL
      const videoId = extractYoutubeVideoId(videoUrl);
      
      if (!videoId) {
        toast({
          title: "Error",
          description: "Invalid YouTube URL",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Fetch video details from YouTube API
      const videoDetails = await fetchVideoDetails(videoId);
      
      if (!videoDetails) {
        toast({
          title: "Error",
          description: "Failed to fetch video details",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Add song to database
      const response = await fetch("/api/songs/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roomId,
          youtubeId: videoId,
          title: videoDetails.title,
          thumbnailUrl: videoDetails.thumbnailUrl,
          duration: videoDetails.duration
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error adding song:", errorData);
        throw new Error(errorData.error || "Failed to add song");
      }
      
      const responseData = await response.json();
      console.log("Song added successfully:", responseData);
      
      // Clear form
      setVideoUrl("");
      
      // Show success message
      toast({
        title: "Success",
        description: "Song added to queue",
      });

      // Force an immediate refresh of the queue by fetching songs directly
      try {
        console.log("Fetching updated song list after adding song");
        const songsResponse = await fetch(`/api/songs?roomId=${roomId}`);
        if (songsResponse.ok) {
          const songData = await songsResponse.json();
          console.log("Fetched updated songs:", songData);
          
          // Directly update the songs state if the function is provided
          if (directSetSongs && songData.songs && Array.isArray(songData.songs)) {
            console.log("Directly updating songs state with new data");
            directSetSongs(songData.songs);
          }
          
          // Notify parent component that a song was added
          if (onSongAdded) {
            console.log("Calling onSongAdded callback to refresh queue");
            onSongAdded();
          }
        }
      } catch (error) {
        console.error("Error fetching updated songs:", error);
      }
    } catch (error) {
      console.error("Error adding song:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add song",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleAddSong} className="flex gap-2">
      <Input
        placeholder="Paste YouTube URL"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        disabled={isLoading}
        className="flex-1"
      />
      <Button type="submit" disabled={isLoading || !videoUrl.trim()}>
        {isLoading ? "Adding..." : "Add"}
      </Button>
    </form>
  );
} 