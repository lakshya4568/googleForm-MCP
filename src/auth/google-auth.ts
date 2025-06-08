import { GoogleAuth } from 'google-auth-library';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';

/**
 * Authentication manager for Google Forms API
 */
export class GoogleFormsAuth {
  private auth: GoogleAuth | OAuth2Client | null = null;
  private credentials: any = null;

  constructor() {
    this.loadCredentials();
  }

  /**
   * Load credentials from environment variables or credentials file
   */
  private async loadCredentials() {
    try {
      // First try to load from environment variables
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.auth = new GoogleAuth({
          scopes: [
            'https://www.googleapis.com/auth/forms.body',
            'https://www.googleapis.com/auth/forms.responses.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
          ]
        });
        console.log('Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS');
        return;
      }

      // Try to load from OAuth2 client credentials
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        await this.setupOAuth2Client();
        return;
      }

      // Try to load from credentials.json file
      const credentialsPath = path.join(process.cwd(), 'credentials.json');
      try {
        const credentialsFile = await fs.readFile(credentialsPath, 'utf8');
        this.credentials = JSON.parse(credentialsFile);
        
        if (this.credentials.type === 'service_account') {
          this.auth = new GoogleAuth({
            credentials: this.credentials,
            scopes: [
              'https://www.googleapis.com/auth/forms.body',
              'https://www.googleapis.com/auth/forms.responses.readonly',
              'https://www.googleapis.com/auth/drive.readonly'
            ]
          });
          console.log('Loaded service account credentials from credentials.json');
        } else if (this.credentials.web || this.credentials.installed) {
          await this.setupOAuth2ClientFromFile();
        }
      } catch (error) {
        console.warn('Could not load credentials.json:', error);
      }

      if (!this.auth) {
        throw new Error('No valid Google credentials found. Please set up authentication.');
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      throw error;
    }
  }

  /**
   * Setup OAuth2 client from environment variables
   */
  private async setupOAuth2Client() {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/callback'
    );

    // Check if we have stored tokens
    const tokenPath = path.join(process.cwd(), 'token.json');
    try {
      const tokenFile = await fs.readFile(tokenPath, 'utf8');
      const tokens = JSON.parse(tokenFile);
      oauth2Client.setCredentials(tokens);
      
      // Refresh token if needed
      await oauth2Client.getAccessToken();
      
      this.auth = oauth2Client;
      console.log('Loaded OAuth2 credentials from environment and token.json');
    } catch (error) {
      console.warn('Could not load stored tokens. You may need to authenticate.');
      this.auth = oauth2Client;
    }
  }

  /**
   * Setup OAuth2 client from credentials file
   */
  private async setupOAuth2ClientFromFile() {
    const clientConfig = this.credentials.web || this.credentials.installed;
    const oauth2Client = new OAuth2Client(
      clientConfig.client_id,
      clientConfig.client_secret,
      clientConfig.redirect_uris[0]
    );

    // Check if we have stored tokens
    const tokenPath = path.join(process.cwd(), 'token.json');
    try {
      const tokenFile = await fs.readFile(tokenPath, 'utf8');
      const tokens = JSON.parse(tokenFile);
      oauth2Client.setCredentials(tokens);
      
      // Refresh token if needed
      await oauth2Client.getAccessToken();
      
      this.auth = oauth2Client;
      console.log('Loaded OAuth2 credentials from credentials.json and token.json');
    } catch (error) {
      console.warn('Could not load stored tokens. You may need to authenticate.');
      this.auth = oauth2Client;
    }
  }

  /**
   * Get authentication URL for OAuth2 flow
   */
  getAuthUrl(): string {
    if (!(this.auth instanceof OAuth2Client)) {
      throw new Error('OAuth2 client not configured');
    }

    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
      prompt: 'consent'
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokenFromCode(code: string): Promise<void> {
    if (!(this.auth instanceof OAuth2Client)) {
      throw new Error('OAuth2 client not configured');
    }

    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);

    // Save tokens to file
    const tokenPath = path.join(process.cwd(), 'token.json');
    await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
    
    console.log('Tokens saved to token.json');
  }

  /**
   * Get authenticated client
   */
  async getAuthClient(): Promise<GoogleAuth | OAuth2Client> {
    if (!this.auth) {
      await this.loadCredentials();
    }

    if (!this.auth) {
      throw new Error('Authentication not configured');
    }

    // Test the authentication
    try {
      if (this.auth instanceof OAuth2Client) {
        await this.auth.getAccessToken();
      } else {
        await this.auth.getClient();
      }
    } catch (error) {
      console.error('Authentication test failed:', error);
      throw new Error('Authentication failed. Please check your credentials.');
    }

    return this.auth;
  }

  /**
   * Check if authentication is properly configured
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getAuthClient();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke authentication tokens
   */
  async revokeAuth(): Promise<void> {
    if (this.auth instanceof OAuth2Client) {
      await this.auth.revokeCredentials();
    }
    
    // Remove token file
    const tokenPath = path.join(process.cwd(), 'token.json');
    try {
      await fs.unlink(tokenPath);
      console.log('Tokens revoked and removed');
    } catch (error) {
      console.warn('Could not remove token file:', error);
    }
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): { 
    isConfigured: boolean; 
    type: 'service_account' | 'oauth2' | 'none';
    scopes?: string[];
  } {
    if (!this.auth) {
      return { isConfigured: false, type: 'none' };
    }

    if (this.auth instanceof OAuth2Client) {
      return {
        isConfigured: true,
        type: 'oauth2',
        scopes: [
          'https://www.googleapis.com/auth/forms.body',
          'https://www.googleapis.com/auth/forms.responses.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ]
      };
    }

    return {
      isConfigured: true,
      type: 'service_account',
      scopes: [
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    };
  }
}

/**
 * Global authentication instance
 */
export const googleFormsAuth = new GoogleFormsAuth();
