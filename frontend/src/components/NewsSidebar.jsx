const DISPATCH_TIMES = ["08:00", "09:30", "11:15", "13:40", "15:05"];

/**
 * The weekly newspaper. The backend sends ONLY id, title and description - the player has to
 * work out on their own which story matters, how much, and when.
 */
export default function NewsSidebar({ week, news }) {
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

      <ol className="news-list">
        {news.map((item, index) => (
          <li key={item.id} className={`dispatch ${index === 0 ? "dispatch--lead" : ""}`}>
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
