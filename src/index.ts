#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config(); // Call config immediately

import {
  McpServer,
  ResourceTemplate,
  // PromptParameterShape, // Removed
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  McpError,
  ResourceContents, // Correct
  ToolResult, // Assuming this is correct as per typescript.md
  ContentPart,  // Assuming this is correct as per typescript.md
  // ServerRequest, // Removed
  // ServerNotification, // Removed
  Variables, // Added for resource callback
  RequestHandlerExtra, // Added for tool/prompt/resource callbacks
  Prompt, // Added for prompt callback return type
  ListedResource, // Added for list callback in ResourceTemplate
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny, ZodRawShape } from "zod"; // Import ZodTypeAny for prompt args

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
  createScaleQuestionRequest,
  FormSummary // Assuming this type exists in form-utils or a relevant types file
} from "./utils/form-utils.js";

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
      version: "1.0.0",
    });

    this.setupResources();
    this.setupTools();
    this.setupPrompts();
  }

  // Resource helper methods
  private async getFormMetadataContents(formId: string): Promise<ResourceContents> {
    const form = await googleFormsService.getForm(formId);
    return {
      uri: `forms://metadata/${formId}`, // Added URI
      contents: [{ type: "json", data: { id: form.formId, title: form.info.title, description: form.info.description } } as ContentPart]
    };
  }

  private async getFormQuestionsContents(formId: string): Promise<ResourceContents> {
    const form = await googleFormsService.getForm(formId);
    return {
      uri: `forms://questions/${formId}`, // Added URI
      contents: [{ type: "json", data: formatFormForDisplay(form).questions } as ContentPart]
    };
  }

  private async getFormResponsesContents(formId: string): Promise<ResourceContents> {
    const responses = await googleFormsService.getAllFormResponses(formId);
    return {
      uri: `forms://responses/${formId}`, // Added URI
      contents: [{ type: "json", data: responses.map(r => formatResponseForDisplay(r)) } as ContentPart]
    };
  }

  private async getFormSummaryContents(formId: string): Promise<ResourceContents> {
    const summary: FormSummary = await googleFormsService.getFormSummary(formId); // Added type annotation
    return {
      uri: `forms://summary/${formId}`, // Added URI
      contents: [{ type: "json", data: summary } as ContentPart]
    };
  }

  /**
   * Setup MCP resources
   */
  private setupResources(): void {
    const formIdVariableKey = "formId";

    // Form Metadata Resource
    this.server.resource(
      "form-metadata",
      new ResourceTemplate(`forms://metadata/{${formIdVariableKey}}`, {
        list: async (): Promise<{ resources: ListedResource[] }> => ([ // Corrected list return type
          { uri: `forms://metadata/{${formIdVariableKey}}`, name: "Form Metadata (requires formId)", description: "Get metadata for a Google Form" }
        ]).map(r => ({...r, uri: r.uri.replace(`{${formIdVariableKey}}`,':formId')})) // Replace placeholder for listing if needed, or provide concrete examples
        .map(r => ({...r, resources: undefined, resource: r})) // SDK expects { resources: [] }
        .reduce((acc, curr) => ({resources: [...acc.resources, curr.resource]}), {resources: []})
      }),
      async (variables: Variables, uri: URL, extra: RequestHandlerExtra): Promise<ResourceContents> => {
        const formId = variables[formIdVariableKey] as string;
        if (!formId) {
          throw new McpError(ErrorCode.InvalidParams, "formId parameter is required.");
        }
        try {
          return await this.getFormMetadataContents(formId);
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error.message}`);
        }
      }
    );

    // Form Questions Resource
    this.server.resource(
      "form-questions",
      new ResourceTemplate(`forms://questions/{${formIdVariableKey}}`, {
        list: async (): Promise<{ resources: ListedResource[] }> => ([
          { uri: `forms://questions/{${formIdVariableKey}}`, name: "Form Questions (requires formId)", description: "Get questions from a Google Form" }
        ]).map(r => ({...r, uri: r.uri.replace(`{${formIdVariableKey}}`,':formId')}))
        .map(r => ({...r, resources: undefined, resource: r})) 
        .reduce((acc, curr) => ({resources: [...acc.resources, curr.resource]}), {resources: []})
      }),
      async (variables: Variables, uri: URL, extra: RequestHandlerExtra): Promise<ResourceContents> => {
        const formId = variables[formIdVariableKey] as string;
        if (!formId) {
          throw new McpError(ErrorCode.InvalidParams, "formId parameter is required.");
        }
        try {
          return await this.getFormQuestionsContents(formId);
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error.message}`);
        }
      }
    );

    // Form Responses Resource
    this.server.resource(
      "form-responses",
      new ResourceTemplate(`forms://responses/{${formIdVariableKey}}`, {
        list: async (): Promise<{ resources: ListedResource[] }> => ([
          { uri: `forms://responses/{${formIdVariableKey}}`, name: "Form Responses (requires formId)", description: "Get responses from a Google Form" }
        ]).map(r => ({...r, uri: r.uri.replace(`{${formIdVariableKey}}`,':formId')}))
        .map(r => ({...r, resources: undefined, resource: r}))
        .reduce((acc, curr) => ({resources: [...acc.resources, curr.resource]}), {resources: []})
      }),
      async (variables: Variables, uri: URL, extra: RequestHandlerExtra): Promise<ResourceContents> => {
        const formId = variables[formIdVariableKey] as string;
        if (!formId) {
          throw new McpError(ErrorCode.InvalidParams, "formId parameter is required.");
        }
        try {
          return await this.getFormResponsesContents(formId);
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error.message}`);
        }
      }
    );

    // Form Summary Resource
    this.server.resource(
      "form-summary",
      new ResourceTemplate(`forms://summary/{${formIdVariableKey}}`, {
        list: async (): Promise<{ resources: ListedResource[] }> => ([
          { uri: `forms://summary/{${formIdVariableKey}}`, name: "Form Summary (requires formId)", description: "Get summary analytics for a Google Form" }
        ]).map(r => ({...r, uri: r.uri.replace(`{${formIdVariableKey}}`,':formId')}))
        .map(r => ({...r, resources: undefined, resource: r}))
        .reduce((acc, curr) => ({resources: [...acc.resources, curr.resource]}), {resources: []})
      }),
      async (variables: Variables, uri: URL, extra: RequestHandlerExtra): Promise<ResourceContents> => {
        const formId = variables[formIdVariableKey] as string;
        if (!formId) {
          throw new McpError(ErrorCode.InvalidParams, "formId parameter is required.");
        }
        try {
          return await this.getFormSummaryContents(formId);
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error.message}`);
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
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        includeQuestions: z.boolean().optional().default(true).describe("Include question details"),
        includeSettings: z.boolean().optional().default(true).describe("Include form settings")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const { formId, includeQuestions, includeSettings } = args;
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
              type: "json",
              data: result
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Get form responses tool
    this.server.tool(
      "get-form-responses",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        limit: z.number().optional().describe("Maximum number of responses to return"),
        format: z.enum(["json", "csv"]).optional().default("json").describe("Output format")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const { formId, limit, format } = args;
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;

          if (format === "csv") {
            const csvData = await googleFormsService.exportResponses(cleanFormId, {
              format: "csv",
              includeTimestamps: true,
              flattenResponses: true
            });

            return {
              content: [{ type: "text", text: csvData } as ContentPart]
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
              type: "json",
              data: {
                formId: cleanFormId,
                formTitle: form.info.title,
                statistics: stats,
                responses: formattedResponses
              }
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Create form tool
    this.server.tool(
      "create-form",
      z.object({
        title: z.string().describe("Form title"),
        description: z.string().optional().describe("Form description")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const { title, description } = args;
        try {
          const form = await googleFormsService.createForm({
            info: { title, description }
          });

          return {
            content: [{
              type: "text",
              text: `Form created successfully!\n\nForm ID: ${form.formId}\nTitle: ${form.info.title}\nEdit URL: https://docs.google.com/forms/d/${form.formId}/edit\nPublic URL: ${form.responderUri}`
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error creating form: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Add question to form tool
    this.server.tool(
      "add-question",
      z.object({
        formId: z.string().describe("Google Forms ID"),
        questionType: z.enum(["text", "paragraph", "choice", "scale"]).describe("Type of question to add"),
        title: z.string().describe("Question title"),
        description: z.string().optional().describe("Question description"),
        required: z.boolean().optional().default(false).describe("Whether the question is required"),
        options: z.array(z.string()).optional().describe("Options for choice questions"),
        allowMultiple: z.boolean().optional().default(false).describe("Allow multiple selections for choice questions"),
        scaleMin: z.number().optional().default(1).describe("Minimum value for scale questions"),
        scaleMax: z.number().optional().default(5).describe("Maximum value for scale questions"),
        scaleMinLabel: z.string().optional().describe("Label for minimum scale value"),
        scaleMaxLabel: z.string().optional().describe("Label for maximum scale value")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const {
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
        } = args;
        try {
          let request: any; // Consider defining a more specific type if possible

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
                scaleMin!, // Non-null assertion, ensure default handles it
                scaleMax!, // Non-null assertion, ensure default handles it
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
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error adding question: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Export responses tool
    this.server.tool(
      "export-responses",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        format: z.enum(["json", "csv"]).default("json").describe("Export format"),
        includeMetadata: z.boolean().optional().default(true).describe("Include form metadata in export"),
        includeTimestamps: z.boolean().optional().default(true).describe("Include response timestamps"),
        flattenResponses: z.boolean().optional().default(true).describe("Flatten response structure for easier analysis")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const { formId, format, includeMetadata, includeTimestamps, flattenResponses } = args;
        try {
          const cleanFormId = extractFormIdFromUrl(formId) || formId;
          const exportData = await googleFormsService.exportResponses(cleanFormId, {
            format,
            includeMetadata,
            includeTimestamps,
            flattenResponses
          });

          if (format === "json") {
            try {
              const jsonData = typeof exportData === 'string' ? JSON.parse(exportData) : exportData;
              return { content: [{ type: "json", data: jsonData } as ContentPart] };
            } catch (e) {
              return { content: [{ type: "text", text: typeof exportData === 'string' ? exportData : JSON.stringify(exportData) } as ContentPart] };
            }
          }

          return { // For CSV
            content: [{
              type: "text",
              text: exportData as string
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error exporting responses: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Get response summary tool
    this.server.tool(
      "get-response-summary",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        includeStatistics: z.boolean().optional().default(true).describe("Include statistical analysis")
      }),
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra
        const { formId, includeStatistics } = args;
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
              type: "json",
              data: result
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error generating summary: ${error.message}` } as ContentPart],
            isError: true
          };
        }
      }
    );

    // Test connection tool
    this.server.tool(
      "test-connection",
      z.object({}), // No arguments
      async (args, extra: RequestHandlerExtra): Promise<ToolResult> => { // Added extra (args will be empty object)
        try {
          const isConnected = await googleFormsService.testConnection();
          const authStatus = googleFormsAuth.getAuthStatus();

          return {
            content: [{
              type: "json",
              data: {
                connected: isConnected,
                authentication: authStatus,
                message: isConnected ? "Successfully connected to Google Forms API" : "Failed to connect to Google Forms API"
              }
            } as ContentPart]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Connection test failed: ${error.message}` } as ContentPart],
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
      z.object({ // Direct Zod schema
        formId: z.string().describe("Google Forms ID or URL"),
        focusArea: z.enum(["overview", "trends", "satisfaction", "demographics"]).optional().default("overview").describe("Analysis focus area")
      }),
      (args, extra: RequestHandlerExtra): Prompt => { // Added extra, return type Prompt
        return { // Explicit return
          messages: [{
            role: "user",
            content: [{ // content is an array of ContentPart
              type: "text",
              text: `Please analyze the responses for Google Form ${args.formId}. Focus on ${args.focusArea} insights.

First, get the form details and response summary using the available tools, then provide:

1. **Form Overview**: Basic information about the form and response counts
2. **Response Patterns**: When do people typically respond? Any notable trends?
3. **Question Analysis**: For each question, analyze the responses and highlight key insights
4. **Key Findings**: What are the main takeaways from this data?
5. **Recommendations**: Based on the data, what actionable recommendations can you provide?

Please use the get-form-details and get-response-summary tools to gather the necessary data first.`
            } as ContentPart]
          }]
        };
      }
    );

    // Generate form report prompt
    this.server.prompt(
      "generate-form-report",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        reportType: z.enum(["executive", "detailed", "statistical"]).optional().default("executive").describe("Type of report to generate")
      }),
      (args, extra: RequestHandlerExtra): Prompt => { // Added extra, return type Prompt
        return { // Explicit return
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: `Generate a ${args.reportType} report for Google Form ${args.formId}.

Please use the available tools to gather form details and response data, then create a comprehensive report including:

${args.reportType === "executive" ? `
**Executive Summary Report:**
- Form overview and purpose
- Key metrics (response count, completion rate)
- Top 3 insights
- Main recommendations
- Charts/data visualization suggestions
` : args.reportType === "detailed" ? `
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
            } as ContentPart]
          }]
        };
      }
    );

    // Export to spreadsheet prompt
    this.server.prompt(
      "export-to-spreadsheet",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        includeAnalysis: z.boolean().optional().default(true).describe("Include analysis sheet")
      }),
      (args, extra: RequestHandlerExtra): Prompt => { // Added extra, return type Prompt
        return { // Explicit return
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: `Export the responses from Google Form ${args.formId} in a format suitable for spreadsheet analysis.

Please:
1. Use the export-responses tool to get the data in CSV format
2. Provide the CSV data ready for copy-paste into a spreadsheet
3. ${args.includeAnalysis ? "Include suggestions for spreadsheet formulas and charts that would be useful for analysis" : "Focus on clean data export"}
4. Explain the column structure and any data formatting notes

If there are many responses, provide a sample of the data and explain how to get the full dataset.`
            } as ContentPart]
          }]
        };
      }
    );

    // Form optimization prompt
    this.server.prompt(
      "optimize-form",
      z.object({
        formId: z.string().describe("Google Forms ID or URL")
      }),
      (args, extra: RequestHandlerExtra): Prompt => { // Added extra, return type Prompt
        return { // Explicit return
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: `Analyze Google Form ${args.formId} and provide optimization recommendations.

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
            } as ContentPart]
          }]
        };
      }
    );

    // Compare responses prompt
    this.server.prompt(
      "compare-responses",
      z.object({
        formId: z.string().describe("Google Forms ID or URL"),
        comparisonType: z.enum(["time-periods", "demographics", "segments"]).optional().default("time-periods").describe("How to segment responses for comparison")
      }),
      (args, extra: RequestHandlerExtra): Prompt => { // Added extra, return type Prompt
        return { // Explicit return
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: `Compare responses for Google Form ${args.formId} across different ${args.comparisonType}.

Analysis approach:
${args.comparisonType === "time-periods" ? `
- Compare early vs. recent responses
- Identify trends over time
- Look for seasonal patterns
- Analyze response velocity
` : args.comparisonType === "demographics" ? `
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
            } as ContentPart]
          }]
        };
      }
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // connect over stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Google Forms MCP server is up and running");
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GoogleFormsMcpServer();
  server.start().catch(console.error);
}

export default GoogleFormsMcpServer;
