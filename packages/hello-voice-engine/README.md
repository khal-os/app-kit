# HELLO Voice Engine

Pipecat-powered voice pipeline for KhalOS. Places outbound calls, processes speech with Gemini 3.1 Flash Live, and streams transcripts via NATS.

## Quick Start

### 1. Set up environment
```bash
cp .env.example .env
# Fill in GEMINI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
```

### 2. Install dependencies
```bash
cd packages/hello-voice-engine
uv sync
```

### 3. Start the engine
```bash
uv run bridge.py
# Or via service-loader (auto-discovered):
# pm2 start ecosystem.config.cjs
```

### 4. Create and start an agent
```bash
khal-os hello agents create --name test-agent --voice Kore --lang pt-BR
khal-os hello agents start test-agent
```

### 5. Place a call
```bash
khal-os hello call "+5511999999999" --agent test-agent
```

### 6. Monitor live transcript
```bash
khal-os hello monitor --agent test-agent
```

## Architecture

```
Browser ↔ WebRTC ↔ Voice Engine ↔ NATS ↔ KhalOS
Phone   ↔ Twilio ↔ Voice Engine ↔ NATS ↔ CLI
```

- **Transport**: Twilio (phone) or WebRTC (browser)
- **Voice Model**: Gemini 3.1 Flash Live (speech-to-speech)
- **Orchestration**: NATS subjects (events + commands)
- **Flows**: Pipecat FlowManager with JSON state machines

## CLI Commands

| Command | Description |
|---------|-------------|
| `khal-os hello call <number> --agent <slug>` | Place outbound call |
| `khal-os hello monitor --agent <slug>` | Stream live transcript |
| `khal-os hello inject <text> --agent <slug>` | Inject context mid-call |
| `khal-os hello transfer <number> --agent <slug>` | Transfer call |
| `khal-os hello hangup --agent <slug>` | End call |
| `khal-os hello dtmf <digits> --agent <slug>` | Send DTMF |
| `khal-os hello agents list` | List agents |
| `khal-os hello agents create --name <n>` | Create agent |
| `khal-os hello agents start/stop <slug>` | Start/stop agent |

## NATS Subjects

### Events (engine → subscribers)
- `hello.{agentId}.event.user_speech` — User transcription
- `hello.{agentId}.event.agent_spoke` — Agent response
- `hello.{agentId}.event.tool_call` — Function call
- `hello.{agentId}.event.call_state` — Call lifecycle

### Commands (any → engine)
- `hello.{agentId}.cmd.inject_context` — Add context
- `hello.{agentId}.cmd.speak` — Force speech
- `hello.{agentId}.cmd.transfer` — Transfer call
- `hello.{agentId}.cmd.end_call` — End call
- `hello.{agentId}.cmd.send_dtmf` — Send DTMF

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `TWILIO_ACCOUNT_SID` | For calls | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | For calls | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | For calls | Twilio phone number (E.164) |
| `HELLO_WS_PUBLIC_URL` | For calls | Public WebSocket URL for Twilio callbacks (e.g., `wss://example.ngrok.io`) |
| `HELLO_VOICE_PORT` | No | FastAPI server port (default: 7860) |
| `NATS_URL` | No | NATS server URL (default: localhost:4222) |
