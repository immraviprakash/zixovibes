import { memo } from 'react';
import styles from './NowPlaying.module.css';

import { useApp } from '../../context/AppContext';

const NowPlaying = memo(function NowPlaying() {
  const { currentSong, activePlaylist } = useApp();
  
  const songName = currentSong ? currentSong.title : (activePlaylist ? (activePlaylist.songName || activePlaylist.title) : '(Song name)');
  const artist = currentSong ? currentSong.artist : (activePlaylist ? activePlaylist.artist : '(Artist)');

  return (
    <div className={styles.nowPlaying}>
      <span className={styles.songName} title={songName}>
        {songName}
      </span>
      <span className={styles.artistName} title={artist}>
        {artist}
      </span>
    </div>
  );
});

export default NowPlaying;
