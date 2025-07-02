import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import { createSupabaseClient } from '@/lib/supabase/server';

// GET: Fetch songs for a room
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
    const unplayedOnly = searchParams.get('unplayedOnly') === 'true';

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Check if the user is in the room
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'You are not a participant in this room' },
        { status: 403 }
      );
    }

    // Query to get songs
    let query = supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId);

    // Filter by played status if requested
    if (unplayedOnly) {
      query = query.eq('is_played', false);
    }

    // Execute the query
    const { data: songs, error: songsError } = await query.order('id', { ascending: true });

    if (songsError) {
      console.error('Error fetching songs:', songsError);
      return NextResponse.json(
        { error: 'Failed to fetch songs' },
        { status: 500 }
      );
    }

    // Get user information for all songs
    const userIds = Array.from(new Set(
      songs
        .map(song => song.added_by)
        .filter(Boolean)
    ));

    let userMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);

      if (!usersError && users) {
        userMap = users.reduce((acc, user) => ({
          ...acc,
          [user.id]: user
        }), {});
      }
    }

    // Add user info to songs
    const songsWithUserInfo = songs.map(song => ({
      ...song,
      added_by_name: song.added_by && userMap[song.added_by] 
        ? userMap[song.added_by].name 
        : 'Unknown user'
    }));

    return NextResponse.json({
      songs: songsWithUserInfo
    });
  } catch (error) {
    console.error('Error fetching songs:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ... existing POST and DELETE code ... 