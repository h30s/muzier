import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

// Add a new vote
export async function POST(request: Request) {
  try {
    const { songId, userId, voteType } = await request.json();

    if (!songId || !userId || !voteType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from("votes")
      .insert({
        song_id: songId,
        user_id: userId,
        vote_type: voteType,
      });

    if (error) {
      console.error("Error adding vote:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error adding vote:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Update an existing vote
export async function PUT(request: Request) {
  try {
    const { songId, userId, voteType } = await request.json();

    if (!songId || !userId || !voteType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from("votes")
      .update({ vote_type: voteType })
      .match({
        song_id: songId,
        user_id: userId,
      });

    if (error) {
      console.error("Error updating vote:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating vote:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Delete a vote
export async function DELETE(request: Request) {
  try {
    const { songId, userId } = await request.json();

    if (!songId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from("votes")
      .delete()
      .match({
        song_id: songId,
        user_id: userId,
      });

    if (error) {
      console.error("Error deleting vote:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting vote:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 