const { GoogleFormsService } = require("./src/googleFormsService.js");

async function authenticate() {
  console.log("🔐 Starting Google Forms authentication...\n");

  try {
    const service = new GoogleFormsService();

    // Set environment to development to enable browser auth
    process.env.NODE_ENV = "development";
    process.env.MCP_HEADLESS = "false";

    await service.init();
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    process.exit(1);
  }
}

authenticate();
