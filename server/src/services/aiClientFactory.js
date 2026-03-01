const OpenAI = require("openai");

const MODEL_CONFIGS = {
  deepseek: {
    type: "openai-compatible",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  openai: {
    type: "openai-compatible",
    baseURL: undefined,
    model: "gpt-4o",
  },
  claude: {
    type: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
  gemini: {
    type: "google",
    model: "gemini-2.0-flash",
  },
  perplexity: {
    type: "openai-compatible",
    baseURL: "https://api.perplexity.ai",
    model: "llama-3.1-sonar-large-128k-online",
  },
};

/**
 * マルチ AI プロバイダー対応の統一呼び出し関数
 * @param {string} systemPrompt - システムプロンプト
 * @param {string} userMessage - ユーザーメッセージ
 * @param {{ provider: string, apiKey: string, maxTokens?: number }} options
 * @returns {Promise<string>} AI のレスポンステキスト
 */
async function callAI(systemPrompt, userMessage, { provider, apiKey, maxTokens }) {
  const config = MODEL_CONFIGS[provider];
  if (!config) {
    throw new Error(`未対応の AI プロバイダー: ${provider}`);
  }
  if (!apiKey) {
    throw new Error(`API キーが指定されていません (${provider})`);
  }

  const tokens = maxTokens || 4096;

  if (config.type === "openai-compatible") {
    const client = new OpenAI({ apiKey, baseURL: config.baseURL });
    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: tokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content || "";
  }

  if (config.type === "anthropic") {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: tokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    return response.content[0]?.text || "";
  }

  if (config.type === "google") {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config.model,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text();
  }

  throw new Error(`未対応のプロバイダータイプ: ${config.type}`);
}

/**
 * 利用可能なプロバイダー一覧を返す
 */
function getAvailableProviders() {
  return Object.entries(MODEL_CONFIGS).map(([key, config]) => ({
    id: key,
    model: config.model,
    type: config.type,
  }));
}

module.exports = { callAI, getAvailableProviders, MODEL_CONFIGS };
