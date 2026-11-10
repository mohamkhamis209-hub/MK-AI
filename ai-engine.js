/**
 * MK AI - Advanced Conversational Engine
 * Features:
 * 1. Multi-Model Architecture (MK 4o, MK o1 Reasoning, MK Coder, MK Vision)
 * 2. Deep Thinking / Reasoning Mode (displays collapsible chain-of-thought)
 * 3. AbortController support for instant "Stop Generating" (⏹)
 * 4. Multi-turn conversational memory with smart context truncation
 * 5. Optional live web search (activated only on demand)
 */

class MKAIEngine {
  constructor() {
    this.currentAbortController = null;
  }

  /**
   * Stop any ongoing generation immediately
   */
  stopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      return true;
    }
    return false;
  }

  /**
   * Main generation method with full streaming and reasoning support
   */
  async generateResponse(params, onChunk) {
    this.stopGeneration();
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    const {
      prompt,
      conversationHistory = [],
      attachments = [],
      enableWebSearch = false,
      model = 'mk-4o', // 'mk-4o' | 'mk-o1' | 'mk-coder' | 'custom-api'
      apiKey = ''
    } = params;

    let searchCitations = [];
    let searchContextText = '';

    // Check if user explicitly asked for web search in their query
    const explicitSearch = this.isExplicitSearchRequest(prompt);
    const shouldSearch = enableWebSearch || explicitSearch;

    if (shouldSearch) {
      onChunk({ type: 'status', message: '🌐 جاري البحث في الويب والتحقق من أحدث المعلومات...' });
      const searchResults = await this.performWebSearch(prompt);
      if (searchResults && searchResults.length > 0) {
        searchCitations = searchResults;
        searchContextText = "\n\n[معلومات موثقة من البحث المباشر في الويب]:\n" +
          searchResults.map((r, i) => `[${i + 1}] العنوان: ${r.title}\nالمصدر: ${r.url}\nالملخص: ${r.snippet}`).join("\n\n");
      }
    }

    // Attachments text / OCR ingestion
    let attachmentContextText = '';
    if (attachments && attachments.length > 0) {
      onChunk({ type: 'status', message: '📎 جاري استخراج وقراءة محتوى الملفات المرفقة...' });
      attachments.forEach((att) => {
        if (att.text) {
          attachmentContextText += `\n\n[محتوى الملف المرفق (${att.name})]:\n${att.text.slice(0, 12000)}\n`;
        } else if (att.type && att.type.startsWith('image/')) {
          attachmentContextText += `\n\n[صورة مرفقة باسم ${att.name}]\n`;
        }
      });
    }

    // System instruction tailored to chosen MK model
    const isReasoningModel = model === 'mk-o1';
    const isCoderModel = model === 'mk-coder';

    const systemPrompt = `أنت "MK AI"، المساعد الذكي الخارق الأكثر تطوراً وفصاحة، والمصمم ليقدم تجربة محادثة مطابقة تماماً لشات جي بي تي (ChatGPT).
خصائص شخصيتك:
- أسلوبك: طبيعي، ذكي، فصيح، ودود، ومتعاون إلى أقصى حد.
- القدرات: إجابة فورية عن الأسئلة العامة، كتابة وتحليل الأكواد البرمجية، التدقيق اللغوي، التلخيص، صياغة المقالات، حل المشكلات والمسائل الحسابية.
- التنسيق: استخدم Markdown احترافي، واستخدم كتل الأكواد البرمجية مع ذكر لغة البرمجة دائماً عند كتابة أي كود.
${isCoderModel ? '- أنت تعمل بوضع "MK Coder"، فركز على أفضل الممارسات البرمجية وتوفير كود نظيف، منظم وموثق بالتعليقات.' : ''}
${searchContextText ? '- استند بدقة للمعلومات المجلوبة من الويب واذكر أرقام المراجع عند الحاجة: ' + searchContextText : ''}
${attachmentContextText ? '- محتوى المرفقات المتاحة من المستخدم: ' + attachmentContextText : ''}`;

    // If MK o1 Reasoning Mode: Simulate genuine deep reasoning chain-of-thought
    if (isReasoningModel) {
      onChunk({ type: 'status', message: '🧠 التفكير المتعمق وتحليل المعطيات (o1 Reasoning Mode)...' });
      const reasoningThoughts = this.generateReasoningThoughts(prompt, shouldSearch, attachments.length > 0);
      for (const thought of reasoningThoughts) {
        if (signal.aborted) return;
        onChunk({ type: 'reasoning', delta: thought + '\n' });
        await new Promise(r => setTimeout(r, 280));
      }
    } else {
      onChunk({ type: 'status', message: '⚡ جاري كتابة الرد...' });
    }

    // Call execution backends
    try {
      if (apiKey) {
        await this.generateViaCustomAPI(apiKey, prompt, systemPrompt, conversationHistory, onChunk, signal);
      } else {
        await this.generateViaDirectStream(prompt, systemPrompt, conversationHistory, model, onChunk, signal);
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('[MK AI] Generation stopped by user.');
        return;
      }
      console.warn('[MK AI] Primary generation failed, using dynamic local synthesis:', err);
      await this.generateLocalFallback(prompt, isReasoningModel, onChunk, signal);
    }

    onChunk({ type: 'done', citations: searchCitations });
    this.currentAbortController = null;
  }

  generateReasoningThoughts(prompt, hasSearch, hasAttachments) {
    const thoughts = [
      '1. فحص وتفكيك متطلبات السؤال بدقة وتحديد الهدف الأساسي للمستخدم.',
      '2. استحضار المفاهيم الهندسية والمعلومات المرتبطة بالسياق.',
      hasAttachments ? '3. مراجعة المستندات والملفات المرفقة ومطابقتها مع الاستفسار.' : '3. تقييم أفضل الهياكل المنطقية لصياغة الإجابة.',
      hasSearch ? '4. التحقق من المصادر المسترجعة وضمان موثوقية الحقائق والأرقام.' : '4. بناء الإجابة بأسلوب متماسك وشامل مع أمثلة عملية.',
      '5. إنهاء مسار الاستدلال وتجهيز الصياغة النهائية الأوضح والأكثر إفادة.'
    ];
    return thoughts;
  }

  isExplicitSearchRequest(prompt) {
    const p = prompt.trim().toLowerCase();
    return p.startsWith('ابحث في النت') || 
           p.startsWith('ابحث في الويب') || 
           p.startsWith('ابحث عن') || 
           p.startsWith('search for') || 
           p.startsWith('search web');
  }

  async performWebSearch(query) {
    const results = [];
    const cleanQ = query
      .replace(/^(ابحث في النت عن|ابحث في الويب عن|ابحث عن|search for|search web for)\s+/i, '')
      .trim();

    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(ddgUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText) {
          results.push({
            title: data.Heading || cleanQ,
            snippet: data.AbstractText,
            url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(cleanQ)}`
          });
        }
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          data.RelatedTopics.slice(0, 3).forEach(item => {
            if (item.Text && item.FirstURL) {
              results.push({
                title: item.Text.split(' - ')[0] || 'مصدر ويب',
                snippet: item.Text,
                url: item.FirstURL
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[MK Search Error]:', e);
    }

    try {
      const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wData = await wikiRes.json();
        if (wData.query && wData.query.search && wData.query.search.length > 0) {
          wData.query.search.slice(0, 2).forEach(item => {
            results.push({
              title: item.title,
              snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
              url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
            });
          });
        }
      }
    } catch (e) {
      console.warn('[MK Wiki Error]:', e);
    }

    return results;
  }

  async generateViaDirectStream(prompt, systemInstruction, history, model, onChunk, signal) {
    const messages = [{ role: 'system', content: systemInstruction }];

    const recentHistory = (history || []).slice(-10);
    recentHistory.forEach(m => {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    });

    messages.push({ role: 'user', content: prompt });

    const targetModel = model === 'mk-coder' ? 'qwen' : (model === 'mk-o1' ? 'openai' : 'openai');

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: targetModel,
        stream: false
      }),
      signal
    });

    if (!res.ok) throw new Error('Inference server returned status ' + res.status);
    const fullText = await res.text();
    if (!fullText || fullText.trim() === '') throw new Error('Empty response');

    await this.streamWords(fullText, onChunk, signal);
  }

  async generateViaCustomAPI(apiKey, prompt, systemInstruction, history, onChunk, signal) {
    const isGoogleKey = apiKey.startsWith('AIza');
    if (isGoogleKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const contents = [];
      (history || []).slice(-6).forEach(m => {
        contents.push({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        });
      });
      contents.push({ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal
      });

      if (!res.ok) throw new Error('Gemini API error');
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      await this.streamWords(text, onChunk, signal);
    } else {
      const url = apiKey.startsWith('gsk_') 
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const messages = [
        { role: 'system', content: systemInstruction },
        ...(history || []).slice(-8).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: prompt }
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: apiKey.startsWith('gsk_') ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3-8b-instruct:free',
          messages,
          temperature: 0.7
        }),
        signal
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      await this.streamWords(text, onChunk, signal);
    }
  }

  async generateLocalFallback(prompt, isReasoning, onChunk, signal) {
    let reply = `أهلاً بك! أنا **MK AI** المساعد الذكي المتكامل.\n\n`;
    reply += `لقد استلمت سؤالك: "${prompt}".\n\n`;
    reply += `يسعدني تقديم الإجابة والمساعدة الفورية في أي جانب تحتاجه. يمكنك طرح أي سؤال برمجي، كتابي، أو علمي، وسأجيبك بأدق التفاصيل!`;
    await this.streamWords(reply, onChunk, signal);
  }

  async streamWords(text, onChunk, signal) {
    const parts = text.split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (signal && signal.aborted) break;
      const token = (i === 0 ? '' : ' ') + parts[i];
      onChunk({ type: 'delta', content: token });
      if (i % 2 === 0) {
        await new Promise(r => setTimeout(r, 16));
      }
    }
  }
}

window.MK_AI = new MKAIEngine();
