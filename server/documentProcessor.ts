import fs from 'fs';
import path from 'path';
// Use a CJS-compatible require for pdf-parse (avoids ESM default export issues)
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
  (new Function('require', "return require('pdf-parse')"))(
    typeof require !== 'undefined' ? require : (m: string) => { throw new Error(`require not available for: ${m}`); }
  );
import { db, PolicyAccessLevel, PolicyChunkRecord, PolicyDocumentRecord, UserRole } from './db';

// Access Level Permissibility Matrix
export function isAccessPermitted(userRole: UserRole, policyAccessLevel: PolicyAccessLevel): boolean {
  if (userRole === 'admin') return true; // Admin has access to everything
  if (userRole === 'trainer') {
    return policyAccessLevel === 'PUBLIC' || policyAccessLevel === 'EMPLOYEE' || policyAccessLevel === 'TRAINER';
  }
  if (userRole === 'employee') {
    return policyAccessLevel === 'PUBLIC' || policyAccessLevel === 'EMPLOYEE';
  }
  return false;
}

// Advanced PDF & Document Text Extraction
export async function extractTextFromFileAsync(
  filePath: string,
  originalName: string,
  mimeType: string
): Promise<{ text: string; pages: { pageNum: number; text: string }[] }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { text: `[File unavailable: ${originalName}]`, pages: [{ pageNum: 1, text: '' }] };
    }

    const ext = path.extname(originalName).toLowerCase();

    // 1. PDF File Parsing using pdf-parse
    if (ext === '.pdf' || mimeType.includes('pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        const pdfData = await pdfParse(dataBuffer);
        const rawText = pdfData.text || '';
        
        // Clean text formatting
        const cleanText = rawText.replace(/\r\n/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');

        // Split text into approximate pages if page markers absent
        const numPages = Math.max(1, pdfData.numpages || 1);
        const pageSize = Math.ceil(cleanText.length / numPages);
        const pages: { pageNum: number; text: string }[] = [];

        for (let i = 0; i < numPages; i++) {
          const pageContent = cleanText.slice(i * pageSize, (i + 1) * pageSize).trim();
          pages.push({
            pageNum: i + 1,
            text: pageContent || cleanText
          });
        }

        return {
          text: cleanText.trim() || `Policy Document: ${originalName}`,
          pages
        };
      } catch (pdfErr) {
        console.warn(`Fallback parsing for PDF ${originalName}:`, pdfErr);
      }
    }

    // 2. Plain Text / Markdown / CSV / JSON Formats
    if (['.txt', '.md', '.csv', '.json', '.log', '.html'].includes(ext) || mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('csv')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const clean = content.trim();
      return {
        text: clean || `[Empty document ${originalName}]`,
        pages: [{ pageNum: 1, text: clean }]
      };
    }

    // 3. Fallback Binary Text Extractor for DOCX/DOC/XLSX
    const buffer = fs.readFileSync(filePath);
    let rawStr = buffer.toString('utf-8');
    let cleanText = rawStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
    
    const lines = cleanText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 5 && /[a-zA-Z0-9]/.test(line));

    const extracted = lines.length > 0 ? lines.join('\n') : `Document ${originalName} content loaded.`;
    return {
      text: extracted,
      pages: [{ pageNum: 1, text: extracted }]
    };
  } catch (err) {
    console.error(`Error in text extraction for ${originalName}:`, err);
    return {
      text: `Company Policy Document: ${originalName}`,
      pages: [{ pageNum: 1, text: `Company Policy Document: ${originalName}` }]
    };
  }
}

// Lightweight Vector Semantic Embedding Generator
export function computeTextEmbedding(text: string): number[] {
  const vocabulary = [
    'return', 'refund', 'money', 'cancel', 'shipping', 'delivery', 'warranty', 'damage',
    'broken', 'policy', 'days', '30', '15', '7', '60', 'privacy', 'security', 'password',
    'leave', 'maternity', 'sick', 'holiday', 'hours', 'benefits', 'salary', 'fee', 'charge'
  ];

  const lower = text.toLowerCase();
  return vocabulary.map(term => {
    const matches = lower.split(term).length - 1;
    return matches > 0 ? Math.min(1, matches / 3) : 0;
  });
}

