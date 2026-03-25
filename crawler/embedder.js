import { OpenAI } from 'openai';
import { config } from '../config.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generate vector embedding for text using OpenAI
 * For filename-only files, embeds: "{filename} in {folderPath}"
 */
export async function embedText(text, context = {}) {
  const { fileName = '', folderPath = '' } = context;

  // If no text provided, embed filename metadata
  const inputText = text && text.trim() ? text : `${fileName} in ${folderPath}`;

  try {
    const response = await openai.embeddings.create({
      model: config.openai.model,
      input: inputText,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error(`✗ [Embed] Failed to embed text:`, err.message);
    throw err;
  }
}

/**
 * Batch embed multiple texts
 * Process in chunks of up to 100 (OpenAI limit)
 * With rate limiting between batches
 */
export async function embedBatch(items) {
  const batchSize = config.openai.batchSize;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const texts = batch.map(item => {
      const { text, fileName = '', folderPath = '' } = item;
      return text && text.trim() ? text : `${fileName} in ${folderPath}`;
    });

    try {
      const response = await openai.embeddings.create({
        model: config.openai.model,
        input: texts,
        encoding_format: 'float',
      });

      results.push(
        ...response.data.map(d => ({
          embedding: d.embedding,
          index: d.index,
        }))
      );

      // Rate limiting between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, config.openai.rateLimitDelay));
      }
    } catch (err) {
      console.error(`✗ [Embed] Batch embedding failed (items ${i}-${i + batchSize}):`, err.message);
      throw err;
    }
  }

  return results;
}
