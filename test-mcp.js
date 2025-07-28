#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

// Test the MCP server by sending messages to it
async function testMCPServer() {
  const serverPath = path.join(__dirname, "dist", "gform-mcp-server.js");

  console.log("Starting MCP server...");
  const serverProcess = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let responseBuffer = "";

  serverProcess.stdout.on("data", (data) => {
    responseBuffer += data.toString();
    console.log("Server output:", data.toString());
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("Server error:", data.toString());
  });

  serverProcess.on("close", (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  // Send initialize message
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-01-01",
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    },
  };

  console.log("Sending initialize message...");
  serverProcess.stdin.write(JSON.stringify(initMessage) + "\n");

  // Wait for response
  setTimeout(() => {
    // Send create form tool call
    const createFormMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "create-form",
        arguments: {
          title: "Aditi Feedback",
          description:
            "A feedback form for Aditi, created using Google Form MCP integration.",
        },
      },
    };

    console.log("Sending create form message...");
    serverProcess.stdin.write(JSON.stringify(createFormMessage) + "\n");

    // Clean up after 5 seconds
    setTimeout(() => {
      serverProcess.kill();
    }, 5000);
  }, 2000);
}

testMCPServer().catch(console.error);
