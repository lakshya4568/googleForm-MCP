const {
  McpServer,
  ResourceTemplate,
} = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { GoogleFormsService } = require("./googleFormsService.js");
const { z } = require("zod");
const { execSync } = require("child_process");
const path = require("path");
require("dotenv").config();

async function main() {
  try {
    console.log("Running authentication before starting the server...");
    // Use absolute path to auth.js relative to this file's location
    const authPath = path.join(__dirname, "..", "auth.js");
    execSync(`node "${authPath}"`, { stdio: "inherit" });
    console.log("Authentication successful.");
  } catch (error) {
    console.error("Authentication failed. Server will not start.", error);
    process.exit(1);
  }

  const server = new McpServer({
    name: "GFormMCP",
    version: "1.0.0",
    description:
      "MCP Server for Google Forms API integration, compatible with Cline.",
  });

  const formsService = new GoogleFormsService();
  await formsService.init();

  // --- Resources ---
  server.resource(
    "form-metadata",
    new ResourceTemplate("gform://{formId}/metadata", { list: undefined }),
    async (uri, { formId }) => {
      const formIdStr = Array.isArray(formId) ? formId[0] : formId;
      if (!formIdStr) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: formId is missing in the resource URI.",
            },
          ],
        };
      }
      const metadata = await formsService.getFormMetadata(formIdStr);
      if (!metadata) {
        return {
          contents: [
            { uri: uri.href, text: "Error: Form not found or access denied." },
          ],
        };
      }
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(metadata, null, 2) }],
      };
    }
  );

  server.resource(
    "form-questions",
    new ResourceTemplate("gform://{formId}/questions", { list: undefined }),
    async (uri, { formId }) => {
      const formIdStr = Array.isArray(formId) ? formId[0] : formId;
      if (!formIdStr) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: formId is missing in the resource URI.",
            },
          ],
        };
      }
      const questions = await formsService.getFormQuestions(formIdStr);
      if (!questions) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Form not found or could not retrieve questions.",
            },
          ],
        };
      }
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(questions, null, 2) }],
      };
    }
  );

  server.resource(
    "form-responses",
    new ResourceTemplate("gform://{formId}/responses", { list: undefined }),
    async (uri, { formId }) => {
      const formIdStr = Array.isArray(formId) ? formId[0] : formId;
      if (!formIdStr) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: formId is missing in the resource URI.",
            },
          ],
        };
      }
      const responses = await formsService.getFormResponses(formIdStr);
      if (!responses) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Form not found or could not retrieve responses.",
            },
          ],
        };
      }
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(responses, null, 2) }],
      };
    }
  );

  // --- Tools ---
  server.tool(
    "get-form-details",
    "Retrieves complete metadata and question structure for a Google Form including title, description, and all form items",
    {
      formId: z
        .string()
        .describe("The ID of the Google Form to retrieve details from."),
    },
    async ({ formId }) => {
      const metadata = await formsService.getFormMetadata(formId);
      const questions = await formsService.getFormQuestions(formId);
      if (!metadata || !questions) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Could not retrieve form details. Check form ID and permissions.",
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ metadata, questions }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "fetch-form-responses",
    "Fetches all responses from a Google Form and returns them in JSON or CSV format for analysis",
    {
      formId: z
        .string()
        .describe("The ID of the Google Form to fetch responses from."),
      format: z
        .enum(["json", "csv"])
        .optional()
        .default("json")
        .describe("The desired output format for the responses (json or csv)."),
    },
    async ({ formId, format }) => {
      const responsesData = await formsService.getFormResponses(formId);
      if (!responsesData) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Could not fetch responses for form ${formId}.`,
            },
          ],
          isError: true,
        };
      }
      if (format === "csv") {
        const csvData = await formsService.convertResponsesToCSV(
          responsesData,
          formId
        );
        return { content: [{ type: "text", text: csvData }] };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(responsesData, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "create-form",
    "Creates a new Google Form with the specified title and optional description, returning the form ID and URLs",
    {
      title: z.string().describe("The title of the new Google Form."),
      description: z
        .string()
        .optional()
        .describe("The description of the new Google Form (optional)."),
    },
    async ({ title, description }) => {
      const newForm = await formsService.createForm(title, description);
      if (!newForm) {
        return {
          content: [{ type: "text", text: "Error: Could not create form." }],
          isError: true,
        };
      }
      const formId = newForm.formId;
      const responderUri = `https://docs.google.com/forms/d/${formId}/viewform`;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                formId,
                title,
                description: description || "",
                responderUri,
                editUri: `https://docs.google.com/forms/d/${formId}/edit`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "add-question-to-form",
    "Adds a new question to an existing Google Form with basic question types (TEXT, CHOICE, SCALE, etc.)",
    {
      formId: z
        .string()
        .describe("The ID of the Google Form to add a question to."),
      questionTitle: z.string().describe("The title of the new question."),
      questionType: z
        .enum([
          "TEXT",
          "PARAGRAPH",
          "CHOICE",
          "RADIO",
          "CHECKBOX",
          "DROPDOWN",
          "SCALE",
        ])
        .optional()
        .default("TEXT")
        .describe("The type of question. Defaults to 'TEXT'."),
    },
    async ({ formId, questionTitle, questionType }) => {
      try {
        const updatedForm = await formsService.addQuestion(
          formId,
          questionTitle,
          questionType
        );
        if (!updatedForm) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Could not add question to form ${formId}.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(updatedForm, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error adding question: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "add-question-with-options",
    "Adds a new question to a Google Form with custom options for choice questions or labels for scale questions, with required/optional settings",
    {
      formId: z
        .string()
        .describe("The ID of the Google Form to add a question to."),
      questionTitle: z.string().describe("The title of the new question."),
      questionType: z
        .enum([
          "TEXT",
          "PARAGRAPH",
          "CHOICE",
          "RADIO",
          "CHECKBOX",
          "DROPDOWN",
          "SCALE",
        ])
        .describe("The type of question."),
      options: z
        .array(z.string())
        .optional()
        .describe(
          "Array of options for choice questions, or [lowLabel, highLabel] for scale questions."
        ),
      isRequired: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether the question is required."),
    },
    async ({ formId, questionTitle, questionType, options, isRequired }) => {
      try {
        const updatedForm = await formsService.addQuestionWithOptions(
          formId,
          questionTitle,
          questionType,
          options,
          isRequired
        );
        if (!updatedForm) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Could not add question to form ${formId}.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(updatedForm, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error adding question: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list-forms",
    "Lists all Google Forms accessible to the authenticated user with pagination support for efficient browsing",
    {
      maxResults: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of forms to return (default: 10, max: 100)."),
    },
    async ({ maxResults }) => {
      try {
        const forms = await formsService.listForms(
          Math.min(maxResults || 10, 100)
        );
        if (!forms || forms.length === 0) {
          return {
            content: [
              { type: "text", text: "No Google Forms found in your Drive." },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(forms, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error listing forms: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update-form-settings",
    "Updates the settings of an existing Google Form including title, description, email collection, and response editing permissions",
    {
      formId: z.string().describe("The ID of the Google Form to update."),
      title: z.string().optional().describe("New title for the form."),
      description: z
        .string()
        .optional()
        .describe("New description for the form."),
      collectEmail: z
        .boolean()
        .optional()
        .describe("Whether to collect respondent email addresses."),
      allowResponseEdits: z
        .boolean()
        .optional()
        .describe("Whether to allow respondents to edit their responses."),
    },
    async ({
      formId,
      title,
      description,
      collectEmail,
      allowResponseEdits,
    }) => {
      try {
        const updatedForm = await formsService.updateFormSettings(formId, {
          title,
          description,
          collectEmail,
          allowResponseEdits,
        });
        if (!updatedForm) {
          return {
            content: [
              { type: "text", text: `Error: Could not update form ${formId}.` },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(updatedForm, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error updating form: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create-survey-with-questions",
    "Creates a complete Google Form survey with multiple questions in one operation, supporting all question types and options",
    {
      title: z.string().describe("The title of the new survey."),
      description: z.string().describe("The description of the new survey."),
      questions: z
        .array(
          z.object({
            title: z.string().describe("The question title."),
            type: z
              .enum([
                "TEXT",
                "PARAGRAPH",
                "CHOICE",
                "RADIO",
                "CHECKBOX",
                "DROPDOWN",
                "SCALE",
              ])
              .describe("The question type."),
            options: z
              .array(z.string())
              .optional()
              .describe(
                "Options for choice questions or labels for scale questions."
              ),
            required: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether the question is required."),
          })
        )
        .describe("Array of questions to add to the survey."),
    },
    async ({ title, description, questions }) => {
      try {
        const result = await formsService.createSurveyWithQuestions(
          title,
          description,
          questions
        );
        if (!result) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Could not create survey with questions.",
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error creating survey: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "debug-form-structure",
    "Provides detailed debugging information about a Google Form's structure, items, and metadata for troubleshooting",
    {
      formId: z.string().describe("The ID of the Google Form to debug."),
    },
    async ({ formId }) => {
      try {
        const metadata = await formsService.getFormMetadata(formId);
        if (!metadata) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Could not retrieve form metadata for ${formId}.`,
              },
            ],
            isError: true,
          };
        }

        const debug_info = {
          formId: metadata.formId,
          title: metadata.info ? metadata.info.title : undefined,
          description: metadata.info ? metadata.info.description : undefined,
          revisionId: metadata.revisionId,
          responderUri: metadata.responderUri,
          linkedSheetId: metadata.linkedSheetId,
          settings: metadata.settings,
          itemCount: metadata.items ? metadata.items.length : 0,
          items: metadata.items
            ? metadata.items.map((item, index) => ({
                index,
                itemId: item.itemId,
                title: item.title,
                description: item.description,
                questionType: item.questionItem
                  ? Object.keys(item.questionItem.question || {}).find((key) =>
                      key.endsWith("Question")
                    )
                  : "N/A",
              }))
            : [],
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(debug_info, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error debugging form: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // --- Prompts ---
  server.prompt(
    "summarize-form-responses",
    {
      formId: z
        .string()
        .describe(
          "The ID of the Google Form whose responses need to be summarized."
        ),
    },
    ({ formId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are an AI assistant. Summarize the responses for the Google Form with ID ${formId}. 
                        First, retrieve the form responses using the 'fetch-form-responses' tool with the provided formId.
                        Then, for each question in the form (you might need to use 'get-form-details' to know the questions):
                        1. Count the total number of responses received for that question.
                        2. If the question is a multiple choice or checkbox, list the counts for each option.
                        3. If the question expects a numerical response (e.g., scale, rating, or a text question that seems to collect numbers), calculate and state the average response value. Clearly state if you are assuming a text question is numerical.
                        4. For text-based answers, provide a brief qualitative summary or common themes if possible, or state that they are open-ended text.
                        Present the summary in a clear, organized manner. Start by stating the total number of responses to the form.`,
          },
        },
      ],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server started successfully - no console output in MCP server
}

main().catch((error) => {
  console.error("Failed to start GFormMCP Server:", error);
  process.exit(1);
});
