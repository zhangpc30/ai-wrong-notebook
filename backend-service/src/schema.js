import { z } from 'zod';

const stringField = z.string().catch('');

export const analysisSchema = z
  .object({
    examType: stringField,
    paperType: stringField,
    module: stringField,
    questionType: stringField,
    knowledgePoints: z.array(z.string()).catch([]),
    questionText: stringField,
    options: z.array(z.string()).catch([]),
    correctAnswer: stringField,
    myAnswer: stringField,
    standardAnalysis: stringField,
    fastSolution: stringField,
    mistakeReason: stringField,
    trap: stringField,
    similarPattern: stringField,
    reviewSuggestion: stringField,
    difficulty: stringField,
    reviewPriority: stringField,
    masteryLevel: z.coerce.number().int().min(1).max(5).catch(1),
  })
  .strip();

export const emptyAnalysis = Object.freeze({
  examType: '',
  paperType: '',
  module: '',
  questionType: '',
  knowledgePoints: [],
  questionText: '',
  options: [],
  correctAnswer: '',
  myAnswer: '',
  standardAnalysis: '',
  fastSolution: '',
  mistakeReason: '',
  trap: '',
  similarPattern: '',
  reviewSuggestion: '',
  difficulty: '',
  reviewPriority: '',
  masteryLevel: 1,
});

export function parseAnalysisPayload(value) {
  return analysisSchema.parse({ ...emptyAnalysis, ...value });
}
