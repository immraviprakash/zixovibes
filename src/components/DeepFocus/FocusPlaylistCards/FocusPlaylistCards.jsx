import { useLayoutEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { playlists } from '../../../data/mockData';
import styles from './FocusPlaylistCards.module.css';

export default function FocusPlaylistCards({ layout = 'horizontal' }) {
  const { selectedFocusPlaylist, setSelectedFocusPlaylist, setIsPlaying, searchQuery = '', playlistsList = [], setOpenedPlaylist } = useApp();

  const cardInnerRefs = useRef({});
  const textRefs = useRef({});
  const prevRectsRef = useRef({});

  const defaultAiPlaylist = {
    id: 'playlist_for_you',
    name: 'Playlist for You',
    title: 'Playlist for You',
    subtitle: 'AI-Generated • Task-based',
    description: 'A dedicated playlist designed based on your current task.',
    artwork: '/playlist-covers/playlist-for-you.jpg',
    cover: '/playlist-covers/playlist-for-you.jpg',
    badge: '✦ AI GENERATED',
  };

  const rawSource = playlistsList.length > 0 ? playlistsList : playlists;
  const hasAiPlaylist = rawSource.some(p => String(p.id) === 'playlist_for_you');
  const sourcePlaylists = hasAiPlaylist ? rawSource : [...rawSource, defaultAiPlaylist];

  const order = ['focus', 'lofi', 'playlist_for_you', 'ambience', 'rain', 'jazz'];

  const normalizeId = (id) => {
    const idStr = String(id).toLowerCase();
    if (idStr === '1' || idStr === 'sleep') return 'sleep';
    if (idStr === '2' || idStr === 'relax') return 'relax';
    if (idStr === '3' || idStr === 'lofi' || idStr === 'lo-fi') return 'lofi';
    if (idStr === '4' || idStr === 'jazz') return 'jazz';
    if (idStr === '5' || idStr === 'ambience') return 'ambience';
    if (idStr === '6' || idStr === 'rain') return 'rain';
    if (idStr === '7' || idStr === 'focus') return 'focus';
    if (idStr === 'playlist_for_you') return 'playlist_for_you';
    return idStr;
  };

  const filteredPlaylists = sourcePlaylists
    .filter((playlist) => {
      const canonId = normalizeId(playlist.id);
      return order.includes(canonId);
    })
    .sort((a, b) => {
      const indexA = order.indexOf(normalizeId(a.id));
      const indexB = order.indexOf(normalizeId(b.id));
      return indexA - indexB;
    })
    .filter((playlist) => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        (playlist.name && playlist.name.toLowerCase().includes(term)) ||
        (playlist.title && playlist.title.toLowerCase().includes(term)) ||
        (playlist.description && playlist.description.toLowerCase().includes(term))
      );
    });

  useLayoutEffect(() => {
    const hasPrev = Object.keys(prevRectsRef.current).length > 0;
    const prevLayout = prevRectsRef.current.layout;

    if (hasPrev && prevLayout !== layout) {
      filteredPlaylists.forEach((playlist) => {
        const id = playlist.id;
        const innerEl = cardInnerRefs.current[id];
        const textEl = textRefs.current[id];
        const firstInner = prevRectsRef.current[id]?.inner;
        const firstText = prevRectsRef.current[id]?.text;

        if (innerEl && firstInner && textEl && firstText) {
          // Clear current transforms/transitions to get natural layout rects
          innerEl.style.transition = 'none';
          innerEl.style.transform = 'none';
          textEl.style.transition = 'none';
          textEl.style.transform = 'none';

          // Force reflow and measure Last
          const lastInner = innerEl.getBoundingClientRect();
          const lastText = textEl.getBoundingClientRect();

          // Calculate Inverted Deltas
          const dxInner = firstInner.left - lastInner.left;
          const dyInner = firstInner.top - lastInner.top;
          const sxInner = firstInner.width / lastInner.width;
          const syInner = firstInner.height / lastInner.height;

          const dxText = firstText.left - lastText.left;
          const dyText = firstText.top - lastText.top;

          // Apply Inverted Styles instantly
          innerEl.style.transform = `translate3d(${dxInner}px, ${dyInner}px, 0) scale(${sxInner}, ${syInner})`;
          innerEl.style.transformOrigin = 'top left';

          textEl.style.transform = `translate3d(${dxText}px, ${dyText}px, 0)`;
          textEl.style.transformOrigin = 'top left';

          // Force browser reflow
          innerEl.offsetHeight;
          textEl.offsetHeight;

          // Animate back to identity in double animation frame
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              innerEl.style.transition = 'transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
              innerEl.style.transform = 'none';

              textEl.style.transition = 'transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
              textEl.style.transform = 'none';
            });
          });
        }
      });
    }

    // Save current rects for the next transition
    const newRects = { layout };
    filteredPlaylists.forEach((playlist) => {
      const id = playlist.id;
      const innerEl = cardInnerRefs.current[id];
      const textEl = textRefs.current[id];
      if (innerEl && textEl) {
        newRects[id] = {
          inner: innerEl.getBoundingClientRect(),
          text: textEl.getBoundingClientRect(),
        };
      }
    });
    prevRectsRef.current = newRects;
  }, [layout, filteredPlaylists]);

  if (filteredPlaylists.length === 0) {
    return (
      <div className={styles.noResults}>
        <h3 className={styles.noResultsTitle}>No results found</h3>
        <p className={styles.noResultsSubtitle}>Try searching for another song, artist, or playlist</p>
      </div>
    );
  }

  return (
    <div className={`${styles.grid} ${layout === 'vertical' ? styles.vertical : ''}`}>
      {filteredPlaylists.map((playlist) => {
        const isActive = selectedFocusPlaylist?.id === playlist.id;
        const title = playlist.title || playlist.name;
        const cover = playlist.cover || playlist.artwork;
        const sub = playlist.description || playlist.subtitle;

        return (
          <div
            key={playlist.id}
            className={`${styles.card} ${isActive ? styles.active : ''}`}
            onClick={() => {
              setOpenedPlaylist(playlist);
            }}
          >
            <div className={styles.cardInner} ref={el => { cardInnerRefs.current[playlist.id] = el; }}>
              {/* Artwork */}
              <div className={styles.artworkWrap}>
                <img
                  src={cover}
                  alt={title}
                  className={styles.artwork}
                  onError={(e) => { e.target.src = '/playlist-covers/sleep.jpg'; }}
                  draggable="false"
                />
              </div>
            </div>
            <div className={styles.textDetails} ref={el => { textRefs.current[playlist.id] = el; }}>
              <span className={styles.title}>{title}</span>
              <span className={styles.subtitle}>{sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
