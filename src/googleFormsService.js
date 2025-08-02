const { google } = require("googleapis");
const { promises: fs } = require("fs");
const fsSync = require("fs");
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly", // Needed to get form titles via Drive API
  "https://www.googleapis.com/auth/forms.body", // For updating forms (e.g., adding questions)
  "https://www.googleapis.com/auth/drive.readonly", // For listing forms via Drive API
];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const getProjectRoot = () => {
  // Try to find the project root by looking for package.json
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    if (fsSync.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to the directory where this script is located
  return path.dirname(__dirname);
};

const PROJECT_ROOT = getProjectRoot();
const TOKEN_PATH = path.join(PROJECT_ROOT, "token.json");
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");

class GoogleFormsService {
  constructor() {
    this.formsApi = null;
    this.authClient = null;
  }

  async init() {
    try {
      this.authClient = await this.authorize();
      this.formsApi = google.forms({ version: "v1", auth: this.authClient });
      // Successfully initialized - no console output in MCP server
    } catch (error) {
      // Log errors to stderr, which is allowed in MCP
      console.error("Error initializing GoogleFormsService:", error);
      throw new Error(
        "Failed to initialize Google Forms service. Ensure credentials.json is valid and you can complete the auth flow."
      );
    }
  }

  /**
   * Reads previously authorized credentials from the save file.
   */
  async loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(TOKEN_PATH, "utf-8");
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
  }

  /**
   * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
   */
  async saveCredentials(client) {
    try {
      const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
      const keys = JSON.parse(content);
      const key = keys.installed || keys.web;
      const payload = JSON.stringify({
        type: "authorized_user",
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
      });
      await fs.writeFile(TOKEN_PATH, payload);
    } catch (err) {
      console.error("Error saving credentials:", err);
      throw new Error("Failed to save credentials. Check CREDENTIALS_PATH.");
    }
  }

  /**
   * Load or request or authorization to call APIs.
   */
  async authorize() {
    // Debug info is removed for MCP server compatibility
    // (console.log outputs interfere with JSON-RPC protocol)

    let client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }

    // Check if we're running in a headless environment (like VS Code MCP)
    const isHeadless =
      !process.env.DISPLAY &&
      !process.env.SSH_CLIENT &&
      process.env.NODE_ENV !== "development";

    if (isHeadless || process.env.MCP_HEADLESS === "true") {
      throw new Error(`No valid token.json found. Please run authentication first:
1. Run 'npm run auth' or 'node src/gform-mcp-server.js' in a terminal with browser access
2. Complete the OAuth flow in your browser  
3. Then restart the MCP server
Token path: ${TOKEN_PATH}`);
    }

    try {
      client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
      });

      if (client.credentials) {
        await this.saveCredentials(client);
        return client;
      } else {
        throw new Error("Authentication failed: No credentials obtained.");
      }
    } catch (error) {
      console.error("Authorization error:", error.message);
      if (
        error.message.includes("ENOENT") ||
        error.message.includes("not found")
      ) {
        throw new Error(
          `credentials.json file not found. Please ensure it exists at: ${CREDENTIALS_PATH}`
        );
      }
      throw new Error(
        `Failed to authorize: ${error.message}. Ensure 'credentials.json' is correct and accessible, and complete the authentication prompt in your browser.`
      );
    }
  }

  async getFormMetadata(formId) {
    try {
      const res = await this.formsApi.forms.get({ formId });
      return res.data;
    } catch (error) {
      console.error(
        `API Error fetching metadata for form ${formId}: ${error.message}`
      );
      if (error.code === 403) {
        throw new Error(
          `Permission denied for form ${formId}. Ensure the authenticated user has access and the Forms API is enabled.`
        );
      }
      if (error.code === 404) {
        throw new Error(`Form ${formId} not found.`);
      }
      throw error; // Re-throw other errors
    }
  }

  async getFormQuestions(formId) {
    try {
      const res = await this.formsApi.forms.get({ formId });
      return res.data.items;
    } catch (error) {
      console.error(
        `API Error fetching questions for form ${formId}: ${error.message}`
      );
      throw error;
    }
  }

  async getFormResponses(formId) {
    try {
      const res = await this.formsApi.forms.responses.list({ formId });
      return res.data;
    } catch (error) {
      console.error(
        `API Error fetching responses for form ${formId}: ${error.message}`
      );
      throw error;
    }
  }

  async addQuestion(formId, title, questionType = "TEXT", index = 0) {
    try {
      // Get the current form to get the latest revision ID
      const currentForm = await this.formsApi.forms.get({ formId });
      const revisionId = currentForm.data.revisionId || "";

      // Create the question object based on type - ONLY set one question type per the API spec
      let question = {
        required: false,
      };

      switch (questionType.toUpperCase()) {
        case "CHOICE":
        case "RADIO":
          question.choiceQuestion = {
            type: "RADIO",
            options: [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "CHECKBOX":
          question.choiceQuestion = {
            type: "CHECKBOX",
            options: [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "DROPDOWN":
          question.choiceQuestion = {
            type: "DROP_DOWN",
            options: [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "SCALE":
          question.scaleQuestion = {
            low: 1,
            high: 5,
            lowLabel: "Poor",
            highLabel: "Excellent",
          };
          break;
        case "TEXT":
        default:
          question.textQuestion = {
            paragraph: false,
          };
          break;
        case "PARAGRAPH":
          question.textQuestion = {
            paragraph: true,
          };
          break;
      }

      const requests = [
        {
          createItem: {
            item: {
              title: title,
              questionItem: {
                question: question,
              },
            },
            location: {
              index: index,
            },
          },
        },
      ];

      const res = await this.formsApi.forms.batchUpdate({
        formId: formId,
        requestBody: {
          requests: requests,
          writeControl: { requiredRevisionId: revisionId },
        },
      });
      return res.data;
    } catch (error) {
      console.error(
        `API Error adding question to form ${formId}: ${error.message}`
      );
      if (error.response && error.response.data && error.response.data.error) {
        console.error(
          "Detailed error:",
          JSON.stringify(error.response.data.error, null, 2)
        );
        throw new Error(
          `Failed to add question: ${error.response.data.error.message}`
        );
      }
      throw error;
    }
  }

  async addQuestionWithOptions(formId, title, questionType, options, isRequired = false) {
    try {
      // Get the current form to get the latest revision ID
      const currentForm = await this.formsApi.forms.get({ formId });
      const revisionId = currentForm.data.revisionId || "";

      // Create the question object based on type
      let question = {
        required: isRequired,
      };

      switch (questionType.toUpperCase()) {
        case "CHOICE":
        case "RADIO":
          question.choiceQuestion = {
            type: "RADIO",
            options: options ? options.map(opt => ({ value: opt })) : [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "CHECKBOX":
          question.choiceQuestion = {
            type: "CHECKBOX",
            options: options ? options.map(opt => ({ value: opt })) : [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "DROPDOWN":
          question.choiceQuestion = {
            type: "DROP_DOWN",
            options: options ? options.map(opt => ({ value: opt })) : [
              { value: "Option 1" },
              { value: "Option 2" },
              { value: "Option 3" },
            ],
          };
          break;
        case "SCALE":
          question.scaleQuestion = {
            low: 1,
            high: 5,
            lowLabel: options && options[0] ? options[0] : "Poor",
            highLabel: options && options[1] ? options[1] : "Excellent",
          };
          break;
        case "TEXT":
          question.textQuestion = {
            paragraph: false,
          };
          break;
        case "PARAGRAPH":
          question.textQuestion = {
            paragraph: true,
          };
          break;
        default:
          question.textQuestion = {
            paragraph: false,
          };
          break;
      }

      const requests = [
        {
          createItem: {
            item: {
              title: title,
              questionItem: {
                question: question,
              },
            },
            location: {
              index: 0, // Add at the beginning
            },
          },
        },
      ];

      const res = await this.formsApi.forms.batchUpdate({
        formId: formId,
        requestBody: {
          requests: requests,
          writeControl: { requiredRevisionId: revisionId },
        },
      });
      return res.data;
    } catch (error) {
      console.error(
        `API Error adding question with options to form ${formId}: ${error.message}`
      );
      if (error.response && error.response.data && error.response.data.error) {
        console.error(
          "Detailed error:",
          JSON.stringify(error.response.data.error, null, 2)
        );
        throw new Error(
          `Failed to add question with options: ${error.response.data.error.message}`
        );
      }
      throw error;
    }
  }

  async createForm(title, description) {
    const form = {
      info: {
        title: title,
      },
    };

    try {
      const res = await this.formsApi.forms.create({
        requestBody: form,
      });

      // If description is provided, update the form with description using batchUpdate
      if (description && res.data.formId) {
        const formId = res.data.formId;
        const currentForm = await this.formsApi.forms.get({ formId });
        const revisionId = currentForm.data.revisionId || "";

        await this.formsApi.forms.batchUpdate({
          formId: formId,
          requestBody: {
            requests: [
              {
                updateFormInfo: {
                  info: {
                    description: description,
                  },
                  updateMask: "description",
                },
              },
            ],
            writeControl: { requiredRevisionId: revisionId },
          },
        });
      }

      return res.data;
    } catch (error) {
      console.error(`API Error creating form: ${error.message}`);
      if (error.response && error.response.data && error.response.data.error) {
        console.error(
          "Detailed error:",
          JSON.stringify(error.response.data.error, null, 2)
        );
        throw new Error(
          `Failed to create form: ${error.response.data.error.message}`
        );
      }
      throw error;
    }
  }

  async convertResponsesToCSV(responsesData, formId) {
    if (
      !responsesData ||
      !responsesData.responses ||
      responsesData.responses.length === 0
    ) {
      return "No responses to convert.";
    }

    const responses = responsesData.responses;

    // Get form metadata to fetch question titles for better headers
    let formMetadata = null;
    try {
      formMetadata = await this.getFormMetadata(formId);
    } catch (error) {
      console.warn(`Could not fetch form metadata for CSV headers: ${error}`);
    }

    let csvContent = "";
    const allQuestionIds = new Set();

    // First pass to gather all unique question IDs from all responses
    responses.forEach((response) => {
      if (response.answers) {
        Object.keys(response.answers).forEach((qid) => allQuestionIds.add(qid));
      }
    });

    const sortedQuestionIds = Array.from(allQuestionIds).sort(); // Sort for consistent column order

    // Create header row with question titles if available
    const headers = ["ResponseId", "SubmissionTime"];
    const questionHeaders = sortedQuestionIds.map((qid) => {
      if (formMetadata && formMetadata.items) {
        const item = formMetadata.items.find(
          (item) => item.questionItem && item.questionItem.question && item.questionItem.question.questionId === qid
        );
        if (item && item.title) {
          return this.escapeCSVValue(item.title);
        }
      }
      return `Question_${qid}`;
    });

    csvContent += headers.concat(questionHeaders).join(",") + "\n";

    // Add data rows
    responses.forEach((response) => {
      const responseId = response.responseId || "";
      const submissionTime =
        response.createTime || response.lastSubmittedTime || "";

      let row = [
        this.escapeCSVValue(responseId),
        this.escapeCSVValue(submissionTime),
      ];

      sortedQuestionIds.forEach((qid) => {
        const answer = response.answers && response.answers[qid];
        let value = "";

        if (answer) {
          if (answer.textAnswers && answer.textAnswers.answers) {
            value = answer.textAnswers.answers.map(a => a.value).join("; ");
          } else if (answer.fileUploadAnswers && answer.fileUploadAnswers.answers) {
            value = answer.fileUploadAnswers.answers.map(a => a.fileName || "File uploaded").join("; ");
          } else {
            value = JSON.stringify(answer);
          }
        }

        row.push(this.escapeCSVValue(value));
      });

      csvContent += row.join(",") + "\n";
    });

    return csvContent;
  }

  escapeCSVValue(value) {
    if (!value) return '""';
    // Escape double quotes and wrap in quotes if needed
    const escaped = value.replace(/"/g, '""');
    // Wrap in quotes if contains comma, newline, or quotes
    if (
      escaped.includes(",") ||
      escaped.includes("\n") ||
      escaped.includes('"')
    ) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  async listForms(maxResults = 10) {
    try {
      // Using Google Drive API to find Google Forms files
      const drive = google.drive({ version: "v3", auth: this.authClient });
      const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.form'",
        pageSize: maxResults,
        fields: "files(id, name, createdTime, modifiedTime, webViewLink)",
      });

      const forms = res.data.files || [];
      return forms.map((file) => ({
        formId: file.id,
        title: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        responderUri: file.webViewLink ? file.webViewLink.replace("/edit", "/viewform") : null,
        editUri: file.webViewLink,
      }));
    } catch (error) {
      console.error(`API Error listing forms: ${error.message}`);
      throw error;
    }
  }

  async updateFormSettings(formId, settings) {
    const requests = [];

    // Update form info (title, description)
    if (settings.title || settings.description) {
      requests.push({
        updateFormInfo: {
          info: {
            title: settings.title,
            description: settings.description,
          },
          updateMask: "title,description",
        },
      });
    }

    // Update form settings (collect email, allow edits)
    if (
      settings.collectEmail !== undefined ||
      settings.allowResponseEdits !== undefined
    ) {
      const settingsUpdate = {};
      if (settings.collectEmail !== undefined) {
        settingsUpdate.quizSettings = { isQuiz: false }; // Basic form settings
      }

      requests.push({
        updateSettings: {
          settings: settingsUpdate,
          updateMask: "quizSettings",
        },
      });
    }

    if (requests.length === 0) {
      throw new Error("No valid settings provided for update");
    }

    try {
      const res = await this.formsApi.forms.batchUpdate({
        formId: formId,
        requestBody: {
          requests: requests,
          writeControl: { requiredRevisionId: "" },
        },
      });
      return res.data;
    } catch (error) {
      console.error(
        `API Error updating form settings for ${formId}: ${error.message}`
      );
      if (error.response && error.response.data && error.response.data.error) {
        console.error(
          "Detailed error:",
          JSON.stringify(error.response.data.error, null, 2)
        );
        throw new Error(
          `Failed to update form settings: ${error.response.data.error.message}`
        );
      }
      throw error;
    }
  }

  async createSurveyWithQuestions(title, description, questions) {
    try {
      // First create the form
      const form = await this.createForm(title, description);
      if (!form || !form.formId) {
        throw new Error("Failed to create form");
      }

      const formId = form.formId;

      // Add questions one by one
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        await this.addQuestionWithOptions(
          formId,
          question.title,
          question.type,
          question.options,
          question.required || false
        );
      }

      return {
        formId: formId,
        responderUri: `https://docs.google.com/forms/d/${formId}/viewform`,
        editUri: `https://docs.google.com/forms/d/${formId}/edit`,
      };
    } catch (error) {
      console.error(`Error creating survey with questions: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { GoogleFormsService };
