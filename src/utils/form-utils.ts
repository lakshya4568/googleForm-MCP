import type { Form, Item, Question, FormResponse } from '../types/forms.js';

/**
 * Utility functions for Google Forms data processing
 */

/**
 * Extract all questions from a form
 */
export function extractQuestions(form: Form): Array<{ item: Item; question: Question }> {
  const questions: Array<{ item: Item; question: Question }> = [];
  
  if (form.items) {
    form.items.forEach(item => {
      if (item.questionItem?.question) {
        questions.push({
          item,
          question: item.questionItem.question
        });
      }
    });
  }
  
  return questions;
}

/**
 * Get question type as a human-readable string
 */
export function getQuestionType(question: Question): string {
  if (question.choiceQuestion) {
    return question.choiceQuestion.type.toLowerCase().replace('_', ' ');
  }
  if (question.textQuestion) {
    return question.textQuestion.paragraph ? 'paragraph text' : 'short answer';
  }
  if (question.scaleQuestion) {
    return 'linear scale';
  }
  if (question.dateQuestion) {
    return 'date';
  }
  if (question.timeQuestion) {
    return 'time';
  }
  if (question.fileUploadQuestion) {
    return 'file upload';
  }
  if (question.ratingQuestion) {
    return 'rating';
  }
  if (question.rowQuestion) {
    return 'grid row';
  }
  
  return 'unknown';
}

/**
 * Get question details for display
 */
export function getQuestionDetails(item: Item, question: Question): any {
  const details: any = {
    id: question.questionId,
    title: item.title || 'Untitled Question',
    description: item.description,
    type: getQuestionType(question),
    required: question.required || false
  };

  // Add type-specific details
  if (question.choiceQuestion) {
    details.options = question.choiceQuestion.options?.map(option => ({
      value: option.value,
      isOther: option.isOther || false
    })) || [];
    details.allowMultiple = question.choiceQuestion.type === 'CHECKBOX';
    details.shuffle = question.choiceQuestion.shuffle || false;
  }

  if (question.scaleQuestion) {
    details.scale = {
      low: question.scaleQuestion.low,
      high: question.scaleQuestion.high,
      lowLabel: question.scaleQuestion.lowLabel,
      highLabel: question.scaleQuestion.highLabel
    };
  }

  if (question.dateQuestion) {
    details.includeTime = question.dateQuestion.includeTime || false;
    details.includeYear = question.dateQuestion.includeYear || false;
  }

  if (question.timeQuestion) {
    details.duration = question.timeQuestion.duration || false;
  }

  if (question.fileUploadQuestion) {
    details.fileUpload = {
      allowedTypes: question.fileUploadQuestion.types || [],
      maxFiles: question.fileUploadQuestion.maxFiles,
      maxFileSize: question.fileUploadQuestion.maxFileSize,
      folderId: question.fileUploadQuestion.folderId
    };
  }

  if (question.ratingQuestion) {
    details.rating = {
      scaleLevel: question.ratingQuestion.ratingScaleLevel,
      iconType: question.ratingQuestion.iconType
    };
  }

  if (question.grading) {
    details.grading = {
      pointValue: question.grading.pointValue,
      hasCorrectAnswers: !!question.grading.correctAnswers,
      hasFeedback: !!(question.grading.whenRight || question.grading.whenWrong || question.grading.generalFeedback)
    };
  }

  return details;
}

/**
 * Format form for display
 */
export function formatFormForDisplay(form: Form): any {
  const questions = extractQuestions(form);
  
  return {
    id: form.formId,
    title: form.info.title,
    description: form.info.description,
    documentTitle: form.info.documentTitle,
    responderUri: form.responderUri,
    linkedSheetId: form.linkedSheetId,
    revisionId: form.revisionId,
    settings: {
      isQuiz: form.settings?.quizSettings?.isQuiz || false,
      emailCollection: form.settings?.emailCollectionType || 'NOT_COLLECTED'
    },
    publishSettings: {
      isPublished: form.publishSettings?.publishState?.isPublished || false,
      acceptingResponses: form.publishSettings?.publishState?.isAcceptingResponses || false
    },
    questionCount: questions.length,
    questions: questions.map(({ item, question }) => getQuestionDetails(item, question))
  };
}

/**
 * Format response for display
 */
