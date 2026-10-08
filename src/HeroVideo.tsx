import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

function canAutoplay() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !connection?.saveData;
}

export function HeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [requested, setRequested] = useState(canAutoplay);
  const [loaded, setLoaded] = useState(canAutoplay);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const base = `${import.meta.env.BASE_URL}media/steaming-coffee`;

  useEffect(() => {
    const media = video.current!;
    let visible = true;
    const sync = () => {
      if (requested && loaded && visible && !document.hidden && !failed) {
        void media.play().catch(() => { /* Poster and play button remain available. */ });
      } else media.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(media);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); media.pause(); };
  }, [requested, loaded, failed]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { if (preference.matches) { setRequested(false); video.current?.pause(); } };
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);

  function toggle() {
    if (playing) { setRequested(false); video.current?.pause(); }
    else {
      setLoaded(true); setRequested(true);
      // Keep an explicit user gesture for browsers that decline muted autoplay.
      if (loaded) void video.current?.play().catch(() => {});
    }
  }

  return <div className={`hero-video ${playing ? 'is-playing' : ''}`}>
    <img className="hero-video-poster" src={`${base}.jpg`} alt="Steam drifting from a warm ceramic coffee cup on a quiet, sunlit table." fetchPriority="high"/>
    <video ref={video} src={loaded && !failed ? `${base}.mp4` : undefined} poster={`${base}.jpg`}
      muted loop playsInline preload={loaded ? 'metadata' : 'none'} aria-hidden="true" tabIndex={-1}
      hidden={failed} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setFailed(true); setPlaying(false); }}/>
    <div className="coffee-steam" aria-hidden="true"><i/><i/><i/></div>
    {!failed && <button type="button" className="hero-video-toggle" onClick={toggle} aria-label={playing ? 'Pause coffee video' : 'Play coffee video'}>
      <Icon name={playing ? 'pause' : 'play'}/><span>{playing ? 'Pause' : 'Play'}</span>
    </button>}
  </div>;
}
