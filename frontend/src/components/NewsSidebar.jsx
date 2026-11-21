import { useEffect, useState } from "react";

const DISPATCH_TIMES = ["08:00", "09:30", "11:15", "13:40", "15:05"];

/**
 * "Who is this story about?" Every headline - rumors included - gets the same kind of tag,
 * so a tag connects the news to a company without revealing whether it matters.
 */
function NewsTags({ tags }) {
  if (!tags?.length) return null;
  return (
    <div className="news-tags">
      <span className="news-tags__label">Concerns</span>
      <ul>
        {tags.map((tag) => (
          <li
            key={`${tag.kind}-${tag.label}`}
            className={`news-tag news-tag--${tag.kind}`}
            style={tag.color ? { "--tag-color": tag.color } : undefined}
          >
            {tag.kind === "sector" ? (
              <>
                <span className="news-tag__kind">Sector:</span> {tag.label}
                {tag.tickers.length > 0 && <b className="news-tag__tickers">{tag.tickers.join(" · ")}</b>}
              </>
            ) : (
              <>
                <span className="news-tag__kind">{tag.kind === "bills" ? "Bills:" : "Bank:"}</span> {tag.label}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The weekly newspaper, one story at a time. The backend sends ONLY id, title, description
 * and who a story is about - the player has to work out whether it matters, how much, and when.
 */
export default function NewsSidebar({ week, news }) {
  const [index, setIndex] = useState(0);

  // A new week brings a new edition: start from the front page again.
  useEffect(() => {
    setIndex(0);
  }, [week]);

  const total = news.length;
  const current = Math.min(index, Math.max(total - 1, 0));
  const item = news[current];

  return (
    <aside className="news-panel newspaper" aria-label={`Week ${week} news`}>
      <header className="newspaper__masthead">
        <p className="newspaper__issue">
          <span>Week {week} edition</span>
          <span className="live-dot">New</span>
        </p>
        <h2 className="newspaper__title">The Galactic Ledger</h2>
        <p className="newspaper__motto">All the news that moves the market &mdash; sooner or later.</p>
      </header>

      {item && (
        <>
          <div className="news-pager">
            <button
              type="button"
              className="news-pager__btn"
              onClick={() => setIndex(current - 1)}
              disabled={current === 0}
              aria-label="Previous story"
            >
              &#9664;
            </button>
            <span className="news-pager__count">
              Story {current + 1} of {total}
            </span>
            <button
              type="button"
              className="news-pager__btn"
              onClick={() => setIndex(current + 1)}
              disabled={current === total - 1}
              aria-label="Next story"
            >
              &#9654;
            </button>
          </div>

          <article className="dispatch dispatch--lead" key={item.id} aria-live="polite">
            <p className="dispatch__meta">
              Dispatch #{current + 1} &middot; {DISPATCH_TIMES[current % DISPATCH_TIMES.length]}
            </p>
            <h3 className="dispatch__title">{item.title}</h3>
            <p className="dispatch__text">{item.description}</p>
            <NewsTags tags={item.tags} />
          </article>

          <div className="news-pager__dots" role="group" aria-label="Choose a story">
            {news.map((story, i) => (
              <button
                key={story.id}
                type="button"
                className={i === current ? "is-active" : ""}
                aria-label={`Story ${i + 1}: ${story.title}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}

      <p className="news-panel__note">
        <strong>Read carefully:</strong> a tag tells you <em>who</em> a story is about &mdash; not whether it is true.
        Not every headline moves the market, and some effects only show up weeks later.
      </p>
    </aside>
  );
}
