import { Icon } from './Icon';
import { Link } from 'react-router-dom';
import { formatDate, readingTime } from './model';
import type { Post } from './model';

export function StillLife({ small = false }: { small?: boolean }) {
  return <div className={`still-life ${small ? 'small' : ''}`} aria-hidden="true">
    <div className="sun-disc"/><div className="window-line"/><div className="vase"><i/><i/><i/></div>
    <div className="book book-back"/><div className="book book-front"/><div className="coffee"><span><Icon name="heart"/></span></div>
    <div className="table-line"/><span className="still-caption">a little pause, just for you.</span>
  </div>;
}
export function PostCard({ post }: { post: Post }) {
  return <article className="story-card">
    <Link className="story-image" to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
      {post.photos[0]?.url ? <img src={post.photos[0].url} alt={post.photos[0].alt} loading="lazy"/> : <StillLife small/>}
      <span className="category-tag">{post.category}</span>
    </Link>
    <div className="story-card-copy"><p className="meta">{formatDate(post.published_at)} <span>·</span> {readingTime(post.body)} min read</p>
      <h3><Link to={`/blog/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p>
      <Link className="text-link" to={`/blog/${post.slug}`}>Stay for the story <span><Icon name="outward"/></span></Link>
    </div>
  </article>;
}
export function StoryContent({ post, preview = false }: { post: Post; preview?: boolean }) {
  return <article className="reading-room">
    <header className="story-heading"><p className="eyebrow">{post.category}{preview ? ' · PREVIEW' : ''}</p><h1>{post.title || 'Your story title'}</h1>
      <p className="lead">{post.summary || 'A few words to invite someone into your story.'}</p>
      <p className="meta">{post.published_at ? formatDate(post.published_at) : 'Not published yet'} · {readingTime(post.body)} min read</p>
    </header>
    {post.photos[0] && <figure className="cover-photo">{post.photos[0].url ? <img src={post.photos[0].url} alt={post.photos[0].alt}/> : <p>Photo unavailable. Refresh to try again.</p>}<figcaption>{post.photos[0].caption}</figcaption></figure>}
    <div className="story-prose">{post.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
    {post.photos.length > 1 && <div className="story-gallery">{post.photos.slice(1).map(photo => <figure key={photo.path}>{photo.url ? <img src={photo.url} alt={photo.alt} loading="lazy"/> : <p>Photo unavailable.</p>}<figcaption>{photo.caption}</figcaption></figure>)}</div>}
    <div className="story-end"><span><Icon name="flower"/></span><p>Thank you for spending a little of your day here.</p></div>
  </article>;
}
