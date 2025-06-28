import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/server";
import { RoomClient } from "@/components/room/room-client";
import { Room } from "@/lib/types";

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params;
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const supabase = createSupabaseClient();
  
  // Check if room exists and is active
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select()
    .eq("id", roomId)
    .eq("is_active", true)
    .single();
  
  if (roomError || !room) {
    notFound();
  }
  
  // Check if user is a participant
  const { data: participant, error: participantError } = await supabase
    .from("room_participants")
    .select()
    .eq("room_id", roomId)
    .eq("user_id", session.user.id)
    .single();
  
  // If not a participant, add them
  if (!participant) {
    await supabase
      .from("room_participants")
      .insert({
        room_id: roomId,
        user_id: session.user.id,
        joined_at: new Date().toISOString(),
      });
  }
  
  // Get all participants with user details
  const { data: participants } = await supabase
    .from("room_participants")
    .select(`
      user_id,
      joined_at,
      users:user_id (
        name,
        image
      )
    `)
    .eq("room_id", roomId);
  
  // Determine if current user is the host
  const isHost = room.host_id === session.user.id;
  
  return (
    <RoomClient 
      room={room as Room} 
      currentUser={session.user}
      participants={participants || []}
      isHost={isHost}
    />
  );
} 