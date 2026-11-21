import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client.js";
import AdvisorWidget from "./components/AdvisorWidget.jsx";
import CompanyCarousel from "./components/CompanyCarousel.jsx";
import GameOverScreen from "./components/GameOverScreen.jsx";
import HowToPlay from "./components/HowToPlay.jsx";
import HudBar from "./components/HudBar.jsx";
import NewsSidebar from "./components/NewsSidebar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import ScenarioPanel from "./components/ScenarioPanel.jsx";
import StockChart from "./components/StockChart.jsx";
import TradeModal from "./components/TradeModal.jsx";
import WeekSummaryModal from "./components/WeekSummaryModal.jsx";
import { money, moneyCompact, readStorage, writeStorage } from "./utils/format.js";

const SESSION_KEY = "fq.sessionId";

function EndWeekBar({ game, busy, onNextWeek }) {
  const { rent, cash, current_week: week, total_weeks: total } = game;
  const rentDueNow = rent.enabled && rent.next_due_week === week;
  const short = rentDueNow && cash < rent.monthly_rent;
  const lastWeek = week === total;

  return (
    <div className={`action-bar ${short ? "action-bar--danger" : ""}`}>
      <div className="action-bar__lip" aria-hidden="true">
        <span>&#9650;</span>
        {short ? "Rent alert · " : ""}
        {lastWeek ? "Finish the season" : `End Week ${week}`}
        <span>&#9650;</span>
      </div>
      <div className="action-bar__row">
      <div className="action-bar__text">
        <p className="eyebrow">{lastWeek ? "Final week" : "Ready?"}</p>
        {short ? (
          <p role="alert">
            <strong>Rent of {moneyCompact(rent.monthly_rent)} is due at the end of this week</strong>, but you only have{" "}
            {money(cash)} in cash. Sell some shares first &mdash; or the game ends.
          </p>
        ) : (
          <p>
            Ending the week lets the market react to the news
            {game.modifiers.enable_dividends ? ", pays your dividends" : ""}
            {rentDueNow ? ` and collects ${moneyCompact(rent.monthly_rent)} rent` : ""}.
          </p>
        )}
      </div>
      <button type="button" className="btn btn--red btn--xl" onClick={onNextWeek} disabled={busy}>
        <span>{busy ? "The market is reacting…" : lastWeek ? "Finish the season" : `End Week ${week}`}</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("onboarding"); // onboarding | playing | gameover
  const [game, setGame] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tradeCompanyId, setTradeCompanyId] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [busy, setBusy] = useState(null); // "start" | "advisor" | "next" | null
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scenario, setScenario] = useState(null);
  const [aiMode, setAiMode] = useState(null);
  const toastTimer = useRef(null);


  // Onboarding info + AI status.
  useEffect(() => {
    api.scenario().then(setScenario).catch(() => {});
    api
      .health()
      .then((health) => setAiMode(health.ai_mode))
      .catch((err) => setError(err.message));
  }, []);

  // Resume a running game after a page refresh (same tab).
  useEffect(() => {
    const savedId = readStorage("sessionStorage", SESSION_KEY);
    if (!savedId) return;
    api
      .getSession(savedId)
      .then((state) => {
        setGame(state);
        setPhase(state.is_game_over ? "gameover" : "playing");
      })
      .catch(() => writeStorage("sessionStorage", SESSION_KEY, null));
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleError = useCallback((err) => {
    setError(err.message);
    if (err.code === "session_not_found") {
      writeStorage("sessionStorage", SESSION_KEY, null);
      setGame(null);
      setSummary(null);
      setPhase("onboarding");
    }
  }, []);

  const startGame = async (config) => {
    setBusy("start");
    setError(null);
    try {
      const state = await api.createSession(config);
      writeStorage("sessionStorage", SESSION_KEY, state.session_id);
      setGame(state);
      setAdvice(null);
      setSummary(null);
      setPhase("playing");
      window.scrollTo({ top: 0 });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const trade = async (companyId, action, shares) => {
    // The trade form closes itself after its "Approved" stamp animation.
    const result = await api.trade(game.session_id, { company_id: companyId, action, shares });
    setGame(result.state);
    showToast(result.message);
    return result;
  };

  const askAdvisor = async () => {
    setBusy("advisor");
    setError(null);
    try {
      const result = await api.askAdvisor(game.session_id);
      setAdvice(result);
      setGame(result.state);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const nextWeek = async () => {
    setBusy("next");
    setError(null);
    try {
      const result = await api.nextWeek(game.session_id);
      setSummary(result.summary);
      setGame(result.state);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const closeSummary = () => {
    setSummary(null);
    if (game?.is_game_over) setPhase("gameover");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const playAgain = () => {
    writeStorage("sessionStorage", SESSION_KEY, null);
    setGame(null);
    setSummary(null);
    setAdvice(null);
    setPhase("onboarding");
    window.scrollTo({ top: 0 });
  };

  const tradeCompany = game?.companies.find((c) => c.id === tradeCompanyId) ?? null;

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {phase === "onboarding" && (
        <Onboarding
          scenario={scenario}
          aiMode={aiMode}
          onStart={startGame}
          busy={busy === "start"}
        />
      )}

      {phase === "playing" && game && (
        <>
          <HudBar game={game} />
          <div className="game-layout">
            <ScenarioPanel game={game}>
              <AdvisorWidget
                advisor={game.advisor}
                advice={advice}
                currentWeek={game.current_week}
                busy={busy === "advisor"}
                onAsk={askAdvisor}
              />
            </ScenarioPanel>

            <main className="market" id="main-content">
              <header className="market__head">
                <div>
                  <p className="eyebrow eyebrow--red">
                    Week {game.current_week} / {game.total_weeks}
                    {game.scenario.week_theme ? ` · ${game.scenario.week_theme}` : ""}
                  </p>
                  <h2 className="market__title">What is the market saying?</h2>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHelpOpen(true)}>
                  How to play
                </button>
              </header>

              <div className="market__grid">
                <div className="market__main">
                  <StockChart
                    history={game.price_history}
                    companies={game.companies}
                    totalWeeks={game.total_weeks}
                    title="Stock market"
                    subtitle="Watch for moves that come weeks after the news."
                    height={210}
                  />
                  <CompanyCarousel
                    companies={game.companies}
                    onTrade={setTradeCompanyId}
                    disabled={busy === "next"}
                  />
                </div>
                <NewsSidebar week={game.current_week} news={game.news} />
              </div>

              <EndWeekBar game={game} busy={busy === "next"} onNextWeek={nextWeek} />
            </main>
          </div>

          {tradeCompany && (
            <TradeModal
              key={tradeCompany.id}
              company={tradeCompany}
              game={game}
              onClose={() => setTradeCompanyId(null)}
              onTrade={trade}
            />
          )}
          {summary && <WeekSummaryModal summary={summary} onContinue={closeSummary} />}
        </>
      )}

      {phase === "gameover" && game && <GameOverScreen game={game} onPlayAgain={playAgain} />}

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss message">
            &times;
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {!summary && !tradeCompany && (
        <button type="button" className="help-fab" onClick={() => setHelpOpen(true)} aria-label="How to play">
          ?
        </button>
      )}
      {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
