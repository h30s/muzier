import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { songId, isPlayed } = await request.json();

    if (!songId) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    const updateData: any = {};
    if (isPlayed !== undefined) updateData.is_played = isPlayed;
    
    const { error } = await supabase
      .from("songs")
      .update(updateData)
      .eq("id", songId);

    if (error) {
      console.error("Error updating song:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating song:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 