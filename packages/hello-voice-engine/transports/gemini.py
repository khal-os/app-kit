"""GeminiLiveLLMService configuration for HELLO voice engine.

Gemini Live replaces the entire STT+LLM+TTS chain with native speech-to-speech.
Handles audio conversion, transcription, function calling, and voice synthesis
in a single model (~200-350ms first-token latency, $0.023/min).
"""
import os

from agents.registry import AgentConfig


def create_gemini_live(agent: AgentConfig):
    """Create a configured GeminiLiveLLMService for the given agent."""
    from pipecat.services.google import GeminiLiveLLMService

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is required")

    kwargs = dict(
        api_key=api_key,
        model=agent.model,
        voice_id=agent.voice_id,
        system_instruction=agent.system_prompt or _default_prompt(agent.language),
    )

    # Enable both input and output transcription for co-pilot feed
    try:
        from pipecat.services.google import (
            GeminiLiveTranscriptionSettings,
            TranscriptionSettings,
        )
        kwargs["transcription_settings"] = GeminiLiveTranscriptionSettings(
            input_transcription_settings=TranscriptionSettings(),
            output_transcription_settings=TranscriptionSettings(),
        )
    except ImportError:
        pass

    # Set language and temperature via InputParams
    try:
        from pipecat.services.google import InputParams
        kwargs["params"] = InputParams(
            language=agent.language,
            temperature=0.7,
        )
    except ImportError:
        pass

    return GeminiLiveLLMService(**kwargs)


def validate_config() -> list[str]:
    """Check Gemini configuration without creating a service."""
    errors = []
    if not os.environ.get("GEMINI_API_KEY"):
        errors.append("GEMINI_API_KEY not set")
    return errors


def _default_prompt(language: str) -> str:
    if language.startswith("pt"):
        return (
            "Você é um assistente de voz prestativo e profissional. "
            "Fale em português do Brasil de forma clara e natural."
        )
    return "You are a helpful and professional voice assistant."
