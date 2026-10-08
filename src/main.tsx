import { Icon } from './Icon';
import { HeroVideo } from './HeroVideo';
import { DailyInspiration } from './DailyInspiration';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { BlogProvider, useBlog } from './blog';
import { Writer } from './Writer';
import { PostCard, StillLife, StoryContent } from './Story';
import { categories } from './model';
import './styles.css';

function Layout({ children }: { children: React.ReactNode }) {
  const { settings, error, loading, refresh, isWriter } = useBlog();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.title = `${settings.title} · Little joys & everyday stories`; }, [pathname, settings.title]);
  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <div className="welcome-strip">A little corner of the internet. A little room to breathe. <span><Icon name="flower"/></span></div>
    <header className="site-header"><Link className="brand" to="/"><img src={`${import.meta.env.BASE_URL}favicon.png`} alt=""/><span>{settings.title}<small>A PERSONAL NOTEBOOK</small></span></Link>
      <nav aria-label="Main navigation"><NavLink end to="/">Home</NavLink><NavLink to="/blog">Stories</NavLink><NavLink to="/photos">Photo diary</NavLink><NavLink to="/about">About</NavLink></nav>
      <Link className="header-note" to={isWriter ? '/writer' : '/blog'}>{isWriter ? 'Writing desk' : 'Stay a while'} <span><Icon name="outward"/></span></Link>
    </header>
    <main id="main-content" tabIndex={-1}>{error && <div className="notice error" role="alert">We couldn’t load the latest stories. <button onClick={() => void refresh()}>Try again</button></div>}{loading && <p className="loading" role="status">Opening the notebook…</p>}{children}</main>
    <footer className="site-footer"><div><Link className="footer-brand" to="/">{settings.title}<span><Icon name="flower"/></span></Link><p>{settings.tagline}</p></div><div><Link to="/about">A little about this corner</Link><Link to="/writer">Writer login <Icon name="outward"/></Link>{settings.email && <a href={`mailto:${settings.email}`}>Say hello</a>}</div><small>© {new Date().getFullYear()} {settings.title}. Made for ordinary, lovely days.</small></footer>
  </>;
}
function Home() {
  const { posts, settings } = useBlog();
  const published = posts.filter(p => p.status === 'published');
  return <>
    <section className="home-hero"><div className="hero-copy"><p className="eyebrow"><span className="dot"/> WELCOME TO MY LITTLE CORNER</p><h1>Life’s little things.<br/><em>Worth a story.</em></h1><p className="lead">A warm cup. An ordinary day. A thought worth keeping.<br className="desktop-break"/> A place for the moments in between.</p><div className="hero-actions"><Link className="button" to="/blog">Find your next read <span><Icon name="outward"/></span></Link><span className="hand-note">coffee is always welcome <Icon name="coffee"/></span></div><p className="hero-footnote">{settings.tagline}</p></div>
      <div className="coffee-moment"><HeroVideo/><div className="coffee-moment-heading"><span className="eyebrow">THE DAILY PAUSE</span><h2>Let the coffee cool.<br/><em>Let your soul catch up.</em></h2></div><DailyInspiration/></div>
    </section>
    <div className="category-ribbon"><span>MAKE YOURSELF AT HOME</span>{categories.map((c, i) => <Link key={c} to={`/blog?category=${encodeURIComponent(c)}`}><i className={`color-dot color-${i}`}/>{c} <Icon name="outward"/></Link>)}</div>
    <section className="section stories-section"><div className="section-heading"><div><p className="eyebrow">PAGES FROM THE NOTEBOOK</p><h2>A little lately.</h2></div><Link className="text-link" to="/blog">All stories <Icon name="outward"/></Link></div>
      {published.length ? <div className="story-grid">{published.slice(0, 3).map(p => <PostCard key={p.id} post={p}/>)}</div> : <div className="opening-note"><span>01 / A FRESH PAGE</span><h3>Every story starts somewhere.</h3><p>The notebook is open. New stories will find their way here soon.</p><Link className="text-link" to="/about">Get to know this corner <Icon name="outward"/></Link></div>}
    </section>
    <section className="about-band"><div className="about-mark" aria-hidden="true">hello<span><Icon name="heart"/></span></div><div><p className="eyebrow">A CORNER, NOT A HIGHLIGHT REEL</p><h2>Less perfect.<br/><em>More present.</em></h2><p>{settings.about.split('\n')[0]}</p><Link className="text-link" to="/about">Pull up a chair <Icon name="outward"/></Link></div></section>
    <section className="slow-note"><span><Icon name="flower"/></span><p>You don’t have to make something of every moment.<br/><em>Sometimes, you can just be in it.</em></p><Link to="/photos" className="text-link">The photo diary <Icon name="outward"/></Link></section>
  </>;
}
function Blog() {
  const { posts } = useBlog();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || ''; const category = params.get('category') || '';
  const filtered = posts.filter(p => p.status === 'published' && (!category || p.category === category) && `${p.title} ${p.summary} ${p.body}`.toLowerCase().includes(query.toLowerCase()));
  function filter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); }
  return <section className="section"><div className="page-heading"><p className="eyebrow">THE NOTEBOOK</p><h1>Ordinary days.<br/><em>Stories to keep.</em></h1><p className="lead">Little reflections, slow mornings, and everything in between.</p></div>
    <div className="story-tools"><div className="filter-pills" aria-label="Story categories">{['', ...categories].map(c => <button key={c} aria-pressed={category === c} onClick={() => filter('category', c)}>{c || 'All stories'}</button>)}</div><label className="search-field"><span className="sr-only">Search stories</span><input type="search" placeholder="Find a little something…" value={query} onChange={e => filter('q', e.target.value)}/></label></div>
    <p className="meta" role="status">{filtered.length} {filtered.length === 1 ? 'story' : 'stories'} to settle into</p>
    {filtered.length ? <div className="story-grid">{filtered.map(p => <PostCard key={p.id} post={p}/>)}</div> : <div className="empty-state"><span><Icon name="flower"/></span><h2>{query || category ? 'Nothing on this page just yet.' : 'Good stories take their time.'}</h2><p>{query || category ? 'Try another word or browse all the stories.' : 'The first chapter is on its way. You’re welcome back anytime.'}</p>{(query || category) && <button className="button secondary" onClick={() => setParams({})}>Clear filters</button>}</div>}
  </section>;
}
function PostPage() {
  const { slug } = useParams(); const { posts, loading } = useBlog();
  const [copied, setCopied] = useState('');
  const post = posts.find(p => p.slug === slug && p.status === 'published');
  if (loading) return null;
  if (!post) return <NotFound/>;
  return <section className="section"><Link className="text-link" to="/blog"><Icon name="back"/> Back to the notebook</Link><StoryContent post={post}/><div className="reading-actions"><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied('Link copied.'); } catch { setCopied('Copy the address from your browser to share this story.'); } }}>Share this story <Icon name="outward"/></button><span role="status">{copied}</span></div>{posts.filter(p => p.status === 'published' && p.id !== post.id).length > 0 && <><div className="section-heading"><h2>A little more to read.</h2></div><div className="story-grid">{posts.filter(p => p.status === 'published' && p.id !== post.id).slice(0, 2).map(p => <PostCard key={p.id} post={p}/>)}</div></>}</section>;
}
function PhotoDiary() {
  const { posts } = useBlog(); const photos = posts.filter(p => p.status === 'published').flatMap(post => post.photos.map(photo => ({ post, photo })));
  return <section className="section"><div className="page-heading"><p className="eyebrow">THE PHOTO DIARY</p><h1>A few things<br/><em>worth noticing.</em></h1><p className="lead">Small moments, kept in pictures.</p></div>{photos.length ? <div className="photo-diary">{photos.map(({ post, photo }, i) => <figure key={`${post.id}-${photo.path}`}><Link to={`/blog/${post.slug}`}><img src={photo.url} alt={photo.alt} loading="lazy"/></Link><figcaption><span>{String(i + 1).padStart(2, '0')} / {post.category}</span><p>{photo.caption || post.title}</p><Link className="text-link" to={`/blog/${post.slug}`}>The story behind it <Icon name="outward"/></Link></figcaption></figure>)}</div> : <div className="empty-state"><span><Icon name="sun"/></span><h2>Room for the moments to come.</h2><p>Photos from published stories will gather here.</p><Link className="text-link" to="/blog">Visit the notebook <Icon name="outward"/></Link></div>}</section>;
}
function About() {
  const { settings } = useBlog();
  return <section className="section about-page"><div className="page-heading"><p className="eyebrow">HELLO, AND WELCOME</p><h1>A little space<br/><em>to be yourself.</em></h1></div><div className="about-layout"><div className="about-paper"><StillLife/><p>A place to pause. A place to begin.</p></div><div className="about-copy"><h2>This is {settings.title}.</h2>{settings.about.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}<div className="about-values">{categories.map(c => <span key={c}><Icon name="flower"/> {c}</span>)}</div><Link className="button" to="/blog">Open the notebook <Icon name="outward"/></Link>{(settings.email || settings.instagram) && <div className="contact-card"><h3>Leave a little hello.</h3>{settings.email && <a className="text-link" href={`mailto:${settings.email}`}>Send an email <Icon name="outward"/></a>}{settings.instagram && <a className="text-link" href={`https://www.instagram.com/${encodeURIComponent(settings.instagram)}/`} target="_blank" rel="noreferrer">Instagram <Icon name="outward"/></a>}</div>}</div></div></section>;
}
function NotFound() { return <section className="empty-state"><span><Icon name="undo"/></span><h1>A page turned too far.</h1><p>This story may have moved or returned to the draft pile.</p><Link className="button" to="/blog">Back to stories</Link></section>; }
function App() { return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/blog" element={<Blog/>}/><Route path="/blog/:slug" element={<PostPage/>}/><Route path="/photos" element={<PhotoDiary/>}/><Route path="/about" element={<About/>}/><Route path="/contact" element={<About/>}/><Route path="/writer" element={<Writer/>}/><Route path="*" element={<NotFound/>}/></Routes></Layout>; }
const Router = import.meta.env.MODE === 'pages' ? HashRouter : BrowserRouter;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Router><BlogProvider><App/></BlogProvider></Router></React.StrictMode>);
