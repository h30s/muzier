import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { roomId, songId } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    // Check if playback state exists for this room
    const { data: existingState, error: checkError } = await supabase
      .from("playback_state")
      .select()
      .eq("room_id", roomId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking playback state:", checkError);
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }
    
    // If playback state doesn't exist, create it
    if (!existingState) {
      const { error } = await supabase
        .from("playback_state")
        .insert({
          room_id: roomId,
          current_song_id: songId || null,
          playback_position: 0,
          is_playing: false,
        });
        
      if (error) {
        console.error("Error creating playback state:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Playback state initialized" 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Playback state already exists",
      playbackState: existingState
    });
  } catch (error: any) {
    console.error("Error initializing playback state:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 