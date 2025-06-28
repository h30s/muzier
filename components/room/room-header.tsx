"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface RoomHeaderProps {
  roomId: string;
  isHost: boolean;
}

export function RoomHeader({ roomId, isHost }: RoomHeaderProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: "Room code copied",
      description: "Share this code with friends to invite them",
    });
  };
  
  const handleLeaveRoom = async () => {
    try {
      setIsLeaving(true);
      const supabase = createSupabaseClient();
      
      // Remove user from participants
      await supabase
        .from("room_participants")
        .delete()
        .match({
          room_id: roomId,
        });
      
      router.push("/dashboard");
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Error leaving room",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLeaving(false);
    }
  };
  
  const handleCloseRoom = async () => {
    try {
      setIsClosing(true);
      const supabase = createSupabaseClient();
      
      // Set room to inactive
      await supabase
        .from("rooms")
        .update({ is_active: false })
        .eq("id", roomId);
      
      router.push("/dashboard");
    } catch (error) {
      console.error("Error closing room:", error);
      toast({
        title: "Error closing room",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };
  
  return (
    <div className="bg-muted py-4 px-6 border-b">
      <div className="container flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Room: {roomId}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {isHost ? "You are the host" : "You are a participant"}
            </span>
            <Button variant="outline" size="sm" onClick={handleCopyRoomCode}>
              Copy Room Code
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isHost ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">Close Room</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Close Room</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to close this room? This will end the session for all participants.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleCloseRoom} 
                    disabled={isClosing}
                  >
                    {isClosing ? "Closing..." : "Close Room"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleLeaveRoom} 
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave Room"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 