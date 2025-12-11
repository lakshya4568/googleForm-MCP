# Google Forms MCP Server

> **✅ STATUS: FULLY FUNCTIONAL - PRODUCTION READY**  
> All critical issues have been resolved. All 9 tools, 3 resources, and 1 prompt are working correctly with Claude, Cline, VS Code, and other MCP clients.

This server allows you to interact with Google Forms using the Model Context Protocol (MCP).

## 🚀 Quick Start

### Option 1: NPX (Recommended for MCP Clients)

Use directly with npx - no installation required:

```bash
npx gform-mcp-server
```

### Option 2: Global Install

```bash
npm install -g gform-mcp-server
gform-mcp-server
```

### Option 3: Clone Repository

```bash
git clone https://github.com/lakshya4568/googleForm-MCP.git
cd googleForm-MCP
npm install
npm start
```

## 🔐 Authentication Setup

### Step 1: Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google Forms API** and **Google Drive API**
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth client ID"
6. Choose **"Desktop application"**
7. Download the JSON file and save it as `credentials.json`

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Add your email as a **Test user** (required for testing mode)
3. Add required scopes if prompted

### Step 3: One-Time Authentication (Run in Terminal)

Run the auth command with credentials path set via environment variable:

```bash
# Using npx
GFORM_CREDENTIALS_PATH=/path/to/credentials.json npx gform-mcp-server auth

# Or from cloned repo (credentials.json in project root)
node auth.js
```

This will:

1. Open a browser for Google OAuth
2. Save the refresh token to `token.json` in the project directory

### Step 4: Configure MCP Client

Add to your MCP client's configuration (e.g., `.vscode/mcp.json`):

```json
{
  "servers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "gform-mcp-server"],
      "env": {
        "GFORM_CREDENTIALS_PATH": "${input:gform_credentials_path}"
      }
    }
  },
  "inputs": [
    {
      "id": "gform_credentials_path",
      "type": "promptString",
      "description": "Path to Google OAuth credentials.json file",
      "password": false
    }
  ]
}
```

**That's it!** VS Code will prompt you for the credentials path when starting the server.

## 📋 Configuration

| Environment Variable     | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `GFORM_CREDENTIALS_PATH` | Path to credentials.json from Google Cloud Console |
| `GFORM_TOKEN_PATH`       | Custom path for token.json (optional)              |
| `GFORM_CONFIG_DIR`       | Custom config directory (optional)                 |

Files:

- `credentials.json` - OAuth credentials downloaded from Google Cloud Console
- `token.json` - Refresh token (auto-generated after first auth, saved in project directory)

| Environment Variable     | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `GFORM_CONFIG_DIR`       | Custom directory for storing config (default: `~/.gform-mcp`) |
| `GFORM_TOKEN_PATH`       | Custom path for token.json file                               |
| `GFORM_CREDENTIALS_PATH` | Custom path for credentials.json file                         |

## 🛠️ Available Tools

The server provides these MCP tools:

| Tool                           | Description                                                         |
| ------------------------------ | ------------------------------------------------------------------- |
| `get-form-details`             | Retrieve complete form information including metadata and questions |
| `fetch-form-responses`         | Fetch form responses in JSON or CSV format                          |
| `create-form`                  | Create a new Google Form with title and description                 |
| `add-question-to-form`         | Add a basic question to an existing form                            |
| `add-question-with-options`    | Add questions with custom options (choice, scale, etc.)             |
| `list-forms`                   | List Google Forms accessible to the authenticated user              |
| `update-form-settings`         | Update form title, description, and settings                        |
| `create-survey-with-questions` | Create a complete survey with multiple questions                    |
| `debug-form-structure`         | Debug form structure for troubleshooting                            |

## 📚 Available Resources

| Resource URI                 | Description                   |
| ---------------------------- | ----------------------------- |
| `gform://{formId}/metadata`  | Form metadata and information |
| `gform://{formId}/questions` | Form questions and structure  |
| `gform://{formId}/responses` | Form response data            |

## 💡 Usage Examples

### With VS Code (mcp.json)

```json
{
  "servers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "gform-mcp-server"],
      "env": {
        "GFORM_CREDENTIALS_PATH": "${input:gform_credentials_path}"
      }
    }
  },
  "inputs": [
    {
      "id": "gform_credentials_path",
      "type": "promptString",
      "description": "Path to Google OAuth credentials.json file"
    }
  ]
}
```

### With Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "gform-mcp-server"],
      "env": {
        "GFORM_CREDENTIALS_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

### Example Tool Usage

```
# List your forms
Use the list-forms tool

# Create a new form
Use create-form with title="Customer Feedback" description="Please share your feedback"

# Get form details
Use get-form-details with formId="1a2b3c4d5e6f"

# Fetch responses as CSV
Use fetch-form-responses with formId="1a2b3c4d5e6f" format="csv"
```

## 🔒 Security

- OAuth credentials are stored securely in `~/.gform-mcp/` directory
- Credentials are never logged or exposed in MCP responses
- Never commit credentials.json or token.json to version control

## ⚠️ Troubleshooting

### "Access blocked" Error

- Ensure your email is added as a test user in OAuth consent screen
- Delete `token.json` and re-authenticate

### "Permission denied" Error

- Verify Google Forms API and Drive API are enabled
- Check that the authenticated user has access to the form

### Authentication Fails in Headless Environment

1. Run auth in a terminal with browser access first:
   ```bash
   GFORM_CREDENTIALS_PATH=/path/to/credentials.json npx gform-mcp-server auth
   ```
2. The token.json will be saved and used automatically on server start

## 📄 License

MIT License - see [LICENSE](LICENSE) file
