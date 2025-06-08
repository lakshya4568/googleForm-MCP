# Google Forms MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with Google Forms API, enabling LLM applications to interact with Google Forms for form management, response analysis, and data export.

## Features

### 🔗 **Secure Authentication**
- OAuth 2.0 support for secure API access
- Service Account authentication for server environments
- Automatic token refresh and credential management
- Multiple authentication methods (environment variables, credentials file)

### 📋 **Form Management**
- Retrieve form metadata, questions, and settings
- Create new forms programmatically
- Add questions of various types (text, choice, scale, etc.)
- Update form properties and structure

### 📊 **Response Analysis**
- Fetch form responses in structured format
- Generate statistical summaries and insights
- Export responses to JSON or CSV
- Calculate response trends and patterns

### 🛠 **MCP Resources**
- `forms://{formId}/metadata` - Complete form information
- `forms://{formId}/questions` - Form questions and structure
- `forms://{formId}/responses` - All form responses
- `forms://{formId}/summary` - Response statistics and analysis

### ⚡ **MCP Tools**
- `get-form-details` - Retrieve comprehensive form information
- `get-form-responses` - Fetch responses with filtering options
- `create-form` - Create new Google Forms
- `add-question` - Add questions to existing forms
- `export-responses` - Export data in multiple formats
- `get-response-summary` - Generate analytical summaries
- `test-connection` - Verify API connectivity

### 💡 **Smart Prompts**
- `analyze-form-responses` - Comprehensive response analysis
- `generate-form-report` - Create professional reports
- `export-to-spreadsheet` - Prepare data for spreadsheet analysis
- `optimize-form` - Form improvement recommendations
- `compare-responses` - Segment and compare response data

## Installation

### Prerequisites
- Node.js 18+ 
- Google Cloud Platform account
- Google Forms API enabled

### Quick Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd google-forms-mcp-server
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Set up Google Forms API credentials** (choose one method):

#### Method 1: Service Account (Recommended for servers)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google Forms API
4. Create a Service Account
5. Download the JSON key file as `credentials.json`
6. Place it in the project root directory

#### Method 2: OAuth 2.0 (For user-specific access)
1. Create OAuth 2.0 credentials in Google Cloud Console
2. Set environment variables:
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:8080/callback"
```

#### Method 3: Application Default Credentials
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

4. **Test the setup:**
```bash
npm start
```

## Usage

### As a standalone MCP server

```bash
npm start
```

### Integration with MCP clients

#### Claude Desktop
Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "node",
      "args": ["/path/to/google-forms-mcp-server/build/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"
      }
    }
  }
}
```

#### Cline (VS Code)
Configure in Cline settings:

```json
{
  "mcp.servers": [
    {
      "name": "google-forms",
      "command": "node /path/to/google-forms-mcp-server/build/index.js"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | Optional* |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID | Optional* |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | Optional* |
| `GOOGLE_REDIRECT_URI` | OAuth 2.0 redirect URI | Optional |

*At least one authentication method is required

## API Reference

### Resources

#### Form Metadata
```
forms://{formId}/metadata
```
Returns complete form information including title, description, settings, and question structure.

#### Form Questions
```
forms://{formId}/questions
```
Returns detailed information about all questions in the form.

#### Form Responses
```
forms://{formId}/responses
```
Returns all responses submitted to the form.

#### Form Summary
```
forms://{formId}/summary
```
Returns statistical summary including response counts and analysis.

### Tools

#### get-form-details
Retrieve comprehensive form information.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `includeQuestions` (boolean, optional): Include question details (default: true)
- `includeSettings` (boolean, optional): Include form settings (default: true)

**Example:**
```json
{
  "name": "get-form-details",
  "arguments": {
    "formId": "1FAIpQLSe...",
    "includeQuestions": true
  }
}
```

#### get-form-responses
Fetch form responses with filtering options.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `limit` (number, optional): Maximum responses to return
- `format` (string, optional): Output format ("json" or "csv")

#### create-form
Create a new Google Form.

**Parameters:**
- `title` (string): Form title
- `description` (string, optional): Form description

#### add-question
Add a question to an existing form.

**Parameters:**
- `formId` (string): Google Forms ID
- `questionType` (string): Type ("text", "paragraph", "choice", "scale")
- `title` (string): Question title
- `description` (string, optional): Question description
- `required` (boolean, optional): Whether required (default: false)
- `options` (array, optional): For choice questions
- `allowMultiple` (boolean, optional): For choice questions
- `scaleMin`/`scaleMax` (number, optional): For scale questions

#### export-responses
Export form responses in various formats.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `format` (string): Export format ("json" or "csv")
- `includeMetadata` (boolean, optional): Include form metadata
- `includeTimestamps` (boolean, optional): Include response timestamps
- `flattenResponses` (boolean, optional): Flatten response structure

#### get-response-summary
Generate analytical summary of responses.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `includeStatistics` (boolean, optional): Include statistical analysis

### Prompts

#### analyze-form-responses
Comprehensive analysis of form responses.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `focusArea` (string, optional): Analysis focus ("overview", "trends", "satisfaction", "demographics")

#### generate-form-report
Generate professional reports.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `reportType` (string, optional): Report type ("executive", "detailed", "statistical")

#### export-to-spreadsheet
Prepare data for spreadsheet analysis.

**Parameters:**
- `formId` (string): Google Forms ID or URL
- `includeAnalysis` (boolean, optional): Include analysis suggestions

## Examples

### Basic Form Analysis
```typescript
// Using the MCP tools through a client
const formDetails = await client.callTool({
  name: "get-form-details",
  arguments: {
    formId: "1FAIpQLSe...",
    includeQuestions: true
  }
});

