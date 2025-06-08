# Google Forms MCP Server Setup Guide

This guide will help you set up and configure the Google Forms MCP Server for use with Cline and other MCP clients.

## Prerequisites

- Node.js 18 or higher
- Google Cloud account
- Cline or another MCP client

## Step 1: Clone and Install

```bash
git clone https://github.com/lakshya4568/googleForm-MCP.git
cd googleForm-MCP
npm install
npm run build
```

## Step 2: Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Required APIs**
   - Enable Google Forms API
   - Enable Google Drive API

3. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application"
   - Download the JSON file and rename it to `credentials.json`
   - Place it in the project root directory

4. **Configure OAuth Consent Screen**
   - Go to APIs & Services > OAuth consent screen
   - Add your email as a test user (for testing mode)
   - Add required scopes if prompted

## Step 3: Initial Authentication

Run the server once to complete authentication:

```bash
npm start
```

This will:
- Open your browser for Google OAuth
- Generate a `token.json` file after successful auth
- The server will be ready for use

## Step 4: Configure with Cline

Add to your Cline MCP settings:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "node",
      "args": ["path/to/googleForm-MCP/dist/gform-mcp-server.js"]
    }
  }
}
```

## Step 5: Test the Installation

Test with Cline:
- Use the `list-forms` tool to see your Google Forms
- Try creating a form with `create-form`
- Access form data using resources like `gform://FORM_ID/metadata`

## Available Tools

- `get-form-details` - Get complete form information
- `fetch-form-responses` - Get responses in JSON or CSV
- `create-form` - Create new Google Forms
- `add-question-to-form` - Add questions to forms
- `add-question-with-options` - Add questions with custom options
- `list-forms` - List your Google Forms
- `update-form-settings` - Update form settings
- `create-survey-with-questions` - Create complete surveys
- `debug-form-structure` - Debug form structure

## Available Resources

- `gform://FORM_ID/metadata` - Form metadata
- `gform://FORM_ID/questions` - Form questions
- `gform://FORM_ID/responses` - Form responses

## Troubleshooting

### Authentication Issues
- Ensure `credentials.json` is in the project root
- Delete `token.json` and re-authenticate if needed
- Check that your email is added as a test user

### API Errors
- Verify Google Forms API and Drive API are enabled
- Check OAuth scopes are correctly configured
- Ensure form IDs are valid and accessible

### Permission Errors
- Make sure you have access to the forms you're trying to access
- Check that the authenticated user owns or has access to the forms

For more help, check the PROJECT_STATUS.md file for detailed troubleshooting information.