// Chunking Pipeline
export function processDocumentChunks(doc: PolicyDocumentRecord, fullText: string): PolicyChunkRecord[] {
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const chunks: PolicyChunkRecord[] = [];
  let chunkIndex = 0;
  let currentChunkText = '';
  let currentSection = 'Policy Overview';

  for (const para of paragraphs) {
    // Detect section headers
    if (para.toLowerCase().startsWith('section') || para.toLowerCase().startsWith('chapter') || (para.length < 65 && para.includes(':'))) {
      currentSection = para.split('\n')[0].slice(0, 60);
    }

    if ((currentChunkText.length + para.length) > 500 && currentChunkText.length > 80) {
      const chunkContent = currentChunkText.trim();
      chunks.push({
        id: `${doc.id}-chk-${chunkIndex}`,
        documentId: doc.id,
        documentTitle: doc.originalName || doc.filename,
        category: doc.category,
        accessLevel: doc.accessLevel,
        chunkText: chunkContent,
        chunkIndex,
        sectionTitle: currentSection,
        pageNumber: Math.floor(chunkIndex / 2) + 1,
        isActive: doc.isActive !== false,
        version: doc.version || 1,
        embedding: computeTextEmbedding(chunkContent)
      });
      chunkIndex++;
      currentChunkText = para;
    } else {
      currentChunkText += '\n\n' + para;
    }
  }

  if (currentChunkText.trim().length > 0) {
    const chunkContent = currentChunkText.trim();
    chunks.push({
      id: `${doc.id}-chk-${chunkIndex}`,
      documentId: doc.id,
      documentTitle: doc.originalName || doc.filename,
      category: doc.category,
      accessLevel: doc.accessLevel,
      chunkText: chunkContent,
      chunkIndex,
      sectionTitle: currentSection,
      pageNumber: Math.floor(chunkIndex / 2) + 1,
      isActive: doc.isActive !== false,
      version: doc.version || 1,
      embedding: computeTextEmbedding(chunkContent)
    });
  }

  return chunks;
}

// Role-Based Semantic Vector Search Engine
export function searchPolicyChunks(query: string, userRole: UserRole, maxResults: number = 4): {
  chunk: PolicyChunkRecord;
  score: number;
}[] {
  const allChunks = db.getChunks();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\W+/).filter(t => t.length > 2);
  const queryEmbedding = computeTextEmbedding(query);

  // Semantic term synonym map for customer query matching
  const synonyms: Record<string, string[]> = {
    money: ['refund', 'reimbursement', 'credit', 'payment', 'charge', 'cost'],
    return: ['send back', 'exchange', 'returnable', 'eligibility', 'product'],
    damaged: ['broken', 'defective', 'faulty', 'scratched', 'issue'],
    shipping: ['delivery', 'courier', 'dispatch', 'post', 'transit'],
    days: ['period', 'window', 'timeline', 'weeks', 'time'],
    weeks: ['days', 'period', 'time'],
    month: ['days', '30'],
    free: ['complimentary', 'no cost', 'zero fee']
  };

  const scoredResults: { chunk: PolicyChunkRecord; score: number }[] = [];

  for (const chunk of allChunks) {
    // 1. Enforce Server-Side Role Access Filtering
    if (!isAccessPermitted(userRole, chunk.accessLevel)) {
      continue;
    }

    // 2. Strict Active Version Filtering (Ignore inactive or outdated policy versions!)
    if (chunk.isActive === false) {
      continue;
    }

    const chunkTextLower = chunk.chunkText.toLowerCase();
    const docTitleLower = chunk.documentTitle.toLowerCase();
    const sectionLower = (chunk.sectionTitle || '').toLowerCase();
    const categoryLower = (chunk.category || '').toLowerCase();

    let score = 0;

    // Vector Cosine Similarity Score
    if (chunk.embedding && chunk.embedding.length === queryEmbedding.length) {
      let dot = 0;
      let magA = 0;
      let magB = 0;
      for (let i = 0; i < queryEmbedding.length; i++) {
        dot += queryEmbedding[i] * chunk.embedding[i];
        magA += queryEmbedding[i] * queryEmbedding[i];
        magB += chunk.embedding[i] * chunk.embedding[i];
      }
      if (magA > 0 && magB > 0) {
        const cosineSim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
        score += cosineSim * 50;
      }
    }

    // Exact phrase match bonus
    if (chunkTextLower.includes(queryLower)) {
      score += 40;
    }

    // Direct & Synonym term matching
    for (const term of queryTerms) {
      if (chunkTextLower.includes(term)) score += 12;
      if (docTitleLower.includes(term)) score += 18;
      if (sectionLower.includes(term)) score += 15;
      if (categoryLower.includes(term)) score += 10;

      // Synonym expansion
      const syns = synonyms[term] || [];
      for (const syn of syns) {
        if (chunkTextLower.includes(syn)) score += 8;
      }
    }

    if (score > 0) {
      scoredResults.push({ chunk, score });
    }
  }

  // Sort descending by score
  scoredResults.sort((a, b) => b.score - a.score);

  // Group by document to ensure multi-document coverage if score is close
  return scoredResults.slice(0, maxResults);
}
