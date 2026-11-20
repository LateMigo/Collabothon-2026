import Modal from "./Modal.jsx";

const STEPS = [
  {
    title: "Read the news",
    text: "Every week brings new headlines. Some move prices right away, some only weeks later — and some are just noise.",
  },
  {
    title: "Buy or sell",
    text: "Press “Buy / Sell” on a company card. Flip a card with “Details” to learn who runs the company and how it is doing.",
  },
  {
    title: "End the week",
    text: "The market reacts: prices move, dividends are paid, and older news may finally land. A summary explains what happened and why.",
  },
  {
    title: "Pay your bills",
    text: "Rent is due every 4 weeks. Keep enough cash! If your cash drops below zero on rent day, the game ends.",
  },
  {
    title: "Watch the risk",
    text: "A company with a Critical bankruptcy risk can go bust. Its shares then become worth $0.",
  },
  {
    title: "Ask the advisor",
    text: "You get 3 hints per game (1 per week). About 7 in 10 are right — so always double-check them against the news.",
  },
];

export default function HowToPlay({ onClose }) {
  return (
    <Modal labelledBy="help-title" onClose={onClose} className="help-modal">
      <header className="help-modal__head">
        <div>
          <p className="eyebrow">Quick guide</p>
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
