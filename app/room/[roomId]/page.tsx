import { redirect } from 'next/navigation';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseClient } from '@/lib/supabase/server';
import RoomClient from '@/components/room/room-client';
import { Room } from "@/lib/types";

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params;
  
  // Get the session
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  // Check if the room exists
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  
  if (error || !room) {
    redirect('/dashboard');
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
  
  return (
    <RoomClient 
      roomId={roomId}
      room={room as Room}
      participants={participants || []}
      session={session}
    />
  );
} 