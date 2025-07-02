import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import { createSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get room ID from query params
    const searchParams = req.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }
    
    // Get request body
    const body = await req.json();
    const { is_playing, playback_position } = body;
    
    if (typeof is_playing !== 'boolean' && typeof playback_position !== 'number') {
      return NextResponse.json({ error: 'Invalid request body. Must include is_playing or playback_position.' }, { status: 400 });
    }
    
    // Create Supabase client
    const supabase = createSupabaseClient();
    
    // Verify the user is in the room
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .single();
    
    if (roomError || !roomData) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    const { data: roomParticipant, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();
    
    if (participantError || !roomParticipant) {
      return NextResponse.json({ error: 'You are not a participant in this room' }, { status: 403 });
    }
    
    // Only the host can update playback state
    const isHost = roomData.host_id === session.user.id;
    
    // Allow playback control for everyone in development
    const allowAllControls = true; // Set to false in production if needed
    
    if (!isHost && !allowAllControls) {
      return NextResponse.json({ error: 'Only the host can control playback' }, { status: 403 });
    }
    
    // Update the room's playback state
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (typeof is_playing === 'boolean') {
      updateData.is_playing = is_playing;
    }
    
    if (typeof playback_position === 'number') {
      updateData.playback_position = playback_position;
    }
    
    const { data, error: updateError } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select();
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update playback state' }, { status: 500 });
    }
    
    // Get the current song (first unplayed song)
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_played', false)
      .order('id', { ascending: true })
      .limit(1);
    
    if (songsError) {
      console.error('Error fetching current song:', songsError);
    }
    
    const currentSong = songs && songs.length > 0 ? songs[0] : null;
    
    return NextResponse.json({
      success: true,
      playback_state: {
        is_playing: updateData.is_playing !== undefined ? updateData.is_playing : data[0].is_playing,
        playback_position: updateData.playback_position !== undefined ? updateData.playback_position : data[0].playback_position,
        updated_at: data[0].updated_at,
        timestamp: Date.now(),
      },
      current_song: currentSong,
    });
  } catch (error) {
    console.error('Error updating playback state:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get room ID from query params
    const searchParams = req.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }
    
    // Create Supabase client
    const supabase = createSupabaseClient();
    
    // Verify the user is in the room
    const { data: roomParticipant, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();
    
    if (participantError || !roomParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this room' },
        { status: 403 }
      );
    }
    
    // Get the room's playback state
    const { data: playbackState, error: playbackError } = await supabase
      .from('rooms')
      .select('is_playing, playback_position, updated_at')
      .eq('id', roomId)
      .single();
    
    if (playbackError) {
      return NextResponse.json(
        { error: 'Failed to get playback state' },
        { status: 500 }
      );
    }
    
    // Get the current song (first unplayed song)
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_played', false)
      .order('id', { ascending: true })
      .limit(1);
    
    if (songsError) {
      console.error('Error fetching current song:', songsError);
    }
    
    const currentSong = songs && songs.length > 0 ? songs[0] : null;
    
    return NextResponse.json({
      playback_state: {
        is_playing: playbackState.is_playing || false,
        playback_position: playbackState.playback_position || 0,
        updated_at: playbackState.updated_at,
        timestamp: Date.now(),
      },
      current_song: currentSong,
    });
  } catch (error) {
    console.error('Error getting playback state:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 