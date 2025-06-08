import { forms_v1, google } from 'googleapis';
import { googleFormsAuth } from '../auth/google-auth.js';
import type {
  Form,
  FormResponse,
  ListFormResponsesResponse,
  CreateFormRequest,
  UpdateFormRequest,
  BatchUpdateFormRequest,
  BatchUpdateFormResponse,
  FormSummary,
  ResponseSummary,
  QuestionSummary,
  QuestionStatistics,
  ExportOptions
} from '../types/forms.js';

/**
 * Google Forms API service wrapper
 */
export class GoogleFormsService {
  private formsApi: forms_v1.Forms | null = null;
  private rateLimitDelay = 100; // milliseconds between requests

  constructor() {
    this.initializeApi();
  }

  /**
   * Initialize the Google Forms API client
   */
  private async initializeApi() {
    try {
      const authClient = await googleFormsAuth.getAuthClient();
      this.formsApi = google.forms({ version: 'v1', auth: authClient });
    } catch (error) {
      console.error('Failed to initialize Google Forms API:', error);
      throw error;
    }
  }

  /**
   * Ensure API is initialized
   */
  private async ensureInitialized() {
    if (!this.formsApi) {
      await this.initializeApi();
    }
    
    if (!this.formsApi) {
      throw new Error('Google Forms API not initialized');
    }
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit() {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Get a form by ID
   */
  async getForm(formId: string): Promise<Form> {
    await this.ensureInitialized();
    await this.rateLimit();

    try {
      const response = await this.formsApi!.forms.get({ formId });
      return response.data as Form;
    } catch (error: any) {
      console.error(`Error getting form ${formId}:`, error);
      throw new Error(`Failed to get form: ${error.message}`);
    }
  }

  /**
   * Create a new form
   */
  async createForm(request: CreateFormRequest): Promise<Form> {
    await this.ensureInitialized();
    await this.rateLimit();

    try {
      const response = await this.formsApi!.forms.create({
        requestBody: {
          info: request.info
        }
      });
      return response.data as Form;
    } catch (error: any) {
      console.error('Error creating form:', error);
      throw new Error(`Failed to create form: ${error.message}`);
    }
  }

  /**
   * Update a form using batch update
   */
  async batchUpdateForm(formId: string, request: BatchUpdateFormRequest): Promise<BatchUpdateFormResponse> {
    await this.ensureInitialized();
    await this.rateLimit();

    try {
      const response = await this.formsApi!.forms.batchUpdate({
        formId,
        requestBody: request
      });
      return response.data as BatchUpdateFormResponse;
    } catch (error: any) {
      console.error(`Error updating form ${formId}:`, error);
      throw new Error(`Failed to update form: ${error.message}`);
    }
  }

  /**
   * Get form responses
   */
  async getFormResponses(formId: string, pageToken?: string): Promise<ListFormResponsesResponse> {
    await this.ensureInitialized();
    await this.rateLimit();

    try {
      const response = await this.formsApi!.forms.responses.list({
        formId,
        pageToken
      });
      return response.data as ListFormResponsesResponse;
    } catch (error: any) {
      console.error(`Error getting responses for form ${formId}:`, error);
      throw new Error(`Failed to get form responses: ${error.message}`);
    }
  }

  /**
   * Get all form responses (handles pagination)
   */
  async getAllFormResponses(formId: string): Promise<FormResponse[]> {
    const allResponses: FormResponse[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const response = await this.getFormResponses(formId, pageToken);
      if (response.responses) {
        allResponses.push(...response.responses);
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    return allResponses;
  }

  /**
   * Get a single form response
   */
  async getFormResponse(formId: string, responseId: string): Promise<FormResponse> {
    await this.ensureInitialized();
    await this.rateLimit();

    try {
      const response = await this.formsApi!.forms.responses.get({
        formId,
        responseId
      });
      return response.data as FormResponse;
    } catch (error: any) {
      console.error(`Error getting response ${responseId} for form ${formId}:`, error);
      throw new Error(`Failed to get form response: ${error.message}`);
    }
  }

  /**
   * Get form metadata summary
   */
  async getFormSummary(formId: string): Promise<FormSummary> {
    const form = await this.getForm(formId);
    const responses = await this.getFormResponses(formId);

    const questionCount = form.items?.filter(item => item.questionItem).length || 0;
    const responseCount = responses.responses?.length || 0;

    let lastResponseTime: string | undefined;
    if (responses.responses && responses.responses.length > 0) {
      const sortedResponses = responses.responses.sort((a, b) => {
        const timeA = new Date(a.lastSubmittedTime || a.createTime || 0).getTime();
        const timeB = new Date(b.lastSubmittedTime || b.createTime || 0).getTime();
        return timeB - timeA;
      });
      lastResponseTime = sortedResponses[0].lastSubmittedTime || sortedResponses[0].createTime;
    }

    return {
      formId: form.formId!,
      title: form.info.title,
      description: form.info.description,
      responseCount,
      questionCount,
      lastResponseTime
    };
  }

  /**
   * Generate response summary with statistics
   */
  async generateResponseSummary(formId: string): Promise<ResponseSummary> {
    const form = await this.getForm(formId);
    const allResponses = await this.getAllFormResponses(formId);

    const questionSummaries: QuestionSummary[] = [];
    const responseTimes: string[] = [];

    // Collect response times
    allResponses.forEach(response => {
      if (response.lastSubmittedTime) {
        responseTimes.push(response.lastSubmittedTime);
      } else if (response.createTime) {
        responseTimes.push(response.createTime);
      }
    });

    // Process each question
    form.items?.forEach(item => {
      if (item.questionItem?.question) {
        const question = item.questionItem.question;
        const questionId = question.questionId!;
        
        const summary = this.analyzeQuestionResponses(
          question,
          item.title || 'Untitled Question',
          questionId,
          allResponses
        );
        
        if (summary) {
          questionSummaries.push(summary);
        }
      }
    });

    const responseTimeRange = responseTimes.length > 0 ? {
      earliest: responseTimes.sort()[0],
      latest: responseTimes.sort().reverse()[0]
    } : undefined;

    return {
      totalResponses: allResponses.length,
      questionSummaries,
      responseTimeRange
    };
  }

  /**
   * Analyze responses for a specific question
   */
  private analyzeQuestionResponses(
    question: any,
    title: string,
    questionId: string,
    responses: FormResponse[]
  ): QuestionSummary | null {
    const answersForQuestion = responses
      .map(response => response.answers[questionId])
      .filter(answer => answer);

    const responseCount = answersForQuestion.length;
    const responseRate = responses.length > 0 ? (responseCount / responses.length) * 100 : 0;

    // Determine question type
    let questionType = 'unknown';
    let statistics: QuestionStatistics = { responseRate };

    if (question.choiceQuestion) {
      questionType = question.choiceQuestion.type.toLowerCase();
      statistics.choiceDistribution = this.analyzeChoiceQuestion(answersForQuestion);
    } else if (question.scaleQuestion) {
      questionType = 'scale';
      statistics = { ...statistics, ...this.analyzeScaleQuestion(answersForQuestion) };
    } else if (question.textQuestion) {
      questionType = question.textQuestion.paragraph ? 'paragraph' : 'short_answer';
      statistics = { ...statistics, ...this.analyzeTextQuestion(answersForQuestion) };
    } else if (question.dateQuestion) {
      questionType = 'date';
    } else if (question.timeQuestion) {
      questionType = 'time';
    } else if (question.fileUploadQuestion) {
      questionType = 'file_upload';
    } else if (question.ratingQuestion) {
      questionType = 'rating';
      statistics = { ...statistics, ...this.analyzeRatingQuestion(answersForQuestion) };
    }

    return {
      questionId,
      title,
      type: questionType,
      responseCount,
      statistics
    };
  }

  /**
   * Analyze choice question responses
   */
  private analyzeChoiceQuestion(answers: any[]): { [option: string]: number } {
    const distribution: { [option: string]: number } = {};

    answers.forEach(answer => {
      if (answer.textAnswers?.answers) {
        answer.textAnswers.answers.forEach((textAnswer: any) => {
          const value = textAnswer.value;
          distribution[value] = (distribution[value] || 0) + 1;
        });
      }
    });

    return distribution;
  }

  /**
   * Analyze scale question responses
   */
  private analyzeScaleQuestion(answers: any[]): Partial<QuestionStatistics> {
    const values = answers
      .map(answer => answer.textAnswers?.answers?.[0]?.value)
      .filter(value => value !== undefined)
      .map(value => parseInt(value, 10))
      .filter(value => !isNaN(value));

    if (values.length === 0) {
      return {};
    }

    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      average,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  /**
   * Analyze text question responses
   */
  private analyzeTextQuestion(answers: any[]): Partial<QuestionStatistics> {
    const texts = answers
      .map(answer => answer.textAnswers?.answers?.[0]?.value)
      .filter(value => value !== undefined && value !== '');

    if (texts.length === 0) {
      return {};
    }

    const totalLength = texts.reduce((acc, text) => acc + text.length, 0);
    const averageLength = totalLength / texts.length;

    // Simple word frequency analysis
    const wordCounts: { [word: string]: number } = {};
    texts.forEach(text => {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2); // Filter out very short words
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    // Get top 10 most common words
    const commonWords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((acc, [word, count]) => {
        acc[word] = count;
        return acc;
      }, {} as { [word: string]: number });

    return {
      averageLength,
      commonWords
    };
  }

  /**
   * Analyze rating question responses
   */
  private analyzeRatingQuestion(answers: any[]): Partial<QuestionStatistics> {
    return this.analyzeScaleQuestion(answers); // Same analysis as scale questions
  }

  /**
   * Export responses in different formats
   */
  async exportResponses(formId: string, options: ExportOptions = { format: 'json' }): Promise<string> {
    const form = await this.getForm(formId);
    const responses = await this.getAllFormResponses(formId);

    if (options.format === 'json') {
      return this.exportAsJson(form, responses, options);
    } else if (options.format === 'csv') {
      return this.exportAsCsv(form, responses, options);
    }

    throw new Error(`Unsupported export format: ${options.format}`);
  }

  /**
   * Export responses as JSON
   */
  private exportAsJson(form: Form, responses: FormResponse[], options: ExportOptions): string {
    const data: any = {};

    if (options.includeMetadata) {
      data.metadata = {
        formId: form.formId,
        title: form.info.title,
        description: form.info.description,
        exportedAt: new Date().toISOString(),
        totalResponses: responses.length
      };
    }

    if (options.flattenResponses) {
      data.responses = responses.map(response => {
        const flattened: any = {
          responseId: response.responseId,
          respondentEmail: response.respondentEmail
        };

        if (options.includeTimestamps) {
          flattened.createTime = response.createTime;
          flattened.lastSubmittedTime = response.lastSubmittedTime;
        }

        // Flatten answers
        Object.entries(response.answers).forEach(([questionId, answer]) => {
          const question = this.findQuestionById(form, questionId);
          const questionTitle = question?.title || `Question_${questionId}`;
          
          if (answer.textAnswers?.answers) {
            if (answer.textAnswers.answers.length === 1) {
              flattened[questionTitle] = answer.textAnswers.answers[0].value;
            } else {
              flattened[questionTitle] = answer.textAnswers.answers.map(a => a.value);
            }
          }
        });

        return flattened;
      });
    } else {
      data.responses = responses;
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export responses as CSV
   */
  private exportAsCsv(form: Form, responses: FormResponse[], options: ExportOptions): string {
    const headers: string[] = ['responseId'];
    
    if (options.includeTimestamps) {
      headers.push('createTime', 'lastSubmittedTime');
    }
    
    headers.push('respondentEmail');

    // Add question headers
    const questions = form.items?.filter(item => item.questionItem?.question) || [];
    questions.forEach(item => {
      const title = item.title || `Question_${item.questionItem!.question.questionId}`;
      headers.push(title.replace(/,/g, ';')); // Replace commas to avoid CSV issues
    });

    const rows: string[] = [headers.join(',')];

    responses.forEach(response => {
      const row: string[] = [response.responseId];
      
      if (options.includeTimestamps) {
        row.push(response.createTime || '', response.lastSubmittedTime || '');
      }
      
      row.push(response.respondentEmail || '');

      questions.forEach(item => {
        const questionId = item.questionItem!.question.questionId!;
        const answer = response.answers[questionId];
        
        if (answer?.textAnswers?.answers) {
          const values = answer.textAnswers.answers.map(a => a.value).join('; ');
          row.push(`"${values.replace(/"/g, '""')}"`); // Escape quotes
        } else {
          row.push('');
        }
      });

      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Find a question by ID in the form
   */
  private findQuestionById(form: Form, questionId: string): any {
    return form.items?.find(item => 
      item.questionItem?.question.questionId === questionId
    );
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

/**
 * Global service instance
 */
export const googleFormsService = new GoogleFormsService();
