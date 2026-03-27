"""Agent registry — CRUD operations backed by os_config table via NATS."""
import json
import time
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class AgentConfig:
    id: str = ""
    name: str = ""
    slug: str = ""
    voice_id: str = "Kore"
    language: str = "pt-BR"
    model: str = "gemini-3.1-flash-live-preview"
    system_prompt: str = ""
    flow_json: Optional[str] = None
    transport: str = "twilio"  # "twilio" | "webrtc"
    max_duration_sec: int = 600  # 10 min default
    max_concurrent: int = 3
    daily_budget_usd: float = 10.0
    status: str = "stopped"  # "stopped" | "running" | "error"
    created_at: str = ""
    updated_at: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "AgentConfig":
        return cls(**json.loads(data))


class AgentRegistry:
    """In-memory agent registry with NATS-based persistence to os_config table.

    Stores configs locally and syncs via NATS request to the DB service.
    For V1, uses in-memory dict with periodic NATS-backed persistence.
    """

    def __init__(self, nc):
        self._nc = nc
        self._agents: dict[str, AgentConfig] = {}
        self._daily_costs: dict[str, float] = {}  # slug -> cost today
        self._daily_reset_ts: float = 0.0

    async def load(self):
        """Load all agents from persistent storage via NATS."""
        try:
            # Request all hello.agent.* keys from os_config
            resp = await self._nc.request(
                "os.config.list",
                json.dumps({"prefix": "hello.agent."}).encode(),
                timeout=5.0
            )
            data = json.loads(resp.data)
            for item in data.get("items", []):
                try:
                    agent = AgentConfig.from_json(item["value"])
                    agent.status = "stopped"  # Reset status on load
                    self._agents[agent.slug] = agent
                except (KeyError, json.JSONDecodeError):
                    pass
        except Exception as e:
            print(f"[hello-voice] registry load failed (starting empty): {e}")

    async def save(self, agent: AgentConfig):
        """Persist agent config via NATS to os_config table."""
        agent.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if not agent.created_at:
            agent.created_at = agent.updated_at
        if not agent.id:
            agent.id = agent.slug

        self._agents[agent.slug] = agent
        try:
            await self._nc.publish(
                "os.config.set",
                json.dumps({
                    "key": f"hello.agent.{agent.slug}",
                    "value": agent.to_json()
                }).encode()
            )
        except Exception as e:
            print(f"[hello-voice] failed to persist agent {agent.slug}: {e}")

    async def delete(self, slug: str) -> bool:
        if slug not in self._agents:
            return False
        del self._agents[slug]
        try:
            await self._nc.publish(
                "os.config.delete",
                json.dumps({"key": f"hello.agent.{slug}"}).encode()
            )
        except Exception as e:
            print(f"[hello-voice] failed to delete agent {slug}: {e}")
        return True

    def get(self, slug: str) -> Optional[AgentConfig]:
        return self._agents.get(slug)

    def list_all(self) -> list[AgentConfig]:
        return list(self._agents.values())

    def check_budget(self, slug: str) -> bool:
        """Check if agent is within daily budget."""
        self._maybe_reset_daily()
        agent = self._agents.get(slug)
        if not agent:
            return False
        cost = self._daily_costs.get(slug, 0.0)
        return cost < agent.daily_budget_usd

    def add_cost(self, slug: str, amount: float):
        """Track cost for an agent."""
        self._maybe_reset_daily()
        self._daily_costs[slug] = self._daily_costs.get(slug, 0.0) + amount

    def get_cost(self, slug: str) -> float:
        self._maybe_reset_daily()
        return self._daily_costs.get(slug, 0.0)

    def _maybe_reset_daily(self):
        now = time.time()
        if now - self._daily_reset_ts > 86400:
            self._daily_costs.clear()
            self._daily_reset_ts = now
