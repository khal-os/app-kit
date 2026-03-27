"""Pipecat Flows integration — loads JSON flows and manages state transitions."""
import json
import os
from typing import Optional


class HelloFlowManager:
    """Manages voice conversation flows from JSON definitions.

    Loads flow JSON exported from pipecat-flows-editor.
    Each flow has nodes (states) with functions, pre_actions, and post_actions.
    Transitions happen via function calls within the conversation.
    """

    def __init__(self, nc, agent_id: str):
        self._nc = nc
        self._agent_id = agent_id
        self._flow: Optional[dict] = None
        self._current_node: Optional[str] = None
        self._nodes: dict = {}

    def load_from_file(self, path: str) -> bool:
        """Load a flow from a JSON file."""
        if not os.path.exists(path):
            print(f"[hello-voice] flow file not found: {path}")
            return False

        with open(path, 'r') as f:
            return self.load(json.load(f))

    def load(self, flow_data: dict) -> bool:
        """Load a flow from a dict (parsed JSON)."""
        self._flow = flow_data
        self._nodes = {}

        nodes = flow_data.get("nodes", [])
        for node in nodes:
            node_id = node.get("id")
            if node_id:
                self._nodes[node_id] = node

        # Find initial node
        initial = flow_data.get("initial_node") or flow_data.get("initialNode")
        if not initial and nodes:
            initial = nodes[0].get("id")

        self._current_node = initial
        print(f"[hello-voice] flow loaded: {len(self._nodes)} nodes, initial: {initial}")
        return True

    @property
    def current_node(self) -> Optional[str]:
        return self._current_node

    @property
    def current_node_data(self) -> Optional[dict]:
        if self._current_node:
            return self._nodes.get(self._current_node)
        return None

    def get_functions(self) -> list:
        """Get available functions for the current node."""
        node = self.current_node_data
        if not node:
            return []

        data = node.get("data", {})
        return data.get("functions", [])

    def get_prompt(self) -> str:
        """Get the system prompt for the current node."""
        node = self.current_node_data
        if not node:
            return ""

        data = node.get("data", {})
        return data.get("task_messages", [{}])[0].get("content", "") if data.get("task_messages") else ""

    async def transition(self, node_id: str) -> bool:
        """Transition to a new flow node."""
        if node_id not in self._nodes:
            print(f"[hello-voice] flow transition failed: node '{node_id}' not found")
            return False

        old_node = self._current_node
        self._current_node = node_id

        # Publish flow transition event
        event = {
            "from_node": old_node,
            "to_node": node_id,
            "functions": self.get_functions(),
        }
        await self._nc.publish(
            f"hello.{self._agent_id}.event.flow_transition",
            json.dumps(event).encode()
        )

        print(f"[hello-voice] flow transition: {old_node} → {node_id}")
        return True

    async def handle_function_call(self, function_name: str, args: dict) -> Optional[str]:
        """Handle a function call that may trigger a flow transition.

        Returns the next node ID if a transition should happen, None otherwise.
        """
        node = self.current_node_data
        if not node:
            return None

        data = node.get("data", {})
        functions = data.get("functions", [])

        for func in functions:
            if func.get("name") == function_name:
                # Check if this function triggers a transition
                transition = func.get("transition_to") or func.get("transitionTo")
                if transition:
                    await self.transition(transition)
                    return transition

        return None
