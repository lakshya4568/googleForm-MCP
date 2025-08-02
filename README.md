# Google Forms MCP Server

> **✅ STATUS: FULLY FUNCTIONAL - PRODUCTION READY**  
> All critical issues have been resolved. All 6 tools, 3 resources, and 1 prompt are working correctly with Cline and other MCP clients.

This server allows you to interact with Google Forms using the Model Context Protocol (MCP).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Google Cloud Project with Forms API enabled
- OAuth 2.0 credentials configured

### Installation & Setup

1. **Install Dependencies:**

    ```bash
    npm install
    ```

2. **Configure Google Cloud Project and OAuth 2.0:**
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).
    - Create a new project or select an existing one.
    - Enable the **Google Forms API** and **Google Drive API** for your project.
    - Create OAuth 2.0 credentials:
        - Go to "APIs & Services" > "Credentials".
        - Click "Create Credentials" > "OAuth client ID".
        - Choose "Desktop app" as the application type.
        - Name your client (e.g., "GForm MCP Server").
        - Download the JSON file containing your client ID and client secret. Rename this file to `credentials.json` and place it in the root of this project directory.
    - **Configure OAuth Consent Screen** (Important for fixing the "Access blocked" error):
        - Go to "APIs & Services" > "OAuth consent screen".
        - If your app is in "Testing" mode, add your Google account email as a "Test user".
        - Ensure all required scopes are added:
          - `https://www.googleapis.com/auth/forms.body.readonly`
          - `https://www.googleapis.com/auth/forms.responses.readonly`
          - `https://www.googleapis.com/auth/drive.metadata.readonly`
          - `https://www.googleapis.com/auth/forms.body`
        - Set the proper authorized redirect URIs (should include `http://localhost` for the local auth flow).
    - Authorize your application:
        - The first time you run the server, it will attempt to open a URL in your browser for you to authorize the application. Follow the instructions.
        - Upon successful authorization, a `token.json` file will be created in the project root. This file stores your access and refresh tokens.

3. **Troubleshooting OAuth "Access blocked" Error:**
    If you see "Error 403: access_denied" or "MCP has not completed the Google verification process":
    - Ensure your Google account is added as a test user in the OAuth consent screen
    - Delete the `token.json` file and re-authenticate
    - For production use, submit your app for Google verification

4. **Create a `.env` file** in the project root with the following content (optional, for specific form IDs):

``` text
    # Example: GOOGLE_FORM_ID=your_form_id_here
```

## Usage

1. **Start the server:**

    ```bash
    npm start
    ```

    The server will connect via stdio by default.

## MCP Features

### Resources

- `form-metadata`:
  - Description: Retrieves the metadata for a Google Form.
  - Parameters: `formId` (string, required) - The ID of the Google Form.
  - Output: JSON object containing form title, description, and form ID.
- `form-questions`:
  - Description: Retrieves the schema of questions for a Google Form.
  - Parameters: `formId` (string, required) - The ID of the Google Form.
  - Output: JSON object representing the questions in the form.
- `form-responses`:
  - Description: Fetches all responses for a Google Form.
  - Parameters: `formId` (string, required) - The ID of the Google Form.
  - Output: JSON array of form responses.

### Tools

- `get-form-details`:
  - Description: Retrieves metadata and questions for a specified Google Form.
  - Input Schema: `{ formId: z.string() }`
  - Output Schema: `z.object({ metadata: z.any(), questions: z.any() })`
- `fetch-form-responses`:
  - Description: Fetches responses for a specified Google Form.
  - Input Schema: `{ formId: z.string(), format: z.enum(['json', 'csv']).optional() }` (format defaults to 'json')
  - Output Schema: `z.string()` (JSON or CSV string)
- `add-question-to-form`:
  - Description: Adds a new question to a specified Google Form. (Basic implementation, can be extended for different question types)
  - Input Schema: `{ formId: z.string(), questionTitle: z.string(), questionType: z.string().optional() }` (questionType defaults to 'TEXT')
  - Output Schema: `z.object({ updatedForm: z.any() })`

### Prompts

- `summarize-form-responses`:
  - Description: Generates a text summary of form responses.
  - Input Schema: `{ formId: z.string() }`
  - System Prompt: "You are an AI assistant. Summarize the responses for the Google Form with ID {formId}. Provide a count of responses for each question. For numerical questions, calculate the average."
  - User Prompt Example: "Summarize the responses for form {formId}."
