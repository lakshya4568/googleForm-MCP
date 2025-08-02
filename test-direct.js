#!/usr/bin/env node

const { GoogleFormsService } = require("./src/googleFormsService.js");

async function testGoogleFormsService() {
  try {
    console.log("Testing Google Forms Service...");
    const service = new GoogleFormsService();

    console.log("Initializing service...");
    await service.init();

    console.log("Service initialized successfully!");

    // Test creating a form
    console.log("Testing form creation...");
    const form = await service.createForm(
      "Test Aditi Feedback Form",
      "Test description"
    );

    if (form) {
      console.log("Form created successfully!");
      console.log("Form ID:", form.formId);
      console.log("Form URL:", form.responderUri);
    } else {
      console.log("Form creation returned null");
    }
  } catch (error) {
    console.error("Error during testing:", error);
    console.error("Stack trace:", error.stack);
  }
}

testGoogleFormsService();
