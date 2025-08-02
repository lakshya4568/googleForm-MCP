const { GoogleFormsService } = require('./src/googleFormsService.js');

async function authenticate() {
    console.log('Starting Google Forms authentication...');
    
    try {
        const service = new GoogleFormsService();
        
        // Temporarily set the environment to development to enable browser auth
        process.env.NODE_ENV = 'development';
        process.env.MCP_HEADLESS = 'false';
        
        await service.init();
        console.log('✅ Authentication successful! You can now use the Google Forms MCP server.');
        console.log('Token saved to token.json');
        
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        process.exit(1);
    }
}

authenticate();
