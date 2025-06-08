/**
 * Google Forms API types based on the API reference
 */

export interface FormInfo {
  title: string;
  description?: string;
  documentTitle?: string;
}

export interface FormSettings {
  quizSettings?: QuizSettings;
  emailCollectionType?: string;
}

export interface QuizSettings {
  isQuiz: boolean;
}

export interface Form {
  formId?: string;
  info: FormInfo;
  settings?: FormSettings;
  items?: Item[];
  revisionId?: string;
  responderUri?: string;
  linkedSheetId?: string;
  publishSettings?: PublishSettings;
}

export interface Item {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: QuestionItem;
  questionGroupItem?: QuestionGroupItem;
  pageBreakItem?: PageBreakItem;
  textItem?: TextItem;
  imageItem?: ImageItem;
  videoItem?: VideoItem;
}

export interface QuestionItem {
  question: Question;
  image?: Image;
}

export interface Question {
  questionId?: string;
  required?: boolean;
  grading?: Grading;
  choiceQuestion?: ChoiceQuestion;
  textQuestion?: TextQuestion;
  scaleQuestion?: ScaleQuestion;
  dateQuestion?: DateQuestion;
  timeQuestion?: TimeQuestion;
  fileUploadQuestion?: FileUploadQuestion;
  rowQuestion?: RowQuestion;
  ratingQuestion?: RatingQuestion;
}

export interface ChoiceQuestion {
  type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
  options: Option[];
  shuffle?: boolean;
}

export interface Option {
  value: string;
  image?: Image;
  isOther?: boolean;
  goToAction?: 'NEXT_SECTION' | 'RESTART_FORM' | 'SUBMIT_FORM';
  goToSectionId?: string;
}

export interface TextQuestion {
  paragraph?: boolean;
}

export interface ScaleQuestion {
  low: number;
  high: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface DateQuestion {
  includeTime?: boolean;
  includeYear?: boolean;
}

export interface TimeQuestion {
  duration?: boolean;
}

export interface FileUploadQuestion {
  folderId: string;
  types: string[];
  maxFiles?: number;
  maxFileSize?: string;
}

export interface RowQuestion {
  title: string;
}

export interface RatingQuestion {
  ratingScaleLevel: number;
  iconType?: 'STAR' | 'HEART' | 'THUMB';
}

export interface Grading {
  pointValue: number;
  correctAnswers?: CorrectAnswers;
  whenRight?: Feedback;
  whenWrong?: Feedback;
  generalFeedback?: Feedback;
}

export interface CorrectAnswers {
  answers: CorrectAnswer[];
}

export interface CorrectAnswer {
  value: string;
}

export interface Feedback {
  text?: string;
  material?: ExtraMaterial[];
}

export interface ExtraMaterial {
  link?: TextLink;
  video?: VideoLink;
}

export interface TextLink {
  uri: string;
  displayText?: string;
}

export interface VideoLink {
  youtubeUri: string;
  displayText?: string;
}

export interface Image {
  sourceUri?: string;
  contentUri?: string;
  altText?: string;
  properties?: MediaProperties;
}

export interface MediaProperties {
  alignment?: 'LEFT' | 'RIGHT' | 'CENTER';
  width?: number;
}

export interface Video {
  youtubeUri: string;
  properties?: MediaProperties;
}

export interface QuestionGroupItem {
  grid: Grid;
  questions: Question[];
  image?: Image;
}

export interface Grid {
  columns: ChoiceQuestion;
  shuffleQuestions?: boolean;
}

export interface PageBreakItem {
  // Empty interface as per API spec
}

export interface TextItem {
  // Empty interface as per API spec
}

export interface ImageItem {
  image: Image;
}

export interface VideoItem {
  video: Video;
  caption?: string;
}

export interface PublishSettings {
  publishState?: PublishState;
}

export interface PublishState {
  isPublished: boolean;
  isAcceptingResponses?: boolean;
}

export interface FormResponse {
  formId: string;
  responseId: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers: { [questionId: string]: Answer };
  totalScore?: number;
}

export interface Answer {
  questionId: string;
  textAnswers?: TextAnswers;
  fileUploadAnswers?: FileUploadAnswers;
  grade?: Grade;
}

export interface TextAnswers {
  answers: TextAnswer[];
}

export interface TextAnswer {
  value: string;
}

export interface FileUploadAnswers {
  answers: FileUploadAnswer[];
}

export interface FileUploadAnswer {
  fileId: string;
  fileName: string;
  mimeType: string;
}

export interface Grade {
  score: number;
  correct: boolean;
  feedback?: Feedback;
}

export interface ListFormResponsesResponse {
  responses: FormResponse[];
  nextPageToken?: string;
}

// Request types for form operations
export interface CreateFormRequest {
  info: FormInfo;
}

export interface UpdateFormRequest {
  formId: string;
  info?: FormInfo;
  settings?: FormSettings;
  items?: Item[];
}

export interface BatchUpdateFormRequest {
  includeFormInResponse?: boolean;
  requests: Request[];
  writeControl?: WriteControl;
}

export interface Request {
  updateFormInfo?: UpdateFormInfoRequest;
  updateSettings?: UpdateSettingsRequest;
  createItem?: CreateItemRequest;
  moveItem?: MoveItemRequest;
  deleteItem?: DeleteItemRequest;
  updateItem?: UpdateItemRequest;
}

export interface UpdateFormInfoRequest {
  info: FormInfo;
  updateMask?: string;
}

export interface UpdateSettingsRequest {
  settings: FormSettings;
  updateMask?: string;
}

export interface CreateItemRequest {
  item: Item;
  location?: Location;
}

export interface Location {
  index: number;
}

export interface MoveItemRequest {
  originalLocation: Location;
  newLocation: Location;
}

export interface DeleteItemRequest {
  location: Location;
}

export interface UpdateItemRequest {
  item: Item;
  location: Location;
  updateMask?: string;
}

export interface WriteControl {
  requiredRevisionId?: string;
  targetRevisionId?: string;
}

export interface BatchUpdateFormResponse {
  form?: Form;
  replies: Response[];
  writeControl?: WriteControl;
}

export interface Response {
  createItem?: CreateItemResponse;
}

export interface CreateItemResponse {
  itemId: string;
  questionId?: string;
}

// Export format types
export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  flattenResponses?: boolean;
}

export interface FormSummary {
  formId: string;
  title: string;
  description?: string;
  responseCount: number;
  questionCount: number;
  lastResponseTime?: string;
  createdTime?: string;
}

export interface ResponseSummary {
  totalResponses: number;
  questionSummaries: QuestionSummary[];
  responseTimeRange?: {
    earliest: string;
    latest: string;
  };
}

export interface QuestionSummary {
  questionId: string;
  title: string;
  type: string;
  responseCount: number;
  statistics?: QuestionStatistics;
}

export interface QuestionStatistics {
  // For choice questions
  choiceDistribution?: { [option: string]: number };
  
  // For scale/rating questions
  average?: number;
  median?: number;
  min?: number;
  max?: number;
  
  // For text questions
  averageLength?: number;
  commonWords?: { [word: string]: number };
  
  // General
  responseRate?: number; // percentage of respondents who answered this question
}