export function formatResponseForDisplay(response: FormResponse, form?: Form): any {
  const formatted: any = {
    id: response.responseId,
    formId: response.formId,
    respondentEmail: response.respondentEmail,
    createTime: response.createTime,
    lastSubmittedTime: response.lastSubmittedTime,
    totalScore: response.totalScore,
    answers: {}
  };

  // Format answers with question context if form is provided
  Object.entries(response.answers).forEach(([questionId, answer]) => {
    let questionTitle = questionId;
    
    if (form) {
      const questionItem = form.items?.find(item => 
        item.questionItem?.question.questionId === questionId
      );
      questionTitle = questionItem?.title || questionId;
    }

    const formattedAnswer: any = {
      questionId
    };

    if (answer.textAnswers?.answers) {
      formattedAnswer.values = answer.textAnswers.answers.map(a => a.value);
      if (formattedAnswer.values.length === 1) {
        formattedAnswer.value = formattedAnswer.values[0];
      }
    }

    if (answer.fileUploadAnswers?.answers) {
      formattedAnswer.files = answer.fileUploadAnswers.answers.map(file => ({
        fileId: file.fileId,
        fileName: file.fileName,
        mimeType: file.mimeType
      }));
    }

    if (answer.grade) {
      formattedAnswer.grade = {
        score: answer.grade.score,
        correct: answer.grade.correct,
        feedback: answer.grade.feedback?.text
      };
    }

    formatted.answers[questionTitle] = formattedAnswer;
  });

  return formatted;
}

/**
 * Validate form ID format
 */
export function isValidFormId(formId: string): boolean {
  // Google Forms IDs are typically 44 characters long and contain alphanumeric characters, hyphens, and underscores
  const formIdRegex = /^[a-zA-Z0-9_-]{20,}$/;
  return formIdRegex.test(formId);
}

/**
 * Extract form ID from various URL formats
 */
export function extractFormIdFromUrl(url: string): string | null {
  const patterns = [
    // https://docs.google.com/forms/d/FORM_ID/edit
    // https://docs.google.com/forms/d/FORM_ID/viewform
    /\/forms\/d\/([a-zA-Z0-9_-]+)/,
    // https://forms.gle/FORM_ID
    /forms\.gle\/([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If no pattern matches, check if the input is already a form ID
  if (isValidFormId(url)) {
    return url;
  }

  return null;
}

/**
 * Generate question creation requests for batch update
 */
export function createTextQuestionRequest(
  title: string,
  description?: string,
  required = false,
  paragraph = false
): any {
  return {
    createItem: {
      item: {
        title,
        description,
        questionItem: {
          question: {
            required,
            textQuestion: {
              paragraph
            }
          }
        }
      },
      location: {
        index: 0
      }
    }
  };
}

export function createChoiceQuestionRequest(
  title: string,
  options: string[],
  type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN' = 'RADIO',
  description?: string,
  required = false,
  shuffle = false
): any {
  return {
    createItem: {
      item: {
        title,
        description,
        questionItem: {
          question: {
            required,
            choiceQuestion: {
              type,
              options: options.map(value => ({ value })),
              shuffle
            }
          }
        }
      },
      location: {
        index: 0
      }
    }
  };
}

export function createScaleQuestionRequest(
  title: string,
  low: number,
  high: number,
  lowLabel?: string,
  highLabel?: string,
  description?: string,
  required = false
): any {
  return {
    createItem: {
      item: {
        title,
        description,
        questionItem: {
          question: {
            required,
            scaleQuestion: {
              low,
              high,
              lowLabel,
              highLabel
            }
          }
        }
      },
      location: {
        index: 0
      }
    }
  };
}

/**
 * Format error messages for user display
 */
export function formatApiError(error: any): string {
  if (error.response?.data?.error) {
    const apiError = error.response.data.error;
    return `Google Forms API Error: ${apiError.message} (Code: ${apiError.code})`;
  }
  
  if (error.message) {
    return `Error: ${error.message}`;
  }
  
  return 'An unknown error occurred';
}

/**
 * Calculate response statistics
 */
export function calculateResponseStats(responses: FormResponse[]): any {
  if (responses.length === 0) {
    return {
      total: 0,
      responseRate: 0,
      averageCompletionTime: null
    };
  }

  let totalCompletionTime = 0;
  let completionTimeCount = 0;

  responses.forEach(response => {
    if (response.createTime && response.lastSubmittedTime) {
      const createTime = new Date(response.createTime).getTime();
      const submitTime = new Date(response.lastSubmittedTime).getTime();
      const completionTime = submitTime - createTime;
      
      if (completionTime > 0) {
        totalCompletionTime += completionTime;
        completionTimeCount++;
      }
    }
  });

  const averageCompletionTime = completionTimeCount > 0 
    ? Math.round(totalCompletionTime / completionTimeCount / 1000) // Convert to seconds
    : null;

  return {
    total: responses.length,
    averageCompletionTime, // in seconds
    timeRange: {
      earliest: responses.reduce((earliest, response) => {
        const time = response.createTime || response.lastSubmittedTime;
        return !time ? earliest : (!earliest || time < earliest ? time : earliest);
      }, null as string | null),
      latest: responses.reduce((latest, response) => {
        const time = response.lastSubmittedTime || response.createTime;
        return !time ? latest : (!latest || time > latest ? time : latest);
      }, null as string | null)
    }
  };
}

/**
 * Sanitize text for safe display
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>&"']/g, (char) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return entities[char] || char;
    });
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
