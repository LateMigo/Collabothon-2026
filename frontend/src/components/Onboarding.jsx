import { useId, useState } from "react";
import HeroIllustration from "./HeroIllustration.jsx";
import { moneyCompact } from "../utils/format.js";

function YesNo({ label, description, value, onChange }) {
  const id = useId();
  return (
    <div className="yesno">
      <div>
        <p id={id} className="yesno__label">
          {label}
        </p>
        <p className="yesno__desc">{description}</p>
      </div>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        <button type="button" role="radio" aria-checked={value} onClick={() => onChange(true)}>
          Yes
        </button>
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(false)}>
          No
        </button>
      </div>
    </div>
  );
}

/** Universal start screen: no age groups, one clear path into the game. */
export default function Onboarding({ scenario, aiMode, onStart, busy }) {
  const [enableDividends, setEnableDividends] = useState(true);
  const [enableLivingCosts, setEnableLivingCosts] = useState(true);

  const weeks = scenario?.total_weeks ?? 6;
  const companies = scenario?.companies_count ?? 10;
  const startingCompanies = scenario?.starting_companies ?? 4;
  const interval = scenario?.listing_interval_weeks;
  const cash = scenario?.starting_cash ?? 2000;
  const rent = scenario?.initial_monthly_rent ?? 400;
  const period = scenario?.rent_period_weeks ?? 4;

  const submit = (event) => {
    event.preventDefault();
    onStart({
      game_mode: "single_investor",
      modifiers: { enable_dividends: enableDividends, enable_living_costs: enableLivingCosts },
    });
  };

  return (
    <main className="onboarding">
      <section className="onboarding__left">
        <div className="onboarding__content">
          <span className="tag-box tag-box--tilt">
            Galactic Exchange
            <br />
            Registration desk
          </span>
          <p className="eyebrow">An investing game for every generation</p>
          <h1 className="onboarding__title">
            <span className="onboarding__title-ink">Cosmi</span>
            <span className="onboarding__title-outline">Cash</span>
          </h1>
          <p className="onboarding__lead">
            You start with {moneyCompact(cash)} and {startingCompanies} companies
            {interval ? `, and a new one joins the exchange every ${interval} weeks` : ""} &mdash; {companies} in total
            over {weeks} weeks. Read the news, invest your money and keep enough cash for the rent.
          </p>

          <form className="setup-card" onSubmit={submit}>
            <p className="setup-card__head">Form R-1 &middot; Investor registration</p>
            <fieldset className="setup-group">
              <legend>A &middot; Game mode</legend>
              <div className="mode-options">
                <label className="mode-option is-selected">
                  <input type="radio" name="game-mode" value="single_investor" defaultChecked />
                  <span className="mode-option__title">Single Investor</span>
                  <span className="mode-option__desc">Build your own portfolio, week by week.</span>
                </label>
                <div className="mode-option is-disabled" aria-disabled="true">
                  <span className="soon-badge">Coming Soon (Phase 2)</span>
                  <span className="mode-option__title">CEO</span>
                  <span className="mode-option__desc">Run a company and choose between your advisors&apos; plans.</span>
                </div>
              </div>
            </fieldset>

            <fieldset className="setup-group">
              <legend>B &middot; Gameplay modifiers</legend>
              <YesNo
                label="Enable Dividends"
                description="Companies pay you cash every week for each share you own."
                value={enableDividends}
                onChange={setEnableDividends}
              />
              <YesNo
                label="Enable Living Costs / Monthly Rent"
                description={`Pay ${moneyCompact(rent)} rent every ${period} weeks. The news can change it!`}
                value={enableLivingCosts}
                onChange={setEnableLivingCosts}
              />
            </fieldset>

            <button type="submit" className="btn btn--red btn--xl btn--block" disabled={busy}>
              <span>{busy ? "Opening the market…" : "Enter the market"}</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </form>

          <p className="onboarding__foot">
            Fictional companies, real lessons. Results come from a scripted scenario, not a forecast.
          </p>
          <p className={`ai-chip ai-chip--${aiMode ?? "unknown"}`}>
            <span aria-hidden="true" />
            AI coach:{" "}
            {aiMode === "gemini"
              ? "Gemini connected"
              : aiMode === "fallback"
                ? "offline mode (works without an API key)"
                : "connecting…"}
          </p>
        </div>
      </section>

      <section className="onboarding__right">
        <HeroIllustration />
      </section>
    </main>
  );
}
