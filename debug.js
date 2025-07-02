// Debug script to test API endpoints

async function testSongsApi() {
  const roomId = 'KX2MFT'; // Replace with your room ID
  
  console.log('Fetching songs...');
  const response = await fetch(`http://localhost:3000/api/songs?roomId=${roomId}`);
  
  if (!response.ok) {
    console.error('Failed to fetch songs:', response.status, response.statusText);
    return;
  }
  
  const data = await response.json();
  console.log('Songs API response:', JSON.stringify(data, null, 2));
  
  if (data.songs && data.songs.length > 0) {
    console.log(`Found ${data.songs.length} songs`);
    data.songs.forEach((song, index) => {
      console.log(`Song ${index+1}: ${song.title} (ID: ${song.id})`);
    });
  } else {
    console.log('No songs found');
  }
}

async function testAddSong() {
  const roomId = 'KX2MFT'; // Replace with your room ID
  const youtubeId = 'dQw4w9WgXcQ'; // Test video ID
  
  console.log('Adding a test song...');
  const response = await fetch('http://localhost:3000/api/songs/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId,
      youtubeId,
      title: 'Test Song',
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
      duration: 210
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Failed to add song:', errorData);
    return;
  }
  
  const data = await response.json();
  console.log('Add song response:', JSON.stringify(data, null, 2));
}

async function testPlaybackApi() {
  const roomId = 'KX2MFT'; // Replace with your room ID
  
  console.log('Fetching playback state...');
  const response = await fetch(`http://localhost:3000/api/playback?roomId=${roomId}`);
  
  if (!response.ok) {
    console.error('Failed to fetch playback state:', response.status, response.statusText);
    return;
  }
  
  const data = await response.json();
  console.log('Playback API response:', JSON.stringify(data, null, 2));
}

async function main() {
  console.log('Starting API tests...');
  
  await testSongsApi();
  // Uncomment to test adding a song
  await testAddSong();
  await testPlaybackApi();
  
  console.log('Tests completed');
}

main().catch(error => {
  console.error('Test error:', error);
}); 