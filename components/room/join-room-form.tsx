"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createSupabaseClient } from "@/lib/supabase/client";

interface JoinRoomFormProps {
  userId: string;
}

export function JoinRoomForm({ userId }: JoinRoomFormProps) {
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomCode.trim()) {
      toast({
        title: "Room code required",
        description: "Please enter a valid room code",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const formattedCode = roomCode.trim().toUpperCase();
      const supabase = createSupabaseClient();
      
      // Check if room exists and is active
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select()
        .eq("id", formattedCode)
        .eq("is_active", true)
        .single();
      
      if (roomError || !roomData) {
        toast({
          title: "Room not found",
          description: "Please check the room code and try again",
          variant: "destructive",
        });
        return;
      }
      
      // Check if user is already in the room
      const { data: existingParticipant, error: participantCheckError } = await supabase
        .from("room_participants")
        .select()
        .eq("room_id", formattedCode)
        .eq("user_id", userId)
        .single();
      
      if (!existingParticipant) {
        // Add user as participant
        const { error: participantError } = await supabase
          .from("room_participants")
          .insert({
            room_id: formattedCode,
            user_id: userId,
            joined_at: new Date().toISOString(),
          });
        
        if (participantError) {
          throw new Error(participantError.message);
        }
      }
      
      // Redirect to room
      router.push(`/room/${formattedCode}`);
    } catch (error) {
      console.error("Error joining room:", error);
      toast({
        title: "Error joining room",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleJoinRoom} className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Enter Room Code</h3>
          <p className="text-sm text-muted-foreground">
            Enter the 6-character code provided by the room host.
          </p>
        </div>
        
        <div className="space-y-4">
          <Input
            placeholder="Enter room code (e.g. ABC123)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="text-center uppercase"
            maxLength={6}
          />
          
          <Button 
            type="submit" 
            disabled={isLoading || !roomCode.trim()} 
            className="w-full"
          >
            {isLoading ? "Joining..." : "Join Room"}
          </Button>
        </div>
      </form>
    </Card>
  );
}