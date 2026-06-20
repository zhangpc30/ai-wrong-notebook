import { buildUserPrompt, systemPrompt } from './prompt.js';
import { parseAnalysisPayload } from './schema.js';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function chatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`;
}

function extractJsonObject(content) {
  if (typeof content !== 'string') {
    throw new Error('Model response content must be a string');
  }
  const withoutFence = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Model response does not contain a JSON object');
  }
  return JSON.parse(withoutFence.slice(start, end + 1));
}

function extractContent(responseBody) {
  const content = responseBody?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  throw new Error('Provider response is missing choices[0].message.content');
}

export async function analyzeWithProvider({
  imageBase64,
  imageMimeType = 'image/jpeg',
  textHint = '',
}) {
  const apiKey = requiredEnv('API_KEY');
  const baseUrl = requiredEnv('BASE_URL');
  const model = requiredEnv('MODEL');
  const temperature = Number(process.env.TEMPERATURE ?? 0.2);
  const maxTokens = Number(process.env.MAX_TOKENS ?? 3000);
  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 240000);

  const userContent = [{ type: 'text', text: buildUserPrompt(textHint) }];
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${imageMimeType};base64,${imageBase64}`,
        detail: 'high',
      },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    };
    let result = await requestProvider({
      url: chatCompletionsUrl(baseUrl),
      apiKey,
      payload,
      signal: controller.signal,
    });
    if (!result.response.ok && [400, 422].includes(result.response.status)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.response_format;
      result = await requestProvider({
        url: chatCompletionsUrl(baseUrl),
        apiKey,
        payload: fallbackPayload,
        signal: controller.signal,
      });
    }
    if (!result.response.ok) {
      const providerMessage =
        result.body?.error?.message ??
        result.body?.message ??
        result.responseText;
      throw new Error(
        `Provider HTTP ${result.response.status}: ${providerMessage}`,
      );
    }

    return parseAnalysisPayload(
      extractJsonObject(extractContent(result.body)),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function requestProvider({ url, apiKey, payload, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });
  const responseText = await response.text();
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(`Provider returned non-JSON HTTP ${response.status}`);
  }
  return { response, responseText, body };
}
