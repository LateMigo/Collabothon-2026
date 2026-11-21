import { useCallback, useEffect, useRef, useState } from "react";
import CompanyCard from "./CompanyCard.jsx";

/**
 * Company dossiers in a horizontal tray: flip through them with the side arrows
 * instead of scrolling the whole page down.
 */
/** Width of one "page" of slides (whole cards + the gaps between them). */
function pageStep(track) {
  const slide = track.firstElementChild;
  if (!slide) return track.clientWidth;
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  const slideStep = slide.getBoundingClientRect().width + gap;
  const perPage = Math.max(1, Math.round((track.clientWidth + gap) / slideStep));
  return perPage * slideStep;
}

export default function CompanyCarousel({ companies, onTrade, disabled }) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setAtStart(track.scrollLeft <= 10);
    setAtEnd(track.scrollLeft >= maxScroll - 10);
    const step = pageStep(track);
    const total = Math.max(1, Math.ceil((maxScroll - 10) / step) + 1);
    setPages(total);
    setPage(
      track.scrollLeft >= maxScroll - 10
        ? total - 1
        : Math.min(total - 1, Math.round(track.scrollLeft / step)),
    );
  }, []);

  useEffect(() => {
    update();
    const track = trackRef.current;
    const observer = new ResizeObserver(update);
    if (track) observer.observe(track);
    return () => observer.disconnect();
  }, [update, companies.length]);

  const go = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * pageStep(track), behavior: "smooth" });
  };

  const goTo = (index) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * pageStep(track), behavior: "smooth" });
  };

  return (
    <section className="carousel" aria-label="Companies" aria-roledescription="carousel">
      <button
        type="button"
        className="carousel__arrow carousel__arrow--prev"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label="Previous companies"
      >
        &#9664;
      </button>

      <div className="carousel__track" ref={trackRef} onScroll={update}>
        {companies.map((company) => (
          <div className="carousel__slide" key={company.id}>
            <CompanyCard company={company} onTrade={onTrade} disabled={disabled} />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="carousel__arrow carousel__arrow--next"
        onClick={() => go(1)}
        disabled={atEnd}
        aria-label="Next companies"
      >
        &#9654;
      </button>

      {pages > 1 && (
        <div className="carousel__dots" role="group" aria-label="Choose page">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === page ? "is-active" : ""}
              aria-label={`Page ${i + 1} of ${pages}`}
              aria-current={i === page ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
