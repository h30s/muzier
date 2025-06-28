"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
      
      const response = await fetch("/api/songs/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          roomId,
          userId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to add song");
      }
      
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
        description: error instanceof Error ? error.message : "Please try again later",
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