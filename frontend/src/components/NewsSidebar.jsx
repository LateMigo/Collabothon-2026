const DISPATCH_TIMES = ["08:00", "09:30", "11:15", "13:40", "15:05"];
const ACCENTS = ["var(--red)", "var(--blue)", "var(--yellow-deep)", "var(--green)"];

/**
 * Weekly headlines. The backend sends ONLY id, title and description - the player has to
 * work out on their own which story matters, how much, and when.
 */
export default function NewsSidebar({ week, news }) {
  return (
    <aside className="news-panel" aria-labelledby="news-title">
      <header className="news-panel__head">
        <div>
          <p className="eyebrow">Market dispatches</p>
          <h2 id="news-title" className="news-panel__title">
            Week {week} news
          </h2>
        </div>
        <span className="live-dot">New</span>
      </header>

      <ol className="news-list">
        {news.map((item, index) => (
          <li key={item.id} className="dispatch" style={{ "--accent": ACCENTS[index % ACCENTS.length] }}>
            <p className="dispatch__meta">
              Dispatch #{index + 1} &middot; {DISPATCH_TIMES[index % DISPATCH_TIMES.length]}
            </p>
            <h3 className="dispatch__title">{item.title}</h3>
            <p className="dispatch__text">{item.description}</p>
          </li>
        ))}
      </ol>

      <p className="news-panel__note">
        <strong>Read carefully:</strong> not every headline moves the market, and some effects only show up weeks
        later.
      </p>
    </aside>
  );
}
