import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { auth } from '../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    // Get the room ID from the query parameter
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    
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
    
    // Check if the user is a participant in the room
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();
    
    if (participantError || !participant) {
      // User is not in the room, add them
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
    }
    
    // Get the current song (first unplayed song in queue)
    const { data: currentSong, error: songError } = await supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_played', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    // Get the playback state
    const { data: playbackState, error: playbackError } = await supabase
      .from('playback_state')
      .select('*')
      .eq('room_id', roomId)
      .single();
    
    if (songError && songError.code !== 'PGRST116') {
      console.error('Error getting current song:', songError);
    }
    
    if (playbackError && playbackError.code !== 'PGRST116') {
      console.error('Error getting playback state:', playbackError);
    }
    
    // Get all participants in the room
    const { data: participants, error: allParticipantsError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);
    
    if (allParticipantsError) {
      console.error('Error getting participants:', allParticipantsError);
    }
    
    // If no current playback state, create an initial one
    if (playbackError && playbackError.code === 'PGRST116' && currentSong) {
      const { error: createPlaybackError } = await supabase
        .from('playback_state')
        .insert({
          room_id: roomId,
          current_song_id: currentSong.id,
          is_playing: false,
          playback_position: 0
        });
      
      if (createPlaybackError) {
        console.error('Error creating initial playback state:', createPlaybackError);
      }
    }
    
    // Return the current song and playback state
    return NextResponse.json({
      current_song: currentSong || null,
      playback_state: playbackState || {
        room_id: roomId,
        current_song_id: currentSong?.id || null,
        is_playing: false,
        playback_position: 0
      },
      participants: participants || []
    });
  } catch (error) {
    console.error('Error initializing playback:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 