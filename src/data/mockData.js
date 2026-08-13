import coffeeShopArtwork from '../assets/coffee-shop-artwork.png';
import sleepPlaylist from '../assets/sleep-playlist.png';
import relaxPlaylist from '../assets/relax-playlist.png';
import lofiPlaylist from '../assets/lofi-playlist.png';
import jazzLofi from '../assets/jazz-lofi-focus.png';

export const currentUser = {
  name: 'Ravi',
  avatar: 'U',
};

// Default initial now playing
export const nowPlaying = {
  title: 'Coffee Shop',
  artist: 'Jazz',
  songName: '(Song name)',
  artwork: coffeeShopArtwork,
  duration: '3:45',
  currentTime: '1:32',
};

export const playlists = [
  {
    id: 1,
    name: 'Sleep',
    subtitle: 'Calm • Rest • Sleep',
    artwork: sleepPlaylist,
    label: "Zix'Ovibes Library",
    title: 'Sleep Forest',
    artist: "Zix'O Ambient",
    songName: 'Deep Slumber',
    duration: 225, // 3:45
  },
  {
    id: 2,
    name: 'Relax',
    subtitle: 'Waves • Coastal • Relax',
    artwork: relaxPlaylist,
    label: "Zix'Ovibes Library",
    title: 'Relax Waves',
    artist: 'Ocean Calm',
    songName: 'Sunset Beach',
    duration: 255, // 4:15
  },
  {
    id: 3,
    name: 'Lo-Fi',
    subtitle: 'Beats • Study • Focus',
    artwork: lofiPlaylist,
    label: "Zix'Ovibes Library",
    title: 'Lo-Fi Study',
    artist: 'Chill Beats',
    songName: 'Late Night Coffee',
    duration: 180, // 3:00
  },
  {
    id: 4,
    name: 'Jazz',
    subtitle: 'Smooth • Calm • Lounge',
    artwork: coffeeShopArtwork,
    label: "Zix'Ovibes Library",
    title: 'Jazz Evening',
    artist: 'Lounge Deluxe',
    songName: 'Midnight Smooth',
    duration: 210,
  },
  {
    id: 'playlist_for_you',
    name: 'Playlist for You',
    subtitle: 'AI-Generated • Task-based',
    artwork: '/playlist-covers/playlist-for-you.jpg',
    label: "Zix'Ovibes AI",
    title: 'Playlist for You',
    artist: "Zix'Ovibes AI",
    songName: 'AI Music Generation',
    duration: 0,
  },
  {
    id: 5,
    name: 'Ambience',
    subtitle: 'Nature • Chill • Ambient',
    artwork: relaxPlaylist,
    label: "Zix'Ovibes Library",
    title: 'Deep Focus Ambient',
    artist: "Zix'O Library",
    songName: 'Neural Flow',
    duration: 240,
  },
  {
    id: 6,
    name: 'Rain',
    subtitle: 'Storm • Window • Study',
    artwork: lofiPlaylist,
    label: "Zix'Ovibes Library",
    title: 'Rain Study Session',
    artist: "Zix'O Library",
    songName: 'Raindrops on Window',
    duration: 195,
  },
  {
    id: 7,
    name: 'Focus',
    subtitle: 'Instrumental • Concentration',
    artwork: jazzLofi,
    label: "Zix'Ovibes Library",
    title: 'Deep Focus',
    artist: 'ConcernedApe',
    songName: 'Deep Focus',
    duration: 240,
  },
];

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}
