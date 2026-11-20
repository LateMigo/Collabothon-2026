"""Scenario recommendation engine (DAY-2 skeleton).

In the MVP there is exactly one scripted scenario, so the default recommender
always returns it. The abstract interface is the extension point for picking a
scenario that matches a player's risk profile and past results.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.data_loader import GameDataRepository


class ScenarioRecommender(ABC):
    @abstractmethod
    def recommend_scenario(self, risk_score: float, past_roi: float | None = None) -> str:
        """Return the id of the scenario that best fits the player.

        risk_score: 0.0 (very cautious) .. 1.0 (very bold), e.g. derived from PlayerMetrics.
        past_roi:   ROI % of the previous game, if any.
        """


class DefaultScenarioRecommender(ScenarioRecommender):
    def __init__(self, repo: GameDataRepository) -> None:
        self._default_id = repo.scenario.id

    def recommend_scenario(self, risk_score: float, past_roi: float | None = None) -> str:
        # DAY-2 HOOK: with several scenario files loaded, rank them by difficulty, e.g.
        #   - risk_score > 0.7 and past_roi < 0  -> a "slow and steady" dividend scenario
        #   - risk_score < 0.3                    -> a scenario that rewards diversification
        #   - past_roi > 15                       -> a harder scenario with more noise and longer lags
        # and/or ask the AIService to personalise the choice.
        return self._default_id
