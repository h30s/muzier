import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { roomId, currentSongId, currentTime, isPlaying } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    // Check if playback state exists for this room
    const { data: existingState } = await supabase
      .from("playback_state")
      .select()
      .eq("room_id", roomId)
      .single();
    
    if (!existingState) {
      // Create new playback state
      const { error } = await supabase
        .from("playback_state")
        .insert({
          room_id: roomId,
          current_song_id: currentSongId,
          playback_position: currentTime,
          is_playing: isPlaying,
        });
        
      if (error) {
        console.error("Error creating playback state:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    } else {
      // Update existing playback state
      const updateData: any = {};
      
      if (currentSongId !== undefined) updateData.current_song_id = currentSongId;
      if (currentTime !== undefined) updateData.playback_position = currentTime;
      if (isPlaying !== undefined) updateData.is_playing = isPlaying;
      
      const { error } = await supabase
        .from("playback_state")
        .update(updateData)
        .eq("room_id", roomId);
        
      if (error) {
        console.error("Error updating playback state:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating playback state:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 