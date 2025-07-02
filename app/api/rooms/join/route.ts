import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";

// This is needed for WebSocket support in Next.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Handle WebSocket connection
export async function GET(request: NextRequest) {
  try {
    // Get roomId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }
    
    // Get the session
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Check if the upgrade header exists (for WebSocket connection)
    const upgradeHeader = request.headers.get('upgrade');
    if (upgradeHeader !== 'websocket') {
      return NextResponse.json({ error: "Expected WebSocket connection" }, { status: 426 });
    }
    
    // In a real implementation, we'd upgrade the connection to WebSocket
    // For now, we'll just return a response that we can't handle WebSockets in this API route
    return NextResponse.json({ 
      error: "WebSocket connections are not supported in this API route. Please implement a WebSocket server." 
    }, { status: 501 });
  } catch (error) {
    console.error("Error handling WebSocket connection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Handle regular HTTP POST request to join a room
export async function POST(request: NextRequest) {
  try {
    // Get the room ID from the request body
    const body = await request.json();
    const { roomId } = body;
    
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }
    
    // Get the session
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create Supabase client
    const supabase = createSupabaseClient();
    
    // Check if the room exists
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    // Check if the user is already in the room
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();
    
    if (participant) {
      // User is already in the room
      return NextResponse.json({ roomId, message: 'Already joined room' });
    }
    
    // Add the user to the room
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: session.user.id,
        user_name: session.user.name || session.user.email?.split('@')[0] || 'Anonymous',
        is_admin: false
      });
    
    if (joinError) {
      console.error('Error joining room:', joinError);
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }
    
    // Update the room's updated_at timestamp
    await supabase
      .from('rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId);
    
    return NextResponse.json({ roomId, message: 'Successfully joined room' });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 