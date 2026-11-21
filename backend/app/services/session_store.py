"""Session repository abstraction.

The engine only talks to the `SessionStore` interface. The MVP ships an
in-memory implementation that stores *serialized JSON* (not live objects), so
it behaves exactly like a networked store would: every `get` returns a fresh
copy and every change must be persisted with `save`. Swapping in Redis or
PostgreSQL is a matter of implementing the same five methods.
"""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from contextlib import AbstractAsyncContextManager

from app.models.schemas import GameSession


class SessionStore(ABC):
    """Persistence contract for game sessions."""

    @abstractmethod
    async def get(self, session_id: str) -> GameSession | None: ...

    @abstractmethod
    async def save(self, session: GameSession) -> None: ...

    @abstractmethod
    async def delete(self, session_id: str) -> None: ...

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    def lock(self, session_id: str) -> AbstractAsyncContextManager:
        """Per-session mutex so double-clicks can't process the same week twice."""


class InMemorySessionStore(SessionStore):
    def __init__(self, ttl_minutes: int = 240, max_sessions: int = 500) -> None:
        self._ttl_seconds = max(ttl_minutes, 1) * 60
        self._max_sessions = max(max_sessions, 1)
        self._data: OrderedDict[str, tuple[float, str]] = OrderedDict()
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, session_id: str) -> GameSession | None:
        self._purge_expired()
        entry = self._data.get(session_id)
        if entry is None:
            return None
        self._data.move_to_end(session_id)
        return GameSession.model_validate_json(entry[1])

    async def save(self, session: GameSession) -> None:
        self._data[session.session_id] = (time.monotonic(), session.model_dump_json())
        self._data.move_to_end(session.session_id)
        self._purge_expired()
        while len(self._data) > self._max_sessions:
            evicted_id, _ = self._data.popitem(last=False)
            self._locks.pop(evicted_id, None)

    async def delete(self, session_id: str) -> None:
        self._data.pop(session_id, None)
        self._locks.pop(session_id, None)

    async def count(self) -> int:
        self._purge_expired()
        return len(self._data)

    def lock(self, session_id: str) -> asyncio.Lock:
        lock = self._locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[session_id] = lock
        return lock

    def _purge_expired(self) -> None:
        now = time.monotonic()
        expired = [sid for sid, (saved_at, _) in self._data.items() if now - saved_at > self._ttl_seconds]
        for sid in expired:
            self._data.pop(sid, None)
            self._locks.pop(sid, None)

