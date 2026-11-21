import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client.js";
import AdvisorWidget from "./components/AdvisorWidget.jsx";
import CompanyCarousel from "./components/CompanyCarousel.jsx";
import FixedIncomeModal from "./components/FixedIncomeModal.jsx";
import FixedIncomePanel from "./components/FixedIncomePanel.jsx";
import GameOverScreen from "./components/GameOverScreen.jsx";
import HoldingsPanel from "./components/HoldingsPanel.jsx";
import GuidedTour from "./components/GuidedTour.jsx";
import HowToPlay from "./components/HowToPlay.jsx";
import HudBar from "./components/HudBar.jsx";
import KpiDashboard from "./components/KpiDashboard.jsx";
import LearnModal from "./components/LearnModal.jsx";
import LessonNudge, { pickNudge } from "./components/LessonNudge.jsx";
import { readAiPrefs } from "./utils/aiPrefs.js";
import { readQuizScore } from "./utils/quiz.js";
import LexoPanel from "./components/LexoPanel.jsx";
import NewsBoard from "./components/NewsBoard.jsx";
import NewsSidebar from "./components/NewsSidebar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import RentAlertModal from "./components/RentAlertModal.jsx";
import SavingsModal from "./components/SavingsModal.jsx";
import SavingsPanel from "./components/SavingsPanel.jsx";
import ScenarioPanel from "./components/ScenarioPanel.jsx";
import StockChart from "./components/StockChart.jsx";
import TradeModal from "./components/TradeModal.jsx";
import WeekSummaryModal from "./components/WeekSummaryModal.jsx";
import { money, moneyCompact, readStorage, rentCheck, writeStorage } from "./utils/format.js";
import { LESSONS, readLessonsDone } from "./utils/lessons.js";

const SESSION_KEY = "fq.sessionId";
const TOUR_KEY = "fq.tourDone";

function weekEndText(game, check) {
  const { rent } = game;
  const parts = ["the market reacts to the news"];
  const payers = game.companies.filter((c) => c.pays_dividend_this_week && c.shares_owned > 0);
  if (game.modifiers.enable_dividends && payers.length) {
    parts.push(`${payers.map((c) => c.ticker).join(", ")} pay${payers.length === 1 ? "s" : ""} you a dividend`);
  }
  if (game.savings.balance > 0) parts.push("your savings earn interest");
  if (game.fixed_income.total_value > 0) parts.push("your bonds and deposits earn interest");
  const maturing = game.fixed_income.maturing_this_week;
  if (maturing > 0) parts.push(`${money(maturing)} comes back from bonds or deposits that mature`);
  if (check.dueNow) parts.push(`${moneyCompact(rent.monthly_rent)} rent is collected`);
  const last = parts.pop();
  return parts.length ? `${parts.join(", ")} and ${last}` : last;
}

