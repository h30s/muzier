import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    const youtubeId = url.searchParams.get("youtubeId");
    const isPlayed = url.searchParams.get("isPlayed");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    let query = supabase.from("songs").select("*").eq("room_id", roomId);

    if (youtubeId) {
      query = query.eq("youtube_id", youtubeId);
    }

    if (isPlayed !== null) {
      query = query.eq("is_played", isPlayed === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching songs:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ songs: data });
  } catch (error: any) {
    console.error("Error fetching songs:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 