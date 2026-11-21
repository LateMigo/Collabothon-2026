import Modal from "./Modal.jsx";

const STEPS = [
  {
    title: "Read the news",
    text: "Every week brings new headlines. Some move prices right away, some only weeks later — and some are just noise. The tag under each story shows which sector and company it is about.",
  },
  {
    title: "Buy or sell",
    text: "Press “Buy / Sell” on a company card. Selling costs a 5% fee, so selling right after buying loses money — plan to hold. Tap any [?] for a one-sentence explanation.",
  },
  {
    title: "Check the hard data",
    text: "Flip a card with “Details”: cash, debt and profit margin with arrows. A red dot means new numbers this week. When the news shouts “success” but debt keeps rising, be careful. And read the fine print!",
  },
  {
    title: "Keep a safety pot",
    text: "Money in the savings vault earns a little interest every week and can’t lose value. If your cash is short on rent day, the vault pays the rest automatically.",
  },
  {
    title: "Meet new companies",
    text: "The season lasts 12 weeks. You start with 2 companies and a new one joins the exchange every 2 weeks (Weeks 3, 5, 7 and 9) \u2014 look for the \u201cJust listed\u201d stamp.",
  },
  {
    title: "End the week",
    text: "The market reacts: prices move, dividends are paid, and older news may finally land. A summary explains what happened and why.",
  },
  {
    title: "Pay your bills",
    text: "Rent is due every 4 weeks. Keep enough cash or savings! If both run out on rent day, the game ends.",
  },
  {
    title: "Watch the risk",
    text: "A company with a Critical bankruptcy risk can go bust. Its shares then become worth $0.",
  },
  {
    title: "Ask the advisor",
    text: "You get 3 hints per game (1 per week). Agent Vorr shows his reasoning step by step — about 7 in 10 hints are right, so check every step against the news.",
  },
];

export default function HowToPlay({ onClose }) {
  return (
    <Modal labelledBy="help-title" onClose={onClose} className="help-modal">
      <header className="help-modal__head">
        <div>
          <p className="eyebrow">Clerk&apos;s handbook &middot; page 1</p>
          <h2 id="help-title" className="section-title section-title--xl">
            How to play
          </h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>
      <ol className="help-steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="help-steps__num">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn--yellow btn--block" onClick={onClose}>
        Got it
      </button>
    </Modal>
  );
}
