# Quick Start Guide

## Setup Steps

### 1. Install Dependencies

```bash
# Root package (types)
npm install

# MCP Server
cd mcp-server
npm install
npm run build
```

### 2. Configure Environment

```bash
cd mcp-server
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Generate Auth Token

For authenticated operations (creating/modifying types):

```bash
node mcp-server/generate-token.js yourUserId user
```

Or interactively:
```bash
node mcp-server/generate-token.js
```

### 4. Add to Copilot

Add this to your MCP settings (in VS Code or Copilot configuration):

```json
{
  "mcpServers": {
    "tm-types": {
      "command": "node",
      "args": ["/absolute/path/to/tm-types/mcp-server/dist/index.js"],
      "env": {
        "JWT_SECRET": "your-secret-from-env-file"
      }
    }
  }
}
```

## Usage Examples

### List All Types (No Auth Required)

In Copilot:
```
Show me all available types in the tm-types system
```

Or direct MCP call:
```json
{
  "tool": "list_types",
  "arguments": {}
}
```

### Get Type Definition (No Auth Required)

```
What fields does the FoodInstance type have?
```

### Validate Data (No Auth Required)

```
Check if this data is valid for FoodInstance type:
{
  "category": "food",
  "bio": true,
  "quantity": 1000
}
```

### Create Type from Description (Auth Required)

First, generate a token:
```bash
TOKEN=$(node mcp-server/generate-token.js myUserId user | grep "eyJ" | xargs)
```

Then in Copilot:
```
Create a new type called "OrganicCertification" with fields for:
- certifier name (string)
- certification number (string)  
- issue date (timestamp)
- expiry date (timestamp)
- certification body (string)
- certificate URL (string)

Use auth token: [paste token here]
```

### Generate Report (No Auth Required)

```
Generate a summary report for this product data:
{
  "name": "Coconut Drink",
  "carbon": 0.5,
  "water": 100
}
```

## Publishing Types to NPM

### First Time Setup

1. Create NPM account at https://www.npmjs.com/
2. Generate access token: https://www.npmjs.com/settings/your-username/tokens
3. Add token to GitHub secrets as `NPM_TOKEN`

### Publishing Process

The CI/CD is configured to automatically publish when:
1. You push to main branch
2. The version in package.json has changed
3. TypeScript validation passes

**To publish a new version:**

```bash
# 1. Update version
npm version patch  # or minor, or major

# 2. Push changes
git push origin main

# 3. GitHub Actions will automatically:
#    - Validate types
#    - Publish to npm
#    - Create git tag
#    - Create GitHub release
```

### Manual Publishing (if needed)

```bash
npm publish --access public
```

## Migrating Projects

To switch from `@fairfooddata/types` to `@tracemarket/types`:

### 1. Update package.json

```bash
npm uninstall @fairfooddata/types
npm install @tracemarket/types
```

### 2. Update Imports

```typescript
// Old
import { FoodInstance } from '@fairfooddata/types';

// New  
import { FoodInstance } from '@tracemarket/types';
```

### 3. Run Find & Replace

In VS Code:
- Find: `@fairfooddata/types`
- Replace: `@tracemarket/types`
- Replace in all files across workspace

## Adding New Types

### Method 1: Natural Language (Recommended)

1. Generate auth token
2. Use Copilot to describe the type
3. Review generated code
4. Add to repository using `add_type_definition` tool

### Method 2: Manual Edit

1. Edit `src/index.d.ts`
2. Add your type definition
3. Run `npm run validate` to check
4. Commit and push

### Method 3: Pull Request

1. Fork repository
2. Add type definitions
3. Create PR
4. Team reviews and merges

## Testing MCP Server Locally

```bash
# Terminal 1: Start MCP server
cd mcp-server
npm start

# Terminal 2: Test with stdio
echo '{"method":"tools/list"}' | node dist/index.js
```

## Troubleshooting

### "Authentication required" error
- Generate a valid JWT token
- Make sure JWT_SECRET matches in .env and token generation
- Check token hasn't expired (default 24h)

### Types not updating
- Clear node_modules cache: `rm -rf node_modules package-lock.json && npm install`
- Check npm registry: `npm view @tracemarket/types`
- Verify version number incremented

### MCP server not responding
- Check it built successfully: `ls mcp-server/dist/`
- Verify Node.js version: `node --version` (should be 18+)
- Check environment variables are set

## Support

- GitHub Issues: https://github.com/entin-hun/tm-types/issues
- Documentation: See README files
- Example usage: Check tm-editor, tm-marketplace projects
