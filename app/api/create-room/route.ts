import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Generate a random room code
function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Create admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Generate room code
    const roomCode = generateRoomCode();
    
    // Create room directly
    const { error: roomError } = await supabase
      .from("rooms")
      .insert({
        id: roomCode,
        host_id: userId,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    
    if (roomError) {
      console.error("Error creating room:", roomError);
      return NextResponse.json({ error: roomError.message }, { status: 500 });
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
      console.error("Error adding participant:", participantError);
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }
    
    // Initialize playback state
    const { error: playbackError } = await supabase
      .from("playback_state")
      .insert({
        room_id: roomCode,
        current_song_id: null,
        playback_position: 0,
        is_playing: false,
      });
    
    if (playbackError) {
      console.error("Error initializing playback:", playbackError);
      return NextResponse.json({ error: playbackError.message }, { status: 500 });
    }
    
    console.log("API called with userId:", userId);
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("Supabase key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    return NextResponse.json({ roomCode });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
