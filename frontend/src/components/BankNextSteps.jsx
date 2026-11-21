import { api } from "../api/client.js";

export default function BankNextSteps({ offers, disclaimer, sessionId }) {
  if (!offers?.length) return null;

  const click = (offer) => {
    api.kpiEvent({ event: "offer_clicked", session_id: sessionId, detail: offer.id });
  };

  return (
    <section className="bank-steps" aria-labelledby="bank-steps-title">
      <header className="bank-steps__head">
        <span className="bank-steps__ribbon" aria-hidden="true" />
        <div>
          <p className="bank-steps__kicker">From the game to real life &middot; Commerzbank</p>
          <h2 id="bank-steps-title">Your next 3 money steps</h2>
          <p className="bank-steps__sub">Picked from how you played this season - start with step 1.</p>
        </div>
      </header>

      <ol className="bank-steps__list">
        {offers.map((offer) => (
          <li key={offer.id} className="bank-offer">
            <span className="bank-offer__rank">{offer.rank}</span>
            <p className="bank-offer__product">{offer.product}</p>
            <h3 className="bank-offer__headline">{offer.headline}</h3>
            <p className="bank-offer__why">
              <b>Why you:</b> {offer.why}
            </p>
            <p className="bank-offer__what">{offer.what_it_is}</p>
            <a
              className="btn btn--yellow btn--block bank-offer__cta"
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => click(offer)}
            >
              <span>{offer.cta_label}</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </li>
        ))}
      </ol>
      <p className="bank-steps__disclaimer">{disclaimer}</p>
    </section>
  );
}
