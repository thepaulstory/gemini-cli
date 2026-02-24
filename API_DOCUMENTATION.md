# Gemini CLI Comprehensive API Documentation

## 1. Overview
Gemini CLI is an open-source AI agent that brings the power of Gemini directly into your terminal. This document provides a comprehensive overview of the APIs available in the Gemini CLI ecosystem, including the Command Line Interface (CLI), the Agent-to-Agent (A2A) Server, and the core programmatic library.

### Architecture
The repository is structured as a monorepo:
- **`packages/cli`**: The main terminal-based application.
- **`packages/core`**: The engine and business logic, providing the programmatic API.
- **`packages/a2a-server`**: An HTTP server exposing the agent to other applications.

---

## 2. Authentication
Gemini CLI supports several authentication methods:

- **Login with Google (OAuth2)**: Best for individuals. Managed via browser flow.
- **Gemini API Key**: Best for specific model control. Set via `GEMINI_API_KEY`.
- **Vertex AI**: Best for enterprise/production. Set via `GOOGLE_CLOUD_PROJECT` and `GOOGLE_GENAI_USE_VERTEXAI=true`.

### Example Authentication Requests
For programmatic use in `@google/gemini-cli-core`:
```typescript
import { Config, AuthType } from '@google/gemini-cli-core';

const config = new Config({ ... });
await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
```

---

## 3. CLI API (Command Line Interface)

### Usage
```bash
gemini [options] [command]
```

### Global Options
| Flag | Alias | Type | Description |
|------|-------|------|-------------|
| `--model` | `-m` | string | Specific Gemini model to use (e.g., `gemini-2.5-pro`). |
| `--prompt` | `-p` | string | Run in non-interactive mode with the provided prompt. |
| `--sandbox` | `-s` | boolean | Run commands in a secure sandbox. |
| `--yolo` | `-y` | boolean | Automatically accept all tool actions. |
| `--output-format` | | string | Output format: `text` or `json`. |

### Subcommands

#### `mcp`
Manage Model Context Protocol (MCP) servers.
- `add <name> <commandOrUrl> [args...]`: Add an MCP server.
- `remove <name>`: Remove an MCP server.
- `list`: List configured MCP servers.

#### `extensions`
Manage Gemini CLI extensions.
- `install [source]`: Install an extension.
- `list`: List installed extensions.
- `uninstall <name>`: Remove an extension.

---

## 4. A2A Server HTTP API

The A2A server provides an HTTP interface following the Agent-to-Agent protocol.

- **Base URL**: `http://localhost:41242`

### Endpoints

#### Get Agent Card
**Method**: GET
**Path**: `/.well-known/agent-card.json`
**Description**: Returns the agent manifest.

#### Create Task
**Method**: POST
**Path**: `/tasks`
**Description**: Initializes a new task with settings.
**Request Body**:
```json
{
  "contextId": "project-id",
  "agentSettings": {
    "kind": "agent-settings",
    "workspacePath": "/abs/path"
  }
}
```

#### Send Message (A2A Standard)
**Method**: POST
**Path**: `/messages`
**Description**: Primary endpoint for interaction.

---

## 5. Core Library Programmatic API (`@google/gemini-cli-core`)

### `Config` Class
The central configuration object for the agent.
- `initialize()`: Asynchronously initializes the agent state, tools, and clients.
- `refreshAuth(authMethod: AuthType)`: Changes or refreshes the authentication method.
- `getGeminiClient()`: Returns the initialized `GeminiClient`.

### `GeminiClient` Class
Handles chat sessions and content generation.
- `sendMessageStream(request, signal, prompt_id)`: Sends a message and returns an async generator of events.
- `generateContent(contents, generationConfig, abortSignal, model)`: Direct content generation call.
- `tryCompressChat(prompt_id, force)`: Manages chat history compression to fit context windows.

---

## 6. Tool Development API

Gemini CLI is extensible through "Tools". Tools allow the agent to perform actions like reading files, running shell commands, or searching the web.

### `BaseTool` Class
All tools must extend `BaseTool`.
```typescript
class MyTool extends BaseTool {
  readonly name = 'my_tool';
  readonly description = 'What my tool does';
  readonly parameterSchema = { ... };

  async execute(args: MyArgs, signal?: AbortSignal): Promise<ToolResult> {
    // Implementation
  }
}
```

### Built-in Tools
- `ls`: List directory contents.
- `read_file`: Read a single file.
- `edit`: Modify parts of a file.
- `shell`: Execute shell commands.
- `web_fetch`: Fetch content from a URL.

---

## 7. Data Models / Schemas

### `Message`
```typescript
interface Message {
  kind: "message";
  role: "agent" | "user";
  messageId: string;
  parts: Part[];
}
```

### `Part`
```typescript
type Part = TextPart | DataPart | FilePart;
```

### `GeminiEventType`
Events yielded by `sendMessageStream`:
- `content`: Text content from the model.
- `tool_call_request`: Model wants to execute a tool.
- `error`: An error occurred.
- `thought`: Internal reasoning from the model.

---

## 8. Error Handling
- **HTTP Status Codes**: Used by A2A Server (400, 404, 500).
- **Structured JSON Errors**: Returned when `--output-format json` is used.
```json
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Invalid API Key"
  }
}
```

---

## 9. Rate Limiting
Governed by the underlying Gemini API. The CLI implements exponential backoff and automatic model fallback (e.g., from Pro to Flash) if quota is exceeded.

---

## 10. Webhooks
Not implemented in the current version of the A2A server.

---

## 11. SDKs & Libraries
- **`@google/gemini-cli-core`**: The primary library for embedding the agent in other JS/TS projects.
- **`@a2a-js/sdk`**: Used to build A2A compatible clients for the A2A server.

---

## 12. Changelog
- **v0.6.0-nightly**: Current development version.
- See [releases.md](./docs/releases.md) for full history.
