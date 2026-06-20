import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAnalysisPayload } from '../src/schema.js';

test('normalizes AI output to the public exam schema', () => {
  const result = parseAnalysisPayload({
    examType: '国考',
    knowledgePoints: ['削弱论证'],
    questionText: '以下哪项最能削弱？',
    masteryLevel: 9,
    unexpected: 'removed',
  });

  assert.equal(result.examType, '国考');
  assert.deepEqual(result.knowledgePoints, ['削弱论证']);
  assert.equal(result.masteryLevel, 1);
  assert.equal(result.paperType, '');
  assert.equal('unexpected' in result, false);
});