function EndWeekBar({ game, busy, onEndWeek }) {
  const { rent, current_week: week, total_weeks: total } = game;
  const [open, setOpen] = useState(false);
  const check = rentCheck(game);
  const lastWeek = week === total;
  const label = busy ? "The market is reacting…" : lastWeek ? "Finish the season" : `End Week ${week}`;

  return (
    <div className={`action-bar ${check.short ? "action-bar--danger" : ""}`}>
      {open && (
        <div className="action-bar__details" id="week-end-details">
          {check.short ? (
            <p>
              <strong>Rent of {moneyCompact(rent.monthly_rent)} is due at the end of this week</strong>, but you can
              only count on {money(check.ready)} (cash, savings and bonds that pay back now)
              {check.onlyIfDividends
                ? ` - plus about ${money(check.dividends)} of dividends, if the news doesn't cut them`
                : ""}
              . Sell some shares or cash out a deposit first &mdash; or the game may end.
            </p>
          ) : (
            <p>When you end the week, {weekEndText(game, check)}.</p>
          )}
        </div>
      )}
      <div className="action-bar__row">
        <button
          type="button"
          className="action-bar__info"
          aria-expanded={open}
          aria-controls="week-end-details"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="action-bar__week">{lastWeek ? "Final week" : `Week ${week}/${total}`}</span>
          <span className="action-bar__summary" role={check.short ? "alert" : undefined}>
            {check.short ? "Rent alert: not enough money for the rent" : `Next: ${weekEndText(game, check)}`}
          </span>
          <span className="action-bar__more" aria-hidden="true">
            {open ? "Hide ▼" : "Details ▲"}
          </span>
        </button>
        <button
          type="button"
          className={`btn btn--red end-week-btn ${check.short ? "end-week-btn--danger" : ""}`}
          onClick={onEndWeek}
          disabled={busy}
        >
          <span>{label}</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("onboarding");
  const [game, setGame] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tradeCompanyId, setTradeCompanyId] = useState(null);
  const [savingsMode, setSavingsMode] = useState(null);
  const [bondsOpen, setBondsOpen] = useState(false);
  const [rentAlertOpen, setRentAlertOpen] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnLesson, setLearnLesson] = useState(null);
  const [nudge, setNudge] = useState(null);
  const nudged = useRef([]);
  const dismissNudge = useCallback(() => setNudge(null), []);
  const openLearn = (lessonId = null) => {
    setNudge(null);
    setLearnLesson(lessonId);
    setLearnOpen(true);
  };
  const [lessonsDone, setLessonsDone] = useState(() => readLessonsDone().length);
  const [bankView, setBankView] = useState(() => window.location.hash === "#bank");
  useEffect(() => {
    const onHash = () => setBankView(window.location.hash === "#bank");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [scenario, setScenario] = useState(null);
  const [aiMode, setAiMode] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    api.scenario().then(setScenario).catch(() => {});
    api
      .health()
      .then((health) => setAiMode(health.ai_mode))
      .catch((err) => setError(err.message));
  }, []);

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
    toastTimer.current = setTimeout(() => setToast(null), 4500);
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

  const startGame = async (config, challenge = null) => {
    setBusy("start");
    setError(null);
    try {
      const state = await api.createSession(config);
      if (challenge) {
        api.kpiEvent({ event: "challenge_joined", session_id: state.session_id });
        window.history.replaceState(null, "", window.location.pathname);
      }
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

  const trade = async (companyId, action, shares, reason = null) => {
    const result = await api.trade(game.session_id, {
      company_id: companyId,
      action,
      shares,
      ...(reason ? { reason } : {}),
    });
    setGame(result.state);
    showToast(result.message);
    return result;
  };

  const moveSavings = async (action, amount) => {
    const result = await api.savings(game.session_id, { action, amount });
    setGame(result.state);
    showToast(result.message);
    return result;
  };

  const fixedIncome = async (payload) => {
    const result = await api.fixedIncome(game.session_id, payload);
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
    setRentAlertOpen(false);
    setBusy("next");
    setError(null);
    try {
      const result = await api.nextWeek(game.session_id, readAiPrefs());
      setSummary(result.summary);
      setGame(result.state);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const endWeek = () => {
    if (rentCheck(game).short) setRentAlertOpen(true);
    else nextWeek();
  };

  const closeSummary = () => {
    if (summary && !game?.is_game_over) {
      const pick = pickNudge(summary, readQuizScore(game.session_id), readLessonsDone(), nudged.current);
      if (pick) {
        nudged.current = [...nudged.current, pick.lessonId];
        setNudge(pick);
      }
    }
    setSummary(null);
    if (game?.is_game_over) setPhase("gameover");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToMenu = () => {
    setTradeCompanyId(null);
    setSavingsMode(null);
    setBondsOpen(false);
    setRentAlertOpen(false);
    setPhase("onboarding");
    window.scrollTo({ top: 0 });
  };

  const resumeGame = () => {
    setPhase(game?.is_game_over ? "gameover" : "playing");
    window.scrollTo({ top: 0 });
  };

  const playAgain = () => {
    writeStorage("sessionStorage", SESSION_KEY, null);
    setGame(null);
    setSummary(null);
    setSavingsMode(null);
    setBondsOpen(false);
    setAdvice(null);
    setPhase("onboarding");
    window.scrollTo({ top: 0 });
  };

  const tradeCompany = game?.companies.find((c) => c.id === tradeCompanyId) ?? null;
  const anyModal = summary || tradeCompany || savingsMode || bondsOpen || rentAlertOpen;

  const inFirstWeek = phase === "playing" && game?.current_week === 1 && !game?.is_game_over;
  useEffect(() => {
    if (inFirstWeek && !anyModal && !helpOpen && !readStorage("localStorage", TOUR_KEY)) setTourOpen(true);
  }, [inFirstWeek, anyModal, helpOpen]);

  const closeTour = () => {
    writeStorage("localStorage", TOUR_KEY, "1");
    setTourOpen(false);
  };

  if (bankView) {
    return (
      <div className="app">
        <KpiDashboard onExit={() => (window.location.hash = "")} />
      </div>
    );
  }

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
          savedGame={game}
          onResume={resumeGame}
        />
      )}

      {phase === "playing" && game && (
        <>
          <HudBar game={game} onMenu={goToMenu} />
          <div className="game-layout">
            <ScenarioPanel game={game}>
              <SavingsPanel game={game} onOpen={setSavingsMode} disabled={busy === "next"} />
              <FixedIncomePanel game={game} onOpen={() => setBondsOpen(true)} disabled={busy === "next"} />
              <AdvisorWidget
                advisor={game.advisor}
                advice={advice}
                currentWeek={game.current_week}
                busy={busy === "advisor"}
                onAsk={askAdvisor}
                companies={game.companies}
                onResearch={(companyId, prefs) => api.research(game.session_id, companyId, prefs)}
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
                <span className="market__help">
                  <button type="button" className="btn btn--yellow btn--sm" onClick={() => openLearn()}>
                    Learn &middot; {lessonsDone}/{LESSONS.length}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTourOpen(true)}>
                    Quick tour
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHelpOpen(true)}>
                    How to play
                  </button>
                </span>
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
                    currentWeek={game.current_week}
                    riskScale={game.risk_scale}
                    onTrade={setTradeCompanyId}
                    disabled={busy === "next"}
                  />
                  <NewsBoard archive={game.news_archive ?? []} currentWeek={game.current_week} />
                </div>
                <div className="market__side">
                  <NewsSidebar week={game.current_week} news={game.news} />
                  <HoldingsPanel
                    game={game}
                    onTrade={setTradeCompanyId}
                    onOpenBonds={() => setBondsOpen(true)}
                    disabled={busy === "next"}
                  />
                  <LexoPanel onAsk={api.askLexo} />
                </div>
              </div>

              <EndWeekBar game={game} busy={busy === "next"} onEndWeek={endWeek} />
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
          {savingsMode && (
            <SavingsModal
              key={savingsMode}
              game={game}
              initialMode={savingsMode}
              onClose={() => setSavingsMode(null)}
              onSubmit={moveSavings}
            />
          )}
          {bondsOpen && <FixedIncomeModal game={game} onClose={() => setBondsOpen(false)} onSubmit={fixedIncome} />}
          {rentAlertOpen && (
            <RentAlertModal
              game={game}
              onClose={() => setRentAlertOpen(false)}
              onEndAnyway={nextWeek}
              onSell={(companyId) => {
                setRentAlertOpen(false);
                setTradeCompanyId(companyId);
              }}
              onOpenBonds={() => {
                setRentAlertOpen(false);
                setBondsOpen(true);
              }}
            />
          )}
          {summary && <WeekSummaryModal summary={summary} sessionId={game.session_id} onContinue={closeSummary} />}
          {!summary && !learnOpen && <LessonNudge nudge={nudge} onOpen={openLearn} onDismiss={dismissNudge} />}
          {learnOpen && (
            <LearnModal
              sessionId={game.session_id}
              initialLesson={learnLesson}
              onClose={() => setLearnOpen(false)}
              onProgress={setLessonsDone}
            />
          )}
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

      {!anyModal && (
        <button type="button" className="help-fab" onClick={() => setHelpOpen(true)} aria-label="How to play">
          ?
        </button>
      )}
      {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}
      {tourOpen && phase === "playing" && game && <GuidedTour onClose={closeTour} />}
    </div>
  );
}
