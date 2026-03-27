"""Gemini 3.1 Flash Live configuration for speech-to-speech."""
import os
from pipecat.services.google import GeminiLiveLLMService


def create_gemini_live(
    voice_id: str = "Kore",
    language: str = "pt-BR",
    system_prompt: str = "",
    temperature: float = 0.7,
) -> GeminiLiveLLMService:
    """Create a Gemini Live LLM service for speech-to-speech.

    Replaces the entire STT+LLM+TTS chain with native speech-to-speech.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is required")

    from pipecat.services.google import InputParams, GeminiLiveTranscriptionSettings, TranscriptionSettings

    llm = GeminiLiveLLMService(
        model="gemini-3.1-flash-live-preview",
        voice_id=voice_id,
        api_key=api_key,
        system_instruction=system_prompt or f"You are a helpful voice assistant. Speak in {language}. Be concise and natural.",
        params=InputParams(
            language=language,
            temperature=temperature,
        ),
        transcription_settings=GeminiLiveTranscriptionSettings(
            input_transcription_settings=TranscriptionSettings(),
            output_transcription_settings=TranscriptionSettings(),
        ),
    )

    return llm


def validate_config() -> dict:
    """Validate Gemini configuration."""
    if not os.environ.get("GEMINI_API_KEY"):
        return {"valid": False, "issues": ["GEMINI_API_KEY not set"]}
    return {"valid": True, "message": "Gemini config valid"}
