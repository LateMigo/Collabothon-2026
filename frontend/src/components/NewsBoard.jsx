import { useMemo, useState } from "react";

export default function NewsBoard({ archive, currentWeek }) {
  const [week, setWeek] = useState("all");
  const total = archive.reduce((sum, issue) => sum + issue.items.length, 0);

  const clippings = useMemo(() => {
    const issues = week === "all" ? archive : archive.filter((issue) => issue.week === week);
    return issues.flatMap((issue) =>
      issue.items.map((item, i) => ({ ...item, week: issue.week, tilt: ((item.id.length + i * 3) % 5) - 2 })),
    );
  }, [archive, week]);

  return (
    <section className="news-board" aria-labelledby="news-board-title">
      <header className="news-board__head">
        <div>
          <p className="eyebrow">The Galactic Ledger &middot; archive wall</p>
          <h2 id="news-board-title" className="news-board__title">
            Old news board
          </h2>
        </div>
        <p className="news-board__count">
          {total} {total === 1 ? "clipping" : "clippings"}
        </p>
      </header>

      {archive.length === 0 ? (
        <p className="news-board__empty">
          The wall is still empty. When Week {currentWeek} ends, its headlines get pinned up here - so you can check
          later what was said, and when.
        </p>
      ) : (
        <>
          <div className="news-board__filters" role="group" aria-label="Show clippings from">
            <button
              type="button"
              className={week === "all" ? "is-active" : ""}
              aria-pressed={week === "all"}
              onClick={() => setWeek("all")}
            >
              All weeks
            </button>
            {[...archive]
              .sort((a, b) => a.week - b.week)
              .map((issue) => (
                <button
                  key={issue.week}
                  type="button"
                  className={week === issue.week ? "is-active" : ""}
                  aria-pressed={week === issue.week}
                  onClick={() => setWeek(issue.week)}
                  title={issue.theme}
                >
                  W{issue.week}
                </button>
              ))}
          </div>

          <ul className="news-board__wall">
            {clippings.map((clip) => (
              <li key={clip.id} className="clipping" style={{ "--clip-tilt": `${clip.tilt * 0.6}deg` }}>
                <span className="clipping__pin" aria-hidden="true" />
                <p className="clipping__week">Week {clip.week}</p>
                <h3 className="clipping__title">{clip.title}</h3>
                <p className="clipping__text">{clip.description}</p>
              </li>
            ))}
          </ul>
          <p className="news-board__note">
            Tip: stories can take weeks to reach a company&apos;s money. Compare old headlines with the chart above.
          </p>
        </>
      )}
    </section>
  );
}
