/**
 * MK AI - Client-Side In-Browser OCR & Vision Engine (Tesseract.js WASM)
 * Extracts text, documents, code from images and photos in Arabic and English
 * without any server side processing.
 */

class MKOCREngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.isLoading = false;
  }

  async loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load OCR script: ' + src));
      document.head.appendChild(s);
    });
  }

  async recognize(imageSource, onProgress = () => {}) {
    try {
      onProgress({ status: 'loading', percent: 10, message: 'جاري تحميل محرك الرؤية البصرية (OCR)...' });

      if (!window.Tesseract) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }

      onProgress({ status: 'recognizing', percent: 35, message: 'جاري قراءة واستخراج النصوص العربية والإنجليزية من الصورة...' });

      const result = await window.Tesseract.recognize(
        imageSource,
        'ara+eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pct = Math.round(35 + (m.progress || 0) * 60);
              onProgress({ status: 'recognizing', percent: pct, message: `جاري تحليل الصورة (${pct}%)...` });
            }
          }
        }
      );

      const text = result.data ? result.data.text.trim() : '';
      onProgress({ status: 'done', percent: 100, message: 'اكتمل استخراج النص بنجاح!' });
      return {
        success: true,
        text: text
      };
    } catch (err) {
      console.error('[MK OCR Error]:', err);
      onProgress({ status: 'error', percent: 0, message: 'فشل استخراج النص: ' + err.message });
      return {
        success: false,
        text: '',
        error: err.message
      };
    }
  }
}

window.MK_OCR = new MKOCREngine();
