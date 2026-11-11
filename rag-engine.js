/**
 * MK AI - In-Browser Semantic Vector RAG Engine
 * High-performance client-side document chunking, TF-IDF vectorization,
 * and Cosine Similarity retrieval for multi-page PDF & text documents.
 */

class MKSemanticRAG {
  constructor() {
    this.documents = new Map(); // docId => { name, chunks: [{ id, text, page, vector }] }
  }

  /**
   * Process a document into semantic chunks with TF-IDF vector representation
   */
  async indexDocument(docId, docName, fullText, pagesData = []) {
    const chunks = [];
    const chunkSize = 600;
    const overlap = 120;

    if (pagesData && pagesData.length > 0) {
      // Index by page
      pagesData.forEach((pageInfo) => {
        const pageText = pageInfo.text || '';
        const pageChunks = this.splitIntoChunks(pageText, chunkSize, overlap);
        pageChunks.forEach((chunkStr, idx) => {
          chunks.push({
            id: `${docId}-p${pageInfo.pageNumber}-${idx}`,
            docName: docName,
            pageNumber: pageInfo.pageNumber,
            text: chunkStr,
            vector: this.calculateTermVector(chunkStr)
          });
        });
      });
    } else {
      // Generic text chunking
      const rawChunks = this.splitIntoChunks(fullText, chunkSize, overlap);
      rawChunks.forEach((chunkStr, idx) => {
        chunks.push({
          id: `${docId}-c${idx}`,
          docName: docName,
          pageNumber: Math.floor(idx / 3) + 1,
          text: chunkStr,
          vector: this.calculateTermVector(chunkStr)
        });
      });
    }

    this.documents.set(docId, {
      name: docName,
      chunks: chunks
    });

    console.log(`[MK RAG] Indexed document "${docName}" with ${chunks.length} semantic vector chunks.`);
    return chunks.length;
  }

  splitIntoChunks(text, chunkSize, overlap) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= chunkSize) return [clean];

    const result = [];
    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkSize, clean.length);
      const slice = clean.slice(start, end);
      result.push(slice);
      start += chunkSize - overlap;
    }
    return result;
  }

  calculateTermVector(text) {
    const tokens = this.tokenize(text);
    const freq = {};
    tokens.forEach((t) => {
      freq[t] = (freq[t] || 0) + 1;
    });

    // Normalize vector length for cosine similarity
    let magnitudeSq = 0;
    Object.values(freq).forEach(v => magnitudeSq += v * v);
    const magnitude = Math.sqrt(magnitudeSq) || 1;

    const normalized = {};
    for (const [term, count] of Object.entries(freq)) {
      normalized[term] = count / magnitude;
    }
    return normalized;
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /**
   * Search across all indexed documents for top-K most relevant chunks
   */
  search(query, topK = 4) {
    const queryVector = this.calculateTermVector(query);
    const scoredChunks = [];

    this.documents.forEach((doc) => {
      doc.chunks.forEach((chunk) => {
        const score = this.cosineSimilarity(queryVector, chunk.vector);
        if (score > 0.05) {
          scoredChunks.push({
            ...chunk,
            similarityScore: score
          });
        }
      });
    });

    scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);
    return scoredChunks.slice(0, topK);
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (const [term, weightA] of Object.entries(vecA)) {
      if (vecB[term]) {
        dotProduct += weightA * vecB[term];
      }
    }
    return dotProduct;
  }

  clear() {
    this.documents.clear();
  }
}

window.MK_RAG = new MKSemanticRAG();
