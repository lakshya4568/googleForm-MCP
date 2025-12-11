# Google Forms MCP Server

> **✅ STATUS: FULLY FUNCTIONAL - PRODUCTION READY**  
> All 9 tools, 3 resources, and 1 prompt are working correctly with Claude, Cline, VS Code, and other MCP clients.

This server allows you to interact with Google Forms using the Model Context Protocol (MCP).

## 🚀 Quick Start

```bash
git clone https://github.com/lakshya4568/googleForm-MCP.git
cd googleForm-MCP
npm install
```

## 🔐 Authentication Setup

### Step 1: Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google Forms API** and **Google Drive API**
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth client ID"
6. Choose **"Desktop application"**
7. Download the JSON file and save it as `credentials.json` in the project root

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Add your email as a **Test user** (required for testing mode)

### Step 3: Authenticate (One-time)

```bash
npm run auth
```

This will open a browser for Google OAuth. After authenticating, `token.json` will be created automatically.

### Step 4: Configure MCP Client

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "google-forms": {
      "command": "node",
      "args": ["/path/to/googleForm-MCP/src/gform-mcp-server.js"],
      "env": {
        "GFORM_CREDENTIALS_PATH": "${input:gform_credentials_path}"
      },
      "type": "stdio"
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

Or with direct path (no prompt):

```json
{
  "servers": {
    "google-forms": {
      "command": "node",
      "args": ["/path/to/googleForm-MCP/src/gform-mcp-server.js"],
      "type": "stdio"
    }
  }
}
```

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "node",
      "args": ["/path/to/googleForm-MCP/src/gform-mcp-server.js"]
    }
  }
}
```

## 📋 Configuration

| Environment Variable     | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `GFORM_CREDENTIALS_PATH` | Path to credentials.json (optional if in project root) |
| `GFORM_TOKEN_PATH`       | Custom path for token.json (optional)                  |

Files:

- `credentials.json` - OAuth credentials from Google Cloud Console
- `token.json` - Refresh token (auto-generated after auth)

## 🛠️ Available Tools

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

## 💡 Example Usage

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

- Never commit `credentials.json` or `token.json` to version control
- These files are already in `.gitignore`

## ⚠️ Troubleshooting

### "Access blocked" Error

- Ensure your email is added as a test user in OAuth consent screen
- Delete `token.json` and run `npm run auth` again

### "Permission denied" Error

- Verify Google Forms API and Drive API are enabled
- Check that the authenticated user has access to the form

## 📄 License

MIT License - see [LICENSE](LICENSE) file
