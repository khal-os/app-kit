"""Agent lifecycle — spawn/kill voice pipelines in isolated processes."""
import asyncio
import time
from typing import Optional
from .registry import AgentRegistry, AgentConfig


class AgentProcess:
    """Tracks a running agent pipeline."""

    def __init__(self, agent: AgentConfig):
        self.agent = agent
        self.started_at = time.time()
        self.task: Optional[asyncio.Task] = None
        self.call_count = 0


class AgentLifecycle:
    """Manages agent pipeline processes."""

    def __init__(self, registry: AgentRegistry):
        self._registry = registry
        self._running: dict[str, AgentProcess] = {}

    @property
    def running_count(self) -> int:
        return len(self._running)

    def is_running(self, slug: str) -> bool:
        return slug in self._running

    def get_process(self, slug: str) -> Optional[AgentProcess]:
        return self._running.get(slug)

    async def start(self, slug: str) -> tuple[bool, str]:
        """Start an agent pipeline."""
        agent = self._registry.get(slug)
        if not agent:
            return False, f"Agent '{slug}' not found"

        if slug in self._running:
            return False, f"Agent '{slug}' is already running"

        # Check concurrent limit
        if self.running_count >= agent.max_concurrent:
            return False, f"Max concurrent agents ({agent.max_concurrent}) reached"

        # Check budget
        if not self._registry.check_budget(slug):
            return False, f"Daily budget exceeded for agent '{slug}'"

        proc = AgentProcess(agent)
        self._running[slug] = proc
        agent.status = "running"
        await self._registry.save(agent)

        print(f"[hello-voice] agent '{slug}' started")
        return True, "started"

    async def stop(self, slug: str) -> tuple[bool, str]:
        """Stop an agent pipeline."""
        if slug not in self._running:
            return False, f"Agent '{slug}' is not running"

        proc = self._running.pop(slug)
        if proc.task and not proc.task.done():
            proc.task.cancel()

        agent = self._registry.get(slug)
        if agent:
            agent.status = "stopped"
            await self._registry.save(agent)

        # Calculate duration-based cost
        duration_min = (time.time() - proc.started_at) / 60
        cost = duration_min * 0.023  # Gemini rate per minute
        self._registry.add_cost(slug, cost)

        print(f"[hello-voice] agent '{slug}' stopped (duration: {duration_min:.1f}min, cost: ${cost:.4f})")
        return True, "stopped"

    async def stop_all(self):
        """Stop all running agents."""
        slugs = list(self._running.keys())
        for slug in slugs:
            await self.stop(slug)

    def check_duration_limits(self):
        """Check for agents exceeding max_duration. Returns list of expired slugs."""
        expired = []
        now = time.time()
        for slug, proc in self._running.items():
            elapsed = now - proc.started_at
            if elapsed > proc.agent.max_duration_sec:
                expired.append(slug)
        return expired