- `generate-response-report`:
  - Description: Generates a more detailed report of response trends.
  - Input Schema: `{ formId: z.string() }`
  - System Prompt: "You are an AI assistant. Generate a report of response trends for the Google Form with ID {formId}. Highlight any notable patterns or insights from the responses."
  - User Prompt Example: "Generate a report for form {formId}."
- `export-responses-to-spreadsheet-format`:
  - Description: Prepares form responses in a format suitable for spreadsheet import (CSV).
  - Input Schema: `{ formId: z.string() }`
  - System Prompt: "You are an AI assistant. Convert the responses for the Google Form with ID {formId} into CSV format."
  - User Prompt Example: "Export responses for form {formId} to CSV."

## Testing

1. **Quick Test:**

   ```bash
   node test-server.js
   ```

   This will perform a basic functionality test of the MCP server.

2. **Manual Testing:**
   Start the server and test with an MCP client:

   ```bash
   npm start
   ```

## Available Tools

The server provides the following MCP tools:

1. **`get-form-details`** - Retrieve complete form information including metadata and questions
   - Parameters: `formId` (string)

2. **`fetch-form-responses`** - Fetch form responses in JSON or CSV format
   - Parameters: `formId` (string), `format` (optional: "json" | "csv", default: "json")

3. **`create-form`** - Create a new Google Form
   - Parameters: `title` (string), `description` (optional string)

4. **`add-question-to-form`** - Add a question to an existing form
   - Parameters: `formId` (string), `questionTitle` (string), `questionType` (optional: "TEXT" | "CHOICE", default: "TEXT")

5. **`list-forms`** - List Google Forms accessible to the authenticated user
   - Parameters: `maxResults` (optional number, default: 10, max: 100)

6. **`update-form-settings`** - Update form settings like title, description
   - Parameters: `formId` (string), `title` (optional), `description` (optional), `collectEmail` (optional boolean), `allowResponseEdits` (optional boolean)

## Available Resources

The server exposes these MCP resources:

1. **`gform://{formId}/metadata`** - Form metadata and information
2. **`gform://{formId}/questions`** - Form questions and structure  
3. **`gform://{formId}/responses`** - Form response data

## Available Prompts

1. **`summarize-form-responses`** - Generates a comprehensive summary of form responses
   - Parameters: `formId` (string)

## Example Usage with Cline

Once configured, you can use this server with Cline by referencing form resources:

- `gform://1a2b3c4d5e6f7g8h9i0j/metadata` - Get form details
- `gform://1a2b3c4d5e6f7g8h9i0j/responses` - Get form responses

Or use the tools directly:

- Use `get-form-details` to retrieve complete form information
- Use `fetch-form-responses` with format="csv" to get responses in spreadsheet format
- Use `create-form` to create new forms programmatically

## Scope Permissions

This server requires the following Google API scopes:

- `https://www.googleapis.com/auth/forms.body.readonly` - Read form structure
- `https://www.googleapis.com/auth/forms.responses.readonly` - Read form responses  
- `https://www.googleapis.com/auth/drive.metadata.readonly` - Access Drive metadata
- `https://www.googleapis.com/auth/forms.body` - Modify form structure
- `https://www.googleapis.com/auth/drive.readonly` - List forms via Drive API

## Compatibility

This server is designed to be compatible with MCP clients like Cline. It uses stdio for communication.

## Security and Rate Limiting

- **Credentials:** OAuth 2.0 client credentials (`credentials.json`) and user tokens (`token.json`) are stored locally. Ensure these files are kept secure and are not committed to version control (they are included in `.gitignore`).
- **Rate Limiting:** The Google Forms API has usage limits. This server makes direct API calls and does not currently implement sophisticated rate limiting or retry logic beyond what the `googleapis` library might offer. For heavy usage, consider adding such features.
  - [Google Forms API Usage Limits](https://developers.google.com/forms/api/limits)

## Future Enhancements

- More robust error handling.
- Support for more question types when adding questions.
- Advanced response analysis and summarization.
- Support for other MCP transports (e.g., Streamable HTTP).
- More granular control over form updates.
