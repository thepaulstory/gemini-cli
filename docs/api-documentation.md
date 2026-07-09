# Gemini CLI A2A Server API Documentation

## 1. Overview
The Gemini CLI A2A (Agent-to-Agent) Server provides an HTTP interface for interacting with the Gemini SDLC Agent. It allows other agents or applications to create tasks, send messages, and receive structured responses and streaming updates from the agent.

- **API Purpose**: Enable agentic workflows and tool-use capabilities over HTTP.
- **Base URL**: `http://localhost:41242` (default, configurable via `CODER_AGENT_PORT`)
- **Authentication**: Authentication is handled via standard Gemini CLI methods (OAuth, API Key, or Vertex AI). The A2A server itself does not add a separate layer of authentication by default for local execution.
- **Rate Limits**: Governed by the underlying Gemini API quota.
- **API Version**: 0.6.0-nightly

## 2. Authentication
The server uses the authentication configuration of the Gemini CLI.

- **How to authenticate**: Set the required environment variables before starting the server.
    - `GEMINI_API_KEY`: For Google AI Studio access.
    - `GOOGLE_CLOUD_PROJECT`: For Vertex AI or Code Assist License access.
- **Security Considerations**: The server is designed for local or trusted network use. In production environments, it should be behind a secure proxy with proper authentication.

## 3. Endpoints

### Get Agent Card
**Method**: GET
**Path**: `/.well-known/agent-card.json`
**Description**: Retrieves the agent's manifest, including its name, description, capabilities, and skills.

**Authentication Required**: No

**Response**:
- Status Code: 200 OK
```json
{
  "name": "Gemini SDLC Agent",
  "description": "An agent that generates code...",
  "url": "http://localhost:41242/",
  "version": "0.0.2",
  "capabilities": { "streaming": true, "pushNotifications": false, "stateTransitionHistory": true },
  "skills": [ ... ]
}
```

---

### Create Task (Custom)
**Method**: POST
**Path**: `/tasks`
**Description**: Creates a new task with specific agent settings, such as the workspace path.

**Authentication Required**: No

**Request Body**:
```json
{
  "contextId": "my-project-context",
  "agentSettings": {
    "kind": "agent-settings",
    "workspacePath": "/path/to/workspace"
  }
}
```

**Response**:
- Status Code: 201 Created
```json
"uuid-task-id"
```

---

### List All Tasks Metadata (Custom)
**Method**: GET
**Path**: `/tasks/metadata`
**Description**: Returns metadata for all currently managed tasks. Only supported when using `InMemoryTaskStore`.

**Authentication Required**: No

**Response**:
- Status Code: 200 OK
```json
[
  {
    "id": "taskId",
    "contextId": "contextId",
    "taskState": "working",
    "model": "gemini-2.5-pro",
    "mcpServers": [],
    "availableTools": []
  }
]
```

---

### Get Task Metadata (Custom)
**Method**: GET
**Path**: `/tasks/:taskId/metadata`
**Description**: Returns metadata for a specific task.

**Authentication Required**: No

**Response**:
- Status Code: 200 OK
```json
{
  "metadata": {
    "id": "taskId",
    "contextId": "contextId",
    "taskState": "input-required",
    "model": "gemini-2.5-pro",
    ...
  }
}
```

---

### Send Message (A2A Standard)
**Method**: POST
**Path**: `/messages`
**Description**: Sends a message to the agent. This is the primary way to interact with the agent.

**Authentication Required**: No

**Request Body**:
```json
{
  "message": {
    "kind": "message",
    "role": "user",
    "messageId": "msg-1",
    "parts": [
      { "kind": "text", "text": "Create a python script to calculate pi." }
    ]
  }
}
```

**Response**:
- Status Code: 200 OK
```json
{
  "kind": "message",
  "role": "agent",
  "messageId": "msg-2",
  "parts": [ ... ]
}
```

---

## 4. Data Models / Schemas

### AgentSettings
```typescript
interface AgentSettings {
  kind: 'agent-settings';
  workspacePath: string;
}
```

### TaskMetadata
```typescript
interface TaskMetadata {
  id: string;
  contextId: string;
  taskState: TaskState;
  model: string;
  mcpServers: Array<{
    name: string;
    status: MCPServerStatus;
    tools: Array<{
      name: string;
      description: string;
      parameterSchema: unknown;
    }>;
  }>;
  availableTools: Array<{
    name: string;
    description: string;
    parameterSchema: unknown;
  }>;
}
```

### Message
```typescript
interface Message {
  kind: "message";
  role: "agent" | "user";
  messageId: string;
  taskId?: string;
  contextId?: string;
  parts: Part[];
}
```

### Part
```typescript
type Part = TextPart | DataPart | FilePart;

interface TextPart {
  kind: "text";
  text: string;
}

interface DataPart {
  kind: "data";
  data: Record<string, unknown>;
}
```

## 5. Error Handling
The API uses standard HTTP status codes:
- **400 Bad Request**: Invalid input or missing parameters.
- **404 Not Found**: Task or resource does not exist.
- **500 Internal Server Error**: An unexpected error occurred on the server.
- **501 Not Implemented**: The requested feature (like listing metadata) is not supported by the current configuration.

Error Response Format:
```json
{
  "error": "Error message description"
}
```

## 6. Code Examples

### cURL
```bash
# Create a task
curl -X POST http://localhost:41242/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "contextId": "example-context",
    "agentSettings": {
      "kind": "agent-settings",
      "workspacePath": "/tmp/test"
    }
  }'

# Get agent card
curl http://localhost:41242/.well-known/agent-card.json
```

### Python
```python
import requests

base_url = "http://localhost:41242"

def create_task(workspace_path):
    response = requests.post(f"{base_url}/tasks", json={
        "agentSettings": {
            "kind": "agent-settings",
            "workspacePath": workspace_path
        }
    })
    return response.json()

task_id = create_task("/tmp/my-project")
print(f"Created task: {task_id}")
```

## 7. Pagination
Currently, the `a2a-server` custom endpoints do not implement pagination. All results are returned in a single response.

## 8. Filtering & Sorting
Not implemented in the current version.

## 9. Rate Limiting
Rate limiting is determined by the Gemini API quotas associated with your authentication method.
