"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createSupabaseClient } from "@/lib/supabase/client";

interface CreateRoomFormProps {
  userId: string;
}

export function CreateRoomForm({ userId }: CreateRoomFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const generateRoomCode = () => {
    // Generate a random 6-character alphanumeric code (excluding ambiguous characters)
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const handleCreateRoom = async () => {
    try {
      setIsLoading(true);
      
      const roomCode = generateRoomCode();
      const supabase = createSupabaseClient();
      
      // Create room in database
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .insert({
          id: roomCode,
          host_id: userId,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (roomError) {
        throw new Error(roomError.message);
      }
      
      // Add host as participant
      const { error: participantError } = await supabase
        .from("room_participants")
        .insert({
          room_id: roomCode,
          user_id: userId,
          joined_at: new Date().toISOString(),
        });
      
      if (participantError) {
        throw new Error(participantError.message);
      }
      
      // Initialize playback state
      const { error: playbackError } = await supabase
        .from("playback_state")
        .insert({
          room_id: roomCode,
          current_song_id: null,
          current_time: 0,
          is_playing: false,
        });
      
      if (playbackError) {
        throw new Error(playbackError.message);
      }
      
      toast({
        title: "Room created!",
        description: `Your room code is: ${roomCode}`,
      });
      
      // Redirect to room
      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast({
        title: "Error creating room",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Room Details</h3>
          <p className="text-sm text-muted-foreground">
            Create a new room with a randomly generated code.
            You'll be the host of this room and control playback.
          </p>
        </div>
        
        <Button 
          onClick={handleCreateRoom} 
          disabled={isLoading} 
          className="w-full"
        >
          {isLoading ? "Creating room..." : "Create Room"}
        </Button>
      </div>
    </Card>
  );
} 