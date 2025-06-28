import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { extractYouTubeVideoId, fetchVideoDetails } from "@/lib/youtube/api";

export async function POST(request: Request) {
  try {
    const { url, roomId, userId } = await request.json();

    if (!url || !roomId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Check if song already exists in the queue
    const { data: existingSong } = await supabase
      .from("songs")
      .select()
      .eq("youtube_id", videoId)
      .eq("room_id", roomId)
      .eq("is_played", false)
      .single();

    if (existingSong) {
      return NextResponse.json(
        { error: "Song already in queue" },
        { status: 400 }
      );
    }

    // Fetch video details from YouTube API
    const videoDetails = await fetchVideoDetails(videoId);

    // Add song to queue
    const { data: song, error } = await supabase
      .from("songs")
      .insert({
        youtube_id: videoId,
        room_id: roomId,
        is_played: false,
        added_by: userId,
        title: videoDetails.title,
        thumbnail: videoDetails.thumbnail,
        duration: videoDetails.duration,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding song:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Add initial upvote from the user who added the song
    await supabase
      .from("votes")
      .insert({
        song_id: song.id,
        user_id: userId,
        vote_type: "up",
      });

    return NextResponse.json({ song });
  } catch (error: any) {
    console.error("Error adding song:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 