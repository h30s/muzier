import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../app/api/auth/[...nextauth]/route';
import { createSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get room ID and song ID from query params
    const searchParams = req.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    const songId = searchParams.get('songId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    // Get request body
    const body = await req.json();
    const { played, playNow } = body;

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

    let result;

    if (playNow) {
      // Handle play now logic - mark all songs before this one as played
      // and this one as unplayed
      
      // 1. First verify this is a valid song in this room
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .eq('room_id', roomId)
        .single();
        
      if (songError || !songData) {
        return NextResponse.json(
          { error: 'Song not found in this room' },
          { status: 404 }
        );
      }
      
      // 2. Mark all songs with ID less than or equal to this song as played
      const { data: markedAsPlayedData, error: markedAsPlayedError } = await supabase
        .from('songs')
        .update({ is_played: true })
        .lt('id', songId)
        .eq('room_id', roomId);
        
      if (markedAsPlayedError) {
        console.error('Error marking previous songs as played:', markedAsPlayedError);
      }
      
      // 3. Mark this specific song as not played so it plays next
      const { data: updateData, error: updateError } = await supabase
        .from('songs')
        .update({ is_played: false })
        .eq('id', songId)
        .eq('room_id', roomId);
        
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update song' },
          { status: 500 }
        );
      }
      
      result = { success: true, message: 'Song will play next' };
    } else {
      // Update a single song's played status
      const { data, error } = await supabase
        .from('songs')
        .update({ is_played: played === true })
        .eq('id', songId)
        .eq('room_id', roomId);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update song' },
          { status: 500 }
        );
      }

      result = { success: true };
    }

    // Get updated songs list
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId)
      .order('id', { ascending: true });

    if (songsError) {
      console.error('Error fetching updated songs:', songsError);
    }

    return NextResponse.json({ 
      ...result,
      songs: songs || [] 
    });
  } catch (error) {
    console.error('Error updating song:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 