import Modal from "./Modal.jsx";

const STEPS = [
  {
    title: "Read the news",
    text: "Every week brings new headlines. Some move prices right away, some only weeks later — and some are just noise.",
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
    title: "Mind the dividend calendar",
    text: "Every company pays its dividend on its own schedule — every 2, 3 or 4 weeks, just like real companies. Only owners at the end of a payout week get the cash, so check “next payout” on the card before you buy or sell.",
  },
  {
    title: "Keep a safety pot",
    text: "Money in the savings vault earns a little interest every week and can’t lose value. If your cash is short on rent day, the vault pays the rest automatically.",
  },
  {
    title: "Lend money for a fixed rate",
    text: "At the bond desk you can open a bank term deposit (2, 4 or 8 weeks) or buy a bond that pays back halfway through the season or at the very end. Longer and riskier means a higher rate — but the money is locked, and a company bond can default if the company goes bankrupt.",
  },
  {
    title: "Meet new companies",
    text: "The season lasts 12 weeks. You start with 2 companies and a new one joins the exchange every 2 weeks (Weeks 3, 5, 7 and 9) — look for the “Just listed” stamp. More companies means more news to read.",
  },
  {
    title: "End the week",
    text: "Slide up the drawer at the bottom of the screen (look for the red End Week tab) and press the big red button. The market reacts: prices move, dividends are paid, and older news may finally land. A summary explains what happened and why.",
  },
  {
    title: "Pay your bills",
    text: "Rent is due every 4 weeks. Keep enough cash or savings! If both run out on rent day, the game ends — you get a warning before you end such a week. Rent is a bill, so your investing result is always shown before rent.",
  },
  {
    title: "Watch the risk",
    text: "The bankruptcy gauge shows how close a company is to the red line. If it gets there, the company goes bust and its shares become worth $0.",
  },
  {
    title: "Ask the advisor",
    text: "You get 3 hints per game (1 per week). Agent Vorr shows his reasoning step by step — about 7 in 10 hints are right, so check every step against the news.",
  },
  {
    title: "Take a break",
    text: "The Menu button in the top bar takes you back to the start screen. Your game is kept — press “Continue” there to pick it up again.",
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
