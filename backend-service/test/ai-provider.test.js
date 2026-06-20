import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { analyzeWithProvider } from '../src/ai-provider.js';

test('provider adapter retries without response_format and returns schema',
  async () => {
    const requests = [];
    const provider = http.createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({
        path: request.url,
        authorization: request.headers.authorization,
        body,
      });
      response.setHeader('Content-Type', 'application/json');
      if (requests.length === 1) {
        response.statusCode = 400;
        response.end(
          JSON.stringify({ error: { message: 'unsupported response_format' } }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  examType: '国考',
                  paperType: '行测',
                  module: '判断推理',
                  questionType: '逻辑判断',
                  knowledgePoints: ['削弱论证'],
                  questionText: '以下哪项最能削弱？',
                  options: ['A. 甲', 'B. 乙'],
                  correctAnswer: 'B',
                  myAnswer: 'A',
                  standardAnalysis: '分析论据和结论。',
                  fastSolution: '找因果缺口。',
                  mistakeReason: '无关项误判',
                  trap: '范围相关但不削弱',
                  similarPattern: '先画论证结构。',
                  reviewSuggestion: '重做三题。',
                  difficulty: '中',
                  reviewPriority: '高',
                  masteryLevel: 2,
                }),
              },
            },
          ],
        }),
      );
    });
    await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
    const address = provider.address();

    process.env.API_KEY = 'server-secret';
    process.env.BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    process.env.MODEL = 'vision-model';

    try {
      const result = await analyzeWithProvider({
        imageBase64: Buffer.from('image').toString('base64'),
      });
      assert.equal(result.module, '判断推理');
      assert.equal(result.masteryLevel, 2);
      assert.equal(requests.length, 2);
      assert.equal(requests[0].path, '/v1/chat/completions');
      assert.equal(requests[0].authorization, 'Bearer server-secret');
      assert.ok(requests[0].body.response_format);
      assert.equal(requests[1].body.response_format, undefined);
    } finally {
      await new Promise((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
