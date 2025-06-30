import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { roomId } = await request.json();
    const userId = session.user.id;
    
    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }
    
    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user exists in the users table
    const { data: existingUser, error: userCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();
    
    // If user doesn't exist, create them
    if (!existingUser) {
      const { error: userCreateError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          updated_at: new Date().toISOString(),
        });
      
      if (userCreateError) {
        console.error("Error creating user:", userCreateError);
        return NextResponse.json({ error: userCreateError.message }, { status: 500 });
      }
    }
    
    // Check if room exists and is active
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select()
      .eq("id", roomId)
      .eq("is_active", true)
      .single();
    
    if (roomError || !roomData) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    // Check if user is already in the room
    const { data: existingParticipant, error: participantCheckError } = await supabase
      .from("room_participants")
      .select()
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();
    
    if (!existingParticipant) {
      // Add user as participant
      const { error: participantError } = await supabase
        .from("room_participants")
        .insert({
          room_id: roomId,
          user_id: userId,
          joined_at: new Date().toISOString(),
        });
      
      if (participantError) {
        console.error("Error adding participant:", participantError);
        return NextResponse.json({ error: participantError.message }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error joining room:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 