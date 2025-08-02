# Troubleshooting Guide for Google Forms MCP Server

## Common Issues and Solutions

### 1. Revision ID Issues (FIXED)

#### Problem: "Update failed: the revision ID does not match the latest revision ID"

This error occurred when creating surveys with multiple questions or making rapid consecutive updates to forms.

**Status:** ✅ **RESOLVED** - Fixed in the latest version

**Technical Details:**

- **Issue**: Using `requiredRevisionId` in writeControl required exact revision matches
- **Solution**: Switched to `targetRevisionId` which allows Google's API to handle conflicts automatically
- **Result**: Multiple questions can now be added reliably without revision ID conflicts

**If you still see this error:**

1. Update to the latest version of the MCP server
2. Restart the server
3. The issue should be resolved automatically

### 2. OAuth Authentication Issues

#### Problem: "Error 403: access_denied" or "MCP has not completed the Google verification process"

**Solution:**

1. **Add Test User in Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "OAuth consent screen"
   - Under "Test users", click "ADD USERS"
   - Add your Google account email address
   - Save the changes

2. **Clear Existing Tokens:**

   ```bash
   rm token.json
   ```

3. **Restart the Server:**

   ```bash
   npm start
   ```

4. **Complete OAuth Flow:**
   - Follow the browser prompt to authenticate
   - Grant all requested permissions

#### Problem: "Invalid redirect URI" or OAuth callback errors

**Solution:**

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Edit your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", ensure you have:
   - `http://localhost`
   - `http://127.0.0.1`
4. Save changes and restart the server

### 2. API Permissions Issues

#### Problem: "Permission denied" errors when accessing forms

**Solution:**

1. **Check API Enablement:**
   - Go to Google Cloud Console > "APIs & Services" > "Library"
   - Search for and enable:
     - Google Forms API
     - Google Drive API

2. **Verify Scopes:**
   Ensure your OAuth consent screen includes all required scopes:
   - `https://www.googleapis.com/auth/forms.body.readonly`
   - `https://www.googleapis.com/auth/forms.responses.readonly`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - `https://www.googleapis.com/auth/forms.body`
   - `https://www.googleapis.com/auth/drive.readonly`

3. **Re-authenticate:**

   ```bash
   rm token.json
   npm restart
   ```

### 3. Form Access Issues

#### Problem: "Form not found" errors for existing forms

**Possible Causes & Solutions:**

1. **Form ID is incorrect:**
   - Extract form ID from Google Forms URL
   - URL format: `https://docs.google.com/forms/d/FORM_ID/edit`
   - Use only the FORM_ID part

2. **No permission to access the form:**
   - Ensure the authenticated Google account owns the form or has edit access
   - If form is shared, verify sharing permissions

3. **Form is in Trash:**
   - Check Google Drive trash for the form
   - Restore if necessary

### 4. Installation and Build Issues

#### Problem: TypeScript compilation failures

**Solution:**

1. **Update Dependencies:**

   ```bash
   npm update
   ```

2. **Clear Node Modules:**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check TypeScript Version:**

   ```bash
   npx tsc --version
   ```

   Should be 5.x or higher

#### Problem: "Module not found" errors

**Solution:**

1. **Install Missing Dependencies:**

   ```bash
   npm install @google-cloud/local-auth googleapis @modelcontextprotocol/sdk zod dotenv
   ```

2. **Install Dev Dependencies:**

   ```bash
   npm install --save-dev @types/node typescript nodemon
   ```

### 5. Server Runtime Issues

#### Problem: Server starts but doesn't respond to MCP requests

**Solution:**

1. **Test Server Manually:**

   ```bash
   node test-server.js
   ```

2. **Check Server Output:**
   Look for initialization messages and error logs

3. **Verify MCP Client Configuration:**
   Ensure your MCP client is configured to connect to the correct server

#### Problem: Memory or performance issues

**Solution:**

1. **Limit Response Size:**
   Use smaller `maxResults` parameters when listing forms

2. **Monitor Resource Usage:**

   ```bash
   top -p $(pgrep -f gform-mcp-server)
   ```

### 6. Network and Firewall Issues

#### Problem: OAuth authentication hangs or fails

**Solution:**

1. **Check Network Connectivity:**

   ```bash
   curl -I https://accounts.google.com
   ```

2. **Verify Firewall Settings:**
   Ensure ports 80 and 443 are accessible for OAuth callbacks

3. **Corporate Network Issues:**
   If behind corporate firewall, contact IT to ensure Google OAuth endpoints are accessible

### 7. Data Format and CSV Issues

#### Problem: CSV export contains garbled data

**Solution:**

1. **Check Character Encoding:**
   The server outputs UTF-8 encoded CSV

2. **Excel Import Issues:**
   Use "Import Data" feature in Excel and select UTF-8 encoding

3. **Large Response Sets:**
   For forms with many responses, consider using pagination or filtering

## Debug Mode

To enable debug logging:

1. **Add Environment Variable:**

   ```bash
   export DEBUG=gform-mcp:*
   npm start
   ```

2. **Check Console Output:**
   Look for detailed API request/response logs

## Getting Help

If you're still experiencing issues:

1. **Check Error Messages:**
   Read the full error message and stack trace

2. **Test with Simple Form:**
   Create a basic test form to isolate issues

3. **Verify Prerequisites:**
   - Node.js 18+ installed
   - Valid Google Cloud project
   - Proper OAuth credentials

4. **Common Debugging Steps:**

   ```bash
   # Clean build
   npm run build
   
   # Test basic functionality
   node test-server.js
   
   # Check for missing files
   ls -la credentials.json token.json
   ```

## Version Compatibility

- **Node.js:** 18.0.0 or higher
- **MCP SDK:** 1.12.1 or higher
- **Google APIs:** Latest stable versions
- **TypeScript:** 5.x or higher

## Useful Commands

```bash
# Full clean restart
rm -rf node_modules package-lock.json token.json
npm install
npm run build
npm start

# Test specific form access
node -e "
const service = require('./dist/googleFormsService.js');
const gs = new service.GoogleFormsService();
gs.init().then(() => gs.getFormMetadata('YOUR_FORM_ID')).then(console.log);
"

# Check OAuth token validity
node -e "
const fs = require('fs');
if (fs.existsSync('token.json')) {
  const token = JSON.parse(fs.readFileSync('token.json'));
  console.log('Token expires:', new Date(token.expiry_date));
} else {
  console.log('No token.json found');
}
"
```
