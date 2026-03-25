import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import { config } from '../config.js';

/**
 * Extract text from various document types
 * Returns { text, extractionMethod } or null if extraction fails
 */
export async function extractText(filePath, fileType) {
  try {
    let text = '';
    let method = '';

    switch (fileType.toLowerCase()) {
      case '.pdf':
        text = await extractPDF(filePath);
        method = 'pdf-parse';
        break;

      case '.docx':
        text = await extractDOCX(filePath);
        method = 'mammoth';
        break;

      case '.doc':
      case '.msg':
      case '.eml':
      case '.ppt':
      case '.pptx':
        // Not implemented for MVP
        return null;

      case '.xlsx':
      case '.xls':
        text = await extractXLSX(filePath);
        method = 'xlsx';
        break;

      case '.txt':
      case '.csv':
      case '.md':
      case '.rtf':
        text = await extractPlainText(filePath);
        method = 'fs.readFile';
        break;

      default:
        return null;
    }

    // Truncate to max chars to stay under embedding token limit
    if (text.length > config.crawler.maxCharsPerFile) {
      text = text.substring(0, config.crawler.maxCharsPerFile);
    }

    if (!text || text.trim().length === 0) {
      return null;
    }

    return { text: text.trim(), extractionMethod: method };
  } catch (err) {
    console.warn(`⚠ [Extract] Failed to extract ${fileType} from ${filePath}:`, err.message);
    return null;
  }
}

async function extractPDF(filePath) {
  const data = await fs.readFile(filePath);
  const pdf = await pdfParse(data);
  return pdf.text;
}

async function extractDOCX(filePath) {
  const data = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value;
}

async function extractXLSX(filePath) {
  const workbook = XLSX.readFile(filePath);
  let text = '';

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    text += `\n=== Sheet: ${sheetName} ===\n`;
    for (const row of json) {
      text += row.join(' | ') + '\n';
    }
  }

  return text;
}

async function extractPlainText(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}
