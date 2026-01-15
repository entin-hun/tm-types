# Trace Market Types MCP Server

This MCP server provides intelligent type management and data validation for the Trace Market food supply chain platform.

## Features

### For Authenticated Users (Admin/User Role)
- **Create types from natural language**: Describe a type in plain English and get TypeScript definitions
- **Add/modify type definitions**: Directly add or update TypeScript type definitions
- **Track changes**: All type modifications are version controlled

### For All Users (Including Anonymous)
- **List types**: Browse all available type definitions
- **Get type details**: View detailed field information for any type
- **Validate data**: Check if data conforms to type specifications
- **Query data**: Filter and search based on type structure
- **Generate reports**: Create custom reports in JSON, Markdown, or HTML

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

1. Copy `.env.example` to `.env`
2. Set `JWT_SECRET` to a secure random string
3. (Optional) Configure database URL for data persistence
4. (Optional) Add LLM API keys for better natural language processing

## Authentication

Generate a JWT token for authenticated operations:

```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'user123', role: 'user' }, // or role: 'admin'
  'your-jwt-secret',
  { expiresIn: '24h' }
);
```

To avoid pasting the token on every call in local/dev, you can set `DEFAULT_AUTH_TOKEN` in the MCP server environment; when a tool call omits `authToken`, the server will fall back to this value. Keep this disabled in shared or production environments.

## MCP Tools

### `list_types`
List all available type definitions with optional filtering.
- **Auth required**: No
- **Parameters**:
  - `filter` (optional): Search string to filter type names

### `get_type_definition`
Get detailed definition of a specific type.
- **Auth required**: No
- **Parameters**:
  - `typeName` (required): Name of the type

### `validate_data`
Validate data against a type definition.
- **Auth required**: No
- **Parameters**:
  - `typeName` (required): Type to validate against
  - `data` (required): Data object to validate

### `create_type_from_description`
Generate TypeScript type from natural language description.
- **Auth required**: Yes (user or admin)
- **Parameters**:
  - `description` (required): Natural language description
  - `authToken` (required): JWT authentication token

### `add_type_definition`
Add a new type definition to the repository.
- **Auth required**: Yes (user or admin)
- **Parameters**:
  - `typeDefinition` (required): TypeScript code
  - `authToken` (required): JWT authentication token

### `query_data`
Query and filter data based on type structure.
- **Auth required**: No
- **Parameters**:
  - `typeName` (required): Type to query
  - `query` (optional): Query filters

### `generate_report`
Generate custom reports from type data.
- **Auth required**: No
- **Parameters**:
  - `reportType` (required): 'summary', 'detailed', or 'impact'
  - `data` (required): Data to include in report
  - `format` (optional): 'json', 'markdown', or 'html'

## Usage with GitHub Copilot

Add this MCP server to your Copilot configuration:

```json
{
  "mcpServers": {
    "tm-types": {
      "command": "node",
      "args": ["/path/to/tm-types/mcp-server/dist/index.js"],
      "env": {
        "JWT_SECRET": "your-secret-key"
      }
    }
  }
}
```

Then in Copilot, you can:
- Ask to list all types: "Show me all available types"
- Create new types: "Create a new type for tracking organic certification with fields for certifier, issue date, and expiry date"
- Validate data: "Check if this data matches the FoodInstance type"
- Generate reports: "Create a summary report of this product's carbon footprint"

## Integration with Transcription/Chatbots

The MCP server supports non-authenticated access for data queries and report generation, making it perfect for:
- Voice-driven data entry (transcription → validation)
- Chatbot interfaces for supply chain data
- Public dashboards and reports
- API integrations

Example chatbot flow:
1. User speaks: "What's the carbon footprint of this coconut drink?"
2. Transcription service converts to text
3. Chatbot queries MCP: `generate_report` with reportType='impact'
4. MCP returns formatted report
5. Chatbot presents results to user

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Start server
npm start
```

## License

MIT