const responseSummary = await client.callTool({
  name: "get-response-summary",
  arguments: {
    formId: "1FAIpQLSe...",
    includeStatistics: true
  }
});
```

### Creating a New Form
```typescript
const newForm = await client.callTool({
  name: "create-form",
  arguments: {
    title: "Customer Feedback Survey",
    description: "Please share your experience with our service"
  }
});

// Add a rating question
await client.callTool({
  name: "add-question",
  arguments: {
    formId: newForm.formId,
    questionType: "scale",
    title: "How satisfied are you with our service?",
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: "Very Dissatisfied",
    scaleMaxLabel: "Very Satisfied",
    required: true
  }
});
```

### Exporting Response Data
```typescript
// Export as CSV for spreadsheet analysis
const csvData = await client.callTool({
  name: "export-responses",
  arguments: {
    formId: "1FAIpQLSe...",
    format: "csv",
    includeTimestamps: true,
    flattenResponses: true
  }
});

// Export as JSON for programmatic analysis
const jsonData = await client.callTool({
  name: "export-responses",
  arguments: {
    formId: "1FAIpQLSe...",
    format: "json",
    includeMetadata: true
  }
});
```

## Security & Best Practices

### Authentication Security
- Store credentials securely (use environment variables or secure credential stores)
- Use service accounts for production environments
- Regularly rotate access tokens and credentials
- Implement proper access controls and permissions

### Rate Limiting
- The server implements automatic rate limiting (100ms between requests)
- Google Forms API has usage quotas and limits
- Monitor API usage in Google Cloud Console
- Implement exponential backoff for retry logic

### Data Privacy
- Only request necessary scopes for your use case
- Implement data retention policies
- Ensure compliance with privacy regulations (GDPR, CCPA, etc.)
- Sanitize and validate all input data

### Error Handling
- All tools return structured error messages
- Network errors are automatically retried
- Authentication errors trigger re-authentication
- Detailed error logging for debugging

## Troubleshooting

### Common Issues

#### Authentication Errors
```
Error: Authentication not configured
```
**Solution:** Ensure you have set up one of the authentication methods correctly.

#### Permission Errors
```
Error: The caller does not have permission
```
**Solution:** Verify that your Google account or service account has access to the Google Forms API and the specific forms you're trying to access.

#### Form Not Found
```
Error: Form not found
```
**Solution:** Check that the form ID is correct and that you have access to the form.

#### Rate Limiting
```
Error: Quota exceeded
```
**Solution:** The server implements rate limiting, but you may hit Google's API quotas. Wait and retry, or request a quota increase.

### Debug Mode
Enable debug logging:
```bash
DEBUG=google-forms-mcp npm start
```

### Checking API Status
Use the test-connection tool to verify connectivity:
```typescript
const status = await client.callTool({
  name: "test-connection",
  arguments: {}
});
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
npm install
npm run dev  # Start in development mode with hot reload
npm test     # Run tests
npm run lint # Check code style
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [Google Forms API Reference](https://developers.google.com/forms/api)
- **MCP Specification:** [Model Context Protocol](https://modelcontextprotocol.io)
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)

## Changelog

### v1.0.0
- Initial release
- Full Google Forms API integration
- MCP resources, tools, and prompts
- OAuth 2.0 and Service Account authentication
- CSV and JSON export formats
- Comprehensive response analysis
- Rate limiting and error handling
