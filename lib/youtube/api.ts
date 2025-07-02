/**
 * YouTube API utility functions
 */

// Extract YouTube video ID from various URL formats
export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // Pattern for various YouTube URL formats
  const patterns = [
    // Standard watch URL (https://www.youtube.com/watch?v=VIDEO_ID)
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\?\/]+)/,
    // Shortened URL (https://youtu.be/VIDEO_ID)
    /youtu\.be\/([^&\?\/]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Fetch video details from YouTube API
export async function fetchVideoDetails(videoId: string) {
  try {
    // For simplicity in this implementation, we'll use a mock response
    // In a real app, you would make an API call to YouTube Data API
    
    // Simulated API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data - in a real app, replace this with an actual API call
    return {
      videoId,
      title: `YouTube Video ${videoId}`,
      description: 'This is a video description',
      channelTitle: 'Channel Name',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration: 240 // 4 minutes
    };
    
    // Real implementation would look something like:
    /*
    const API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!API_KEY) {
      throw new Error('YouTube API key not found');
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch video details');
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;
    
    // Parse ISO 8601 duration to seconds
    const duration = parseDuration(contentDetails.duration);
    
    return {
      videoId,
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      thumbnailUrl: snippet.thumbnails.high.url,
      duration
    };
    */
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Parse ISO 8601 duration format
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) {
    return 0;
  }
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}