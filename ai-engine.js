/**
 * MK AI - Autonomous Conversational & Multi-Capability Engine
 * Features:
 * 1. Natural Human Dialogue in Any Subject
 * 2. Autonomous Background Search (silent, conversational synthesis)
 * 3. AI Image Generation (Flux & SD High-Res generator)
 * 4. Interactive Artifacts Code Sandbox detection (HTML/CSS/JS live apps)
 * 5. Semantic Vector RAG Context Ingestion (multi-page PDF search)
 * 6. Custom GPT Persona Loading
 * 7. Instant Stop Generation (⏹ AbortController)
 */

class MKAIEngine {
  constructor() {
    this.currentAbortController = null;
  }

  stopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      return true;
    }
    return false;
  }

  /**
   * Detects if the prompt is asking to draw or generate an image
   */
  isImageGenerationRequest(prompt) {
    const p = prompt.trim().toLowerCase();
    const imageKeywords = [
      'ارسم', 'صمم لي صورة', 'ولد صورة', 'أنشئ صورة', 'اصنع صورة', 'تخيل صورة',
      'draw', 'generate image', 'paint', 'create an image of', 'image of', 'picture of', 'photo of', 'illustration of'
    ];
    return imageKeywords.some(k => p.includes(k));
  }

  /**
   * Generates a high-res image via Pollinations Flux
   */
  generateImageArtifact(prompt) {
    const cleanPrompt = prompt
      .replace(/^(ارسم لي|ارسم|صمم لي صورة|ولد صورة|أنشئ صورة|اصنع صورة|draw a|generate image of|image of|picture of)\s+/i, '')
      .trim();

    const seed = Math.floor(Math.random() * 9999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

    return {
      type: 'image',
      url: imageUrl,
      prompt: cleanPrompt,
      title: `تصميم: ${cleanPrompt.slice(0, 30)}...`
    };
  }

  needsAutonomousSearch(prompt) {
    const p = prompt.trim().toLowerCase();
    if (/^(ابحث|دور|سرش|search|find|look up)\b/i.test(p)) return true;

    const temporalWords = [
      'اليوم', 'أمس', 'الآن', 'حالياً', 'السنة دي', 'هذا العام', 'سنة 2024', 'سنة 2025', 'سنة 2026', '2025', '2026',
      'أخبار', 'خبر', 'تريند', 'مؤتمر', 'ماتش', 'مباراة', 'مين فاز', 'نتيجة', 'ترتيب', 'دوري',
      'سعر', 'أسعار', 'كام سعر', 'بكام', 'الدولار', 'الذهب', 'العملات', 'البتكوين', 'crypto', 'price', 'rates',
      'طقس', 'الجو', 'درجة الحرارة', 'weather',
      'مواصفات', 'إصدار', 'أحدث تليفون', 'آيفون', 'سامسونج', 'release date', 'specs',
      'آخر تطورات', 'إيه الجديد', 'ما الجديد'
    ];

    return temporalWords.some(w => p.includes(w));
  }

  async performWebSearch(query) {
    const results = [];
    const cleanQ = query
      .replace(/^(ابحث في النت عن|ابحث في الويب عن|ابحث عن|دور لي عن|search for|search web for)\s+/i, '')
      .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
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
                title: item.Text.split(' - ')[0] || cleanQ,
                snippet: item.Text,
                url: item.FirstURL
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[MK Search DDG]:', e);
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
      console.warn('[MK Search Wiki]:', e);
    }

    return results;
  }

  /**
   * Main generation method
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
      model = 'mk-4o',
      customGpt = null,
      apiKey = ''
    } = params;

    // 1. Check if user wants an AI Generated Image
    if (this.isImageGenerationRequest(prompt)) {
      onChunk({ type: 'status', message: '🎨 جاري رسم وتوليد الصورة بدقة عالية عبر Flux...' });
      await new Promise(r => setTimeout(r, 600));

      const imageArtifact = this.generateImageArtifact(prompt);
      onChunk({
        type: 'delta',
        content: `لقد قمت برسم وتوليد الصورة المطلوبة بناءً على وصفك:\n\n**${escapeHtml(imageArtifact.prompt)}**\n\nيمكنك مشاهدتها وتكبيرها أو تنزيلها بأعلى جودة عبر الأزرار أدناه:`
      });

      onChunk({
        type: 'done',
        artifact: imageArtifact,
        citations: []
      });
      this.currentAbortController = null;
      return;
    }

    let searchCitations = [];
    let searchKnowledgeText = '';

    // 2. Smart Autonomous Background Search
    const shouldSearch = enableWebSearch || this.needsAutonomousSearch(prompt);
    if (shouldSearch) {
      onChunk({ type: 'status', message: '🔍 استحضار أحدث المعلومات الحية...' });
      const searchResults = await this.performWebSearch(prompt);
      if (searchResults && searchResults.length > 0) {
        searchCitations = searchResults;
        searchKnowledgeText = "\n\n[بيانات حية وموثوقة من مصادر الويب المعتمدة]:\n" +
          searchResults.map((r, i) => `[${i + 1}] العنوان: ${r.title}\nالمعلومة: ${r.snippet}\nالرابط: ${r.url}`).join("\n\n");
      }
    }

    // 3. Document Processing & Semantic Vector RAG
    let attachmentContextText = '';
    if (window.MK_RAG && window.MK_RAG.documents.size > 0) {
      onChunk({ type: 'status', message: '📑 بحث متجهي دلالي في المستندات والكتب المرفقة (Vector RAG)...' });
      const topChunks = window.MK_RAG.search(prompt, 4);
      if (topChunks && topChunks.length > 0) {
        attachmentContextText += `\n\n[أدق الاقتباسات والفقرات المطابقة من المستندات المرفقة]:\n` +
          topChunks.map((c, i) => `[فقرة ${i + 1} - مستند: ${c.docName} - صفحة ${c.pageNumber}]:\n"${c.text}"`).join("\n\n");
      }
    } else if (attachments && attachments.length > 0) {
      onChunk({ type: 'status', message: '📎 قراءة وتحليل المستندات المرفقة...' });
      attachments.forEach((att) => {
        if (att.text) {
          attachmentContextText += `\n\n[محتوى الملف المرفق (${att.name})]:\n${att.text.slice(0, 14000)}\n`;
        } else if (att.type && att.type.startsWith('image/')) {
          attachmentContextText += `\n\n[تم إرفاق صورة: ${att.name}]\n`;
        }
      });
    }

    // 4. Custom GPT / Persona Instructions
    const isReasoningModel = model === 'mk-o1';
    let basePersona = 'أنت "MK AI"، المساعد الذكي الخارق الأكثر تطوراً وبلاغة وتفاعلاً كشات جي بي تي.';

    if (customGpt && customGpt.system_prompt) {
      basePersona = `أنت المساعد المتخصص "${customGpt.name}".\nدورك وتعليماتك:\n${customGpt.system_prompt}`;
    } else if (model === 'mk-coder') {
      basePersona = 'أنت مهندس برمجيات أول محترف (Senior Software Engineer). كودك فائق الجودة، منظم، مع شروحات وتعليقات توضيحية.';
    } else if (model === 'mk-creative') {
      basePersona = 'أنت كاتب ومفكر إبداعي بليغ، أسلوبك ساحر ومتدفق لكتابة القصص والمقالات والمحتوى التسويقي.';
    }

    const systemPrompt = `${basePersona}
شخصيتك وأسلوبك:
- تحدث مع المستخدم بأسلوب إنساني سلس وطبيعي تماماً وبأعلى درجات الذكاء والبلاغة.
- أجب عن أي سؤال في المحادثة، البرمجة، العلوم، الفلسفة، والحياة اليومية.
- عند كتابة الأكواد، استخدم Markdown مع ذكر لغة البرمجة دائماً. إذا طلب المستخدم إنشاء صفحة ويب، تطبيق، لوحة تحكم، أو لعبة، اكتب كوداً كاملاً متكاملاً داخل كتلة برمجة \`\`\`html ليتسنى تشغيله في القماش التفاعلي.
- عند عرض أرقام أو مقارنات أو إحصائيات، نسقها في جداول Markdown واضحة لتظهر رسوم بيانية تفاعلية.

${searchKnowledgeText ? `**توجيه صارم للمعلومات الحية:**
تم تزويدك بالبيانات الحية التالية. تحدث مع المستخدم بسلاسة وعفوية كأن هذه الحقائق حاضرة في ذهنك بشكل بديهي.
ممنوع منعاً باتاً أن تقول "بحثت في الإنترنت" أو "وفقاً لمحركات البحث"، بل أجب على سؤاله مباشرة كخبير مطلع واذكر الأرقام والتفاصيل المطلوبة بدقة كجزء طبيعي من حديثك.
${searchKnowledgeText}` : ''}

${attachmentContextText ? `مرفقات ومستندات المستخدم:\n${attachmentContextText}` : ''}`;

    // o1 Reasoning Mode simulation
    if (isReasoningModel) {
      onChunk({ type: 'status', message: '🧠 التفكير المتعمق والاستدلال المنطقي (o1)...' });
      const reasoningThoughts = this.generateReasoningThoughts(prompt, shouldSearch, attachments.length > 0);
      for (const thought of reasoningThoughts) {
        if (signal.aborted) return;
        onChunk({ type: 'reasoning', delta: thought + '\n' });
        await new Promise(r => setTimeout(r, 260));
      }
    } else {
      onChunk({ type: 'status', message: '⚡ جاري صياغة الرد...' });
    }

    // Accumulator for text to detect code artifacts
    let fullResponseText = '';

    const textChunkInterceptor = (chunk) => {
      if (chunk.type === 'delta') {
        fullResponseText += chunk.content;
      }
      onChunk(chunk);
    };

    try {
      if (apiKey) {
        await this.generateViaCustomAPI(apiKey, prompt, systemPrompt, conversationHistory, textChunkInterceptor, signal);
      } else {
        await this.generateViaDirectStream(prompt, systemPrompt, conversationHistory, model, textChunkInterceptor, signal);
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('[MK AI] Generation stopped by user.');
        return;
      }
      console.warn('[MK AI] Stream inference failed, using dynamic local synthesis:', err);
      await this.generateLocalFallback(prompt, searchKnowledgeText, textChunkInterceptor, signal);
    }

    // 5. Detect Interactive Code Artifacts (HTML/CSS/JS or SVG)
    const detectedArtifact = this.extractCodeArtifact(fullResponseText);

    onChunk({
      type: 'done',
      citations: searchCitations,
      artifact: detectedArtifact
    });

    this.currentAbortController = null;
  }

  /**
   * Extracts runnable HTML/JS/SVG code into a live Artifact
   */
  extractCodeArtifact(text) {
    if (!text) return null;
    const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
    if (htmlMatch && htmlMatch[1] && htmlMatch[1].length > 120) {
      const code = htmlMatch[1].trim();
      // Extract title if exists
      const titleMatch = code.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'تطبيق ويب تفاعلي';
      return {
        type: 'html',
        title: title,
        code: code
      };
    }
    const svgMatch = text.match(/```xml\s*(<svg[\s\S]*?<\/svg>)\s*```/i) || text.match(/```svg\s*([\s\S]*?)```/i);
    if (svgMatch && svgMatch[1]) {
      return {
        type: 'svg',
        title: 'رسمة متجهية SVG',
        code: svgMatch[1].trim()
      };
    }
    return null;
  }

  generateReasoningThoughts(prompt, hasSearch, hasAttachments) {
    return [
      '1. تفكيك السؤال وتحليل النية الحقيقية وسياق المحادثة بدقة.',
      hasSearch ? '2. استيعاب البيانات الحية وتدقيق الحقائق والمؤشرات المطلوبة.' : '2. استحضار القواعد المعرفية والمنطقية المناسبة.',
      hasAttachments ? '3. فحص المستندات والملفات المرفقة واستخراج الإجابة الدقيقة منها.' : '3. هيكلة الرد بأسلوب منطقي متسلسل ومقنع.',
      '4. صياغة الإجابة النهائية بأسلوب حواري جذاب وبلاغة متقنة مع أمثلة عملية.'
    ];
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

    const targetModel = model === 'mk-coder' ? 'qwen' : (model === 'mk-creative' ? 'mistral' : 'openai');

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

  async generateLocalFallback(prompt, searchContext, onChunk, signal) {
    let reply = `أهلاً بك! بخصوص استفسارك: "${prompt}".\n\n`;
    reply += `يسعدني جداً مناقشة هذا الموضوع معك. يمكنك توجيه أي سؤال تفصيلي أو الاستفسار عن كود أو صياغة فكرة وسأكون معك خطوة بخطوة!`;
    await this.streamWords(reply, onChunk, signal);
  }

  async streamWords(text, onChunk, signal) {
    const parts = text.split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (signal && signal.aborted) break;
      const token = (i === 0 ? '' : ' ') + parts[i];
      onChunk({ type: 'delta', content: token });
      if (i % 2 === 0) {
        await new Promise(r => setTimeout(r, 15));
      }
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.MK_AI = new MKAIEngine();
