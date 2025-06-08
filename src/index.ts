#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";

import { googleFormsService } from "./services/google-forms-service.js";
import { googleFormsAuth } from "./auth/google-auth.js";
import { 
  formatFormForDisplay, 
  formatResponseForDisplay, 
  extractFormIdFromUrl,
  calculateResponseStats,
  truncateText,
  createTextQuestionRequest,
  createChoiceQuestionRequest,
  createScaleQuestionRequest
} from "./utils/form-utils.js";

// Load environment variables
dotenv.config();

/**
 * Google Forms MCP Server
 * 
 * Provides access to Google Forms API through MCP protocol
 * Supports forms management, response retrieval, and analysis
 */
class GoogleFormsMcpServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: "google-forms-mcp-server",
      version: "1.0.0"
    });

    this.setupResources();
    this.setupTools();
    this.setupPrompts();
  }

  /**
   * Setup MCP resources
   */
  private setupResources() {
    // Form metadata resource
    this.server.resource(
      "form-metadata",
      new ResourceTemplate("forms://{formId}/metadata", { list: undefined }),
      async (uri, { formId }) => {
        try {
          const form = await googleFormsService.getForm(formId);
          const formattedForm = formatFormForDisplay(form);
          
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(formattedForm, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to get form metadata: ${error.message}`);
        }
      }
    );

    // Form questions resource
    this.server.resource(
      "form-questions",
      new ResourceTemplate("forms://{formId}/questions", { list: undefined }),
      async (uri, { formId }) => {
        try {
          const form = await googleFormsService.getForm(formId);
          const formattedForm = formatFormForDisplay(form);
          
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({
                formId: form.formId,
                title: form.info.title,
                questionCount: formattedForm.questionCount,
                questions: formattedForm.questions
              }, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to get form questions: ${error.message}`);
        }
      }
    );

    // Form responses resource
    this.server.resource(
      "form-responses",
      new ResourceTemplate("forms://{formId}/responses", { list: undefined }),
      async (uri, { formId }) => {
        try {
          const form = await googleFormsService.getForm(formId);
          const responses = await googleFormsService.getAllFormResponses(formId);
          const formattedResponses = responses.map(response => 
            formatResponseForDisplay(response, form)
          );
          
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({
                formId,
                responseCount: responses.length,
                responses: formattedResponses
              }, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to get form responses: ${error.message}`);
        }
      }
    );

    // Form summary resource
    this.server.resource(
      "form-summary",
      new ResourceTemplate("forms://{formId}/summary", { list: undefined }),
      async (uri, { formId }) => {
        try {
          const summary = await googleFormsService.getFormSummary(formId);
          const responseSummary = await googleFormsService.generateResponseSummary(formId);
          
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({
                ...summary,
                ...responseSummary
              }, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to get form summary: ${error.message}`);
        }
      }
    );
  }

  /**
   * Setup MCP tools
   */
  private setupTools() {
    // Get form details tool
    this.server.tool(
      "get-form-details",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        includeQuestions: z.boolean().optional().default(true).describe("Include question details"),
        includeSettings: z.boolean().optional().default(true).describe("Include form settings")
      },
      async ({ formId, includeQuestions, includeSettings }) => {
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;
          const form = await googleFormsService.getForm(cleanFormId);
          const formattedForm = formatFormForDisplay(form);
          
          const result: any = {
            id: form.formId,
            title: form.info.title,
            description: form.info.description,
            responderUri: form.responderUri,
            questionCount: formattedForm.questionCount
          };

          if (includeQuestions) {
            result.questions = formattedForm.questions;
          }

          if (includeSettings) {
            result.settings = formattedForm.settings;
            result.publishSettings = formattedForm.publishSettings;
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Get form responses tool
    this.server.tool(
      "get-form-responses",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        limit: z.number().optional().describe("Maximum number of responses to return"),
        format: z.enum(["json", "csv"]).optional().default("json").describe("Output format")
      },
      async ({ formId, limit, format }) => {
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;
          
          if (format === "csv") {
            const csvData = await googleFormsService.exportResponses(cleanFormId, { 
              format: "csv",
              includeTimestamps: true,
              flattenResponses: true
            });
            
            return {
              content: [{
                type: "text",
                text: csvData
              }]
            };
          }

          const form = await googleFormsService.getForm(cleanFormId);
          let responses = await googleFormsService.getAllFormResponses(cleanFormId);
          
          if (limit && limit > 0) {
            responses = responses.slice(0, limit);
          }

          const formattedResponses = responses.map(response => 
            formatResponseForDisplay(response, form)
          );

          const stats = calculateResponseStats(responses);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                formId: cleanFormId,
                formTitle: form.info.title,
                statistics: stats,
                responses: formattedResponses
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Create form tool
    this.server.tool(
      "create-form",
      {
        title: z.string().describe("Form title"),
        description: z.string().optional().describe("Form description")
      },
      async ({ title, description }) => {
        try {
          const form = await googleFormsService.createForm({
            info: { title, description }
          });

          return {
            content: [{
              type: "text",
              text: `Form created successfully!\n\nForm ID: ${form.formId}\nTitle: ${form.info.title}\nEdit URL: https://docs.google.com/forms/d/${form.formId}/edit\nPublic URL: ${form.responderUri}`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error creating form: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Add question to form tool
    this.server.tool(
      "add-question",
      {
        formId: z.string().describe("Google Forms ID"),
        questionType: z.enum(["text", "paragraph", "choice", "scale"]).describe("Type of question to add"),
        title: z.string().describe("Question title"),
        description: z.string().optional().describe("Question description"),
        required: z.boolean().optional().default(false).describe("Whether the question is required"),
        // For choice questions
        options: z.array(z.string()).optional().describe("Options for choice questions"),
        allowMultiple: z.boolean().optional().default(false).describe("Allow multiple selections for choice questions"),
        // For scale questions
        scaleMin: z.number().optional().default(1).describe("Minimum value for scale questions"),
        scaleMax: z.number().optional().default(5).describe("Maximum value for scale questions"),
        scaleMinLabel: z.string().optional().describe("Label for minimum scale value"),
        scaleMaxLabel: z.string().optional().describe("Label for maximum scale value")
      },
      async ({ 
        formId, 
        questionType, 
        title, 
        description, 
        required, 
        options, 
        allowMultiple, 
        scaleMin, 
        scaleMax, 
        scaleMinLabel, 
        scaleMaxLabel 
      }) => {
        try {
          let request: any;

          switch (questionType) {
            case "text":
              request = createTextQuestionRequest(title, description, required, false);
              break;
            case "paragraph":
              request = createTextQuestionRequest(title, description, required, true);
              break;
            case "choice":
              if (!options || options.length === 0) {
                throw new Error("Choice questions require at least one option");
              }
              request = createChoiceQuestionRequest(
                title, 
                options, 
                allowMultiple ? "CHECKBOX" : "RADIO", 
                description, 
                required
              );
              break;
            case "scale":
              request = createScaleQuestionRequest(
                title, 
                scaleMin!, 
                scaleMax!, 
                scaleMinLabel, 
                scaleMaxLabel, 
                description, 
                required
              );
              break;
            default:
              throw new Error(`Unsupported question type: ${questionType}`);
          }

          const result = await googleFormsService.batchUpdateForm(formId, {
            requests: [request]
          });

          return {
            content: [{
              type: "text",
              text: `Question added successfully!\n\nQuestion Type: ${questionType}\nTitle: ${title}\nRequired: ${required}\n\nForm Edit URL: https://docs.google.com/forms/d/${formId}/edit`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error adding question: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Export responses tool
    this.server.tool(
      "export-responses",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        format: z.enum(["json", "csv"]).default("json").describe("Export format"),
        includeMetadata: z.boolean().optional().default(true).describe("Include form metadata in export"),
        includeTimestamps: z.boolean().optional().default(true).describe("Include response timestamps"),
        flattenResponses: z.boolean().optional().default(true).describe("Flatten response structure for easier analysis")
      },
      async ({ formId, format, includeMetadata, includeTimestamps, flattenResponses }) => {
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;
          const exportData = await googleFormsService.exportResponses(cleanFormId, {
            format,
            includeMetadata,
            includeTimestamps,
            flattenResponses
          });

          return {
            content: [{
              type: "text",
              text: exportData
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error exporting responses: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Get response summary tool
    this.server.tool(
      "get-response-summary",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        includeStatistics: z.boolean().optional().default(true).describe("Include statistical analysis")
      },
      async ({ formId, includeStatistics }) => {
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;
          const summary = await googleFormsService.generateResponseSummary(cleanFormId);
          const formSummary = await googleFormsService.getFormSummary(cleanFormId);

          const result: any = {
            formInfo: formSummary,
            totalResponses: summary.totalResponses,
            responseTimeRange: summary.responseTimeRange
          };

          if (includeStatistics) {
            result.questionSummaries = summary.questionSummaries.map(q => ({
              questionId: q.questionId,
              title: truncateText(q.title, 100),
              type: q.type,
              responseCount: q.responseCount,
              responseRate: q.statistics?.responseRate ? `${q.statistics.responseRate.toFixed(1)}%` : 'N/A',
              statistics: q.statistics
            }));
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Error generating summary: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );

    // Test connection tool
    this.server.tool(
      "test-connection",
      {},
      async () => {
        try {
          const isConnected = await googleFormsService.testConnection();
          const authStatus = googleFormsAuth.getAuthStatus();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                connected: isConnected,
                authentication: authStatus,
                message: isConnected ? "Successfully connected to Google Forms API" : "Failed to connect to Google Forms API"
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Connection test failed: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Setup MCP prompts
   */
  private setupPrompts() {
    // Analyze form responses prompt
    this.server.prompt(
      "analyze-form-responses",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        focusArea: z.enum(["overview", "trends", "satisfaction", "demographics"]).optional().default("overview").describe("Analysis focus area")
      },
      ({ formId, focusArea }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the responses for Google Form ${formId}. Focus on ${focusArea} insights.

First, get the form details and response summary using the available tools, then provide:

1. **Form Overview**: Basic information about the form and response counts
2. **Response Patterns**: When do people typically respond? Any notable trends?
3. **Question Analysis**: For each question, analyze the responses and highlight key insights
4. **Key Findings**: What are the main takeaways from this data?
5. **Recommendations**: Based on the data, what actionable recommendations can you provide?

Please use the get-form-details and get-response-summary tools to gather the necessary data first.`
          }
        }]
      })
    );

    // Generate form report prompt
    this.server.prompt(
      "generate-form-report",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        reportType: z.enum(["executive", "detailed", "statistical"]).optional().default("executive").describe("Type of report to generate")
      },
      ({ formId, reportType }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Generate a ${reportType} report for Google Form ${formId}.

Please use the available tools to gather form details and response data, then create a comprehensive report including:

${reportType === "executive" ? `
**Executive Summary Report:**
- Form overview and purpose
- Key metrics (response count, completion rate)
- Top 3 insights
- Main recommendations
- Charts/data visualization suggestions
` : reportType === "detailed" ? `
**Detailed Analysis Report:**
- Complete form description
- Question-by-question analysis
- Response distribution and patterns
- Demographic breakdowns (if applicable)
- Trends over time
- Detailed recommendations
- Appendix with raw statistics
` : `
**Statistical Report:**
- Descriptive statistics for all questions
- Distribution analysis
- Correlation analysis (where applicable)
- Statistical significance tests
- Confidence intervals
- Raw data tables
`}

Format the report professionally and include data-driven insights.`
          }
        }]
      })
    );

    // Export to spreadsheet prompt
    this.server.prompt(
      "export-to-spreadsheet",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        includeAnalysis: z.boolean().optional().default(true).describe("Include analysis sheet")
      },
      ({ formId, includeAnalysis }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Export the responses from Google Form ${formId} in a format suitable for spreadsheet analysis.

Please:
1. Use the export-responses tool to get the data in CSV format
2. Provide the CSV data ready for copy-paste into a spreadsheet
3. ${includeAnalysis ? "Include suggestions for spreadsheet formulas and charts that would be useful for analysis" : "Focus on clean data export"}
4. Explain the column structure and any data formatting notes

If there are many responses, provide a sample of the data and explain how to get the full dataset.`
          }
        }]
      })
    );

    // Form optimization prompt
    this.server.prompt(
      "optimize-form",
      {
        formId: z.string().describe("Google Forms ID or URL")
      },
      ({ formId }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Analyze Google Form ${formId} and provide optimization recommendations.

Please examine:
1. **Form Structure**: Question order, types, and flow
2. **Response Data**: Completion rates, drop-off points, response quality
3. **User Experience**: Question clarity, length, mobile-friendliness
4. **Data Quality**: Missing responses, inconsistent answers, outliers

Then provide specific recommendations for:
- Improving response rates
- Enhancing data quality
- Better question design
- Streamlining the user experience
- Technical improvements

Use the available tools to gather form details and response patterns first.`
          }
        }]
      })
    );

    // Compare responses prompt
    this.server.prompt(
      "compare-responses",
      {
        formId: z.string().describe("Google Forms ID or URL"),
        comparisonType: z.enum(["time-periods", "demographics", "segments"]).optional().default("time-periods").describe("How to segment responses for comparison")
      },
      ({ formId, comparisonType }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Compare responses for Google Form ${formId} across different ${comparisonType}.

Analysis approach:
${comparisonType === "time-periods" ? `
- Compare early vs. recent responses
- Identify trends over time
- Look for seasonal patterns
- Analyze response velocity
` : comparisonType === "demographics" ? `
- Segment by demographic questions (if available)
- Compare response patterns across groups
- Identify group-specific insights
- Look for bias or representation issues
` : `
- Create meaningful segments based on response patterns
- Compare segment characteristics
- Identify outlier groups
- Analyze segment-specific needs
`}

Please use the available tools to gather the response data and provide:
1. Segmentation methodology
2. Comparative analysis
3. Key differences between segments
4. Implications and recommendations
5. Statistical significance (where applicable)`
          }
        }]
      })
    );
  }

  /**
   * Start the MCP server
   */
  async start() {
    console.log("Starting Google Forms MCP Server...");
    
    try {
      // Test authentication
      const authStatus = googleFormsAuth.getAuthStatus();
      console.log(`Authentication status: ${authStatus.type} (${authStatus.isConfigured ? 'configured' : 'not configured'})`);
      
      if (!authStatus.isConfigured) {
        console.warn("Warning: Google Forms authentication not configured. Some features may not work.");
        console.warn("Please set up authentication using one of these methods:");
        console.warn("1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable");
        console.warn("2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables");
        console.warn("3. Place credentials.json file in the project root");
      }

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log("Google Forms MCP Server is running");
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GoogleFormsMcpServer();
  server.start().catch(console.error);
}

export default GoogleFormsMcpServer;
