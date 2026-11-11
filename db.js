/**
 * MK AI - Local In-Browser SQLite Database (WASM + IndexedDB Storage)
 * Supports full SQLite schema, persistent storage, pinned chats, custom GPTs,
 * document vector chunks, and full backup/export.
 */

class MKDatabase {
  constructor() {
    this.db = null;
    this.isWasmLoaded = false;
    this.indexedDbName = 'MK_AI_SQLite_Storage';
    this.storeName = 'sqlite_binary';
    this.initPromise = this.init();
  }

  async init() {
    try {
      if (window.initSqlJs) {
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });

        const savedBinary = await this.loadBinaryFromIndexedDB();
        if (savedBinary) {
          this.db = new SQL.Database(savedBinary);
          console.log('[MK Database] Loaded existing SQLite database from storage.');
        } else {
          this.db = new SQL.Database();
          console.log('[MK Database] Created new SQLite database.');
        }
        this.isWasmLoaded = true;
        this.createTables();
        await this.seedDefaultGPTs();
        await this.persist();
        return;
      }
    } catch (err) {
      console.warn('[MK Database] SQL.js WASM load failed or offline, falling back to Native Local Storage engine:', err);
    }

    await this.initFallbackEngine();
    await this.seedDefaultGPTs();
  }

  createTables() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        model_used TEXT,
        is_pinned INTEGER DEFAULT 0,
        gpt_id TEXT DEFAULT 'default'
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        reasoning TEXT,
        citations TEXT,
        created_at TEXT,
        artifact_data TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        file_name TEXT,
        file_type TEXT,
        file_data_base64 TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_gpts (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        avatar TEXT,
        system_prompt TEXT,
        category TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Ensure columns exist for existing databases
    try { this.db.run(`ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0;`); } catch (e) {}
    try { this.db.run(`ALTER TABLE conversations ADD COLUMN gpt_id TEXT DEFAULT 'default';`); } catch (e) {}
    try { this.db.run(`ALTER TABLE messages ADD COLUMN artifact_data TEXT;`); } catch (e) {}
  }

  async seedDefaultGPTs() {
    const existing = await this.getCustomGPTs();
    if (existing.length === 0) {
      const defaultGPTs = [
        {
          id: 'gpt-coder',
          name: 'MK Code Architect',
          description: 'مهندس برمجيات أول متخصص في بناء وتطوير وهندسة الأكواد وحل المشكلات المعقدة.',
          avatar: '💻',
          system_prompt: 'أنت مهندس برمجيات أول (Senior Software Engineer). كودك فائق النظافة، يتبع أفضل الممارسات البرمجية، متقن للأمان والأداء، ويحتوي على تعليقات شارحة.',
          category: 'البرمجة والتطوير',
          created_at: new Date().toISOString()
        },
        {
          id: 'gpt-legal',
          name: 'MK المستشار القانوني',
          description: 'صياغة ومراجعة العقود، الاستشارات القانونية، وتحليل البنود والاتفاقيات بدقة.',
          avatar: '⚖️',
          system_prompt: 'أنت مستشار قانوني خبير في صياغة العقود التجارية، الاتفاقيات، اللوائح، وحماية الحقوق. أسلوبك رصين وموثق.',
          category: 'القانون والأعمال',
          created_at: new Date().toISOString()
        },
        {
          id: 'gpt-creative',
          name: 'MK الكاتب الإبداعي',
          description: 'تأليف القصص المشوقة، كتابة المقالات، وتصميم الحملات الإعلانية والمحتوى التسويقي.',
          avatar: '✍️',
          system_prompt: 'أنت كاتب أدبي وإعلاني مبدع. أسلوبك ساحر وبلاغي يجذب القارئ ويصنع نصوصاً متفردة ومشوقة.',
          category: 'الكتابة والإبداع',
          created_at: new Date().toISOString()
        },
        {
          id: 'gpt-health',
          name: 'MK كوتش اللياقة والصحة',
          description: 'خطط التغذية السليمة، جداول التمارين الرياضية، وبناء نمط حياة صحي ومتوازن.',
          avatar: '🩺',
          system_prompt: 'أنت مدرب لياقة بدنية وأخصائي تغذية رياضية. تقدم نصائح علمية دقيقة لبناء العضلات وخسارة الدهون والتمتع بصحة مثالية.',
          category: 'الصحة والرياضة',
          created_at: new Date().toISOString()
        },
        {
          id: 'gpt-translator',
          name: 'MK المترجم الاحترافي',
          description: 'ترجمة فورية متقنة بين اللغات مع الحفاظ على روح وسياق المعنى البشري.',
          avatar: '🌐',
          system_prompt: 'أنت مترجم فوري محترف تتقن النقل الدقيق للمصطلحات والسياقات الثقافية بين اللغات بدون أي ترجمة حرفية ركيكة.',
          category: 'اللغات والترجمة',
          created_at: new Date().toISOString()
        }
      ];

      for (const gpt of defaultGPTs) {
        await this.createCustomGPT(gpt);
      }
    }
  }

  // --- IndexedDB Persistence ---
  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.indexedDbName, 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(this.storeName)) {
          idb.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBinaryToIndexedDB(binaryData) {
    const idb = await this.openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(binaryData, 'main_database_bytes');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadBinaryFromIndexedDB() {
    const idb = await this.openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get('main_database_bytes');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async persist() {
    if (this.isWasmLoaded && this.db) {
      const binary = this.db.export();
      await this.saveBinaryToIndexedDB(binary);
    } else if (this.fallbackStore) {
      await this.persistFallback();
    }
  }

  // --- Custom GPTs Operations ---
  async getCustomGPTs() {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT * FROM custom_gpts ORDER BY created_at ASC");
      if (res.length > 0) {
        const cols = res[0].columns;
        return res[0].values.map(val => {
          const obj = {};
          cols.forEach((col, idx) => obj[col] = val[idx]);
          return obj;
        });
      }
      return [];
    }
    return this.fallbackStore.custom_gpts || [];
  }

  async createCustomGPT(gpt) {
    await this.initPromise;
    const now = gpt.created_at || new Date().toISOString();
    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT OR REPLACE INTO custom_gpts (id, name, description, avatar, system_prompt, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [gpt.id, gpt.name, gpt.description, gpt.avatar, gpt.system_prompt, gpt.category || 'عام', now]
      );
      await this.persist();
      return gpt;
    }
    if (!this.fallbackStore.custom_gpts) this.fallbackStore.custom_gpts = [];
    this.fallbackStore.custom_gpts = this.fallbackStore.custom_gpts.filter(g => g.id !== gpt.id);
    this.fallbackStore.custom_gpts.push({ ...gpt, created_at: now });
    await this.persist();
    return gpt;
  }

  async deleteCustomGPT(id) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      this.db.run("DELETE FROM custom_gpts WHERE id = ?", [id]);
      await this.persist();
      return;
    }
    this.fallbackStore.custom_gpts = (this.fallbackStore.custom_gpts || []).filter(g => g.id !== id);
    await this.persist();
  }

  // --- Conversations Operations ---
  async getConversations() {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT * FROM conversations ORDER BY is_pinned DESC, updated_at DESC");
      if (res.length > 0) {
        const cols = res[0].columns;
        return res[0].values.map(val => {
          const obj = {};
          cols.forEach((col, idx) => obj[col] = val[idx]);
          return obj;
        });
      }
      return [];
    }
    return (this.fallbackStore.conversations || []).sort((a, b) => {
      if (b.is_pinned !== a.is_pinned) return (b.is_pinned || 0) - (a.is_pinned || 0);
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  }

  async createConversation(id, title, model = 'mk-4o', gptId = 'default') {
    await this.initPromise;
    const now = new Date().toISOString();
    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT INTO conversations (id, title, created_at, updated_at, model_used, is_pinned, gpt_id) VALUES (?, ?, ?, ?, ?, 0, ?)",
        [id, title, now, now, model, gptId]
      );
      await this.persist();
      return { id, title, created_at: now, updated_at: now, model_used: model, is_pinned: 0, gpt_id: gptId };
    }
    const conv = { id, title, created_at: now, updated_at: now, model_used: model, is_pinned: 0, gpt_id: gptId };
    if (!this.fallbackStore.conversations) this.fallbackStore.conversations = [];
    this.fallbackStore.conversations.push(conv);
    await this.persist();
    return conv;
  }

  async togglePinConversation(id) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      this.db.run("UPDATE conversations SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?", [id]);
      await this.persist();
      return;
    }
    const c = (this.fallbackStore.conversations || []).find(item => item.id === id);
    if (c) {
      c.is_pinned = c.is_pinned ? 0 : 1;
      await this.persist();
    }
  }

  async updateConversationTitle(id, newTitle) {
    await this.initPromise;
    const now = new Date().toISOString();
    if (this.isWasmLoaded && this.db) {
      this.db.run("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", [newTitle, now, id]);
      await this.persist();
      return;
    }
    const c = (this.fallbackStore.conversations || []).find(item => item.id === id);
    if (c) {
      c.title = newTitle;
      c.updated_at = now;
      await this.persist();
    }
  }

  async deleteConversation(id) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      this.db.run("DELETE FROM messages WHERE conversation_id = ?", [id]);
      this.db.run("DELETE FROM conversations WHERE id = ?", [id]);
      await this.persist();
      return;
    }
    this.fallbackStore.messages = (this.fallbackStore.messages || []).filter(m => m.conversation_id !== id);
    this.fallbackStore.conversations = (this.fallbackStore.conversations || []).filter(c => c.id !== id);
    await this.persist();
  }

  // --- Messages Operations ---
  async getMessages(conversationId) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", [conversationId]);
      if (res.length > 0) {
        const cols = res[0].columns;
        const msgs = res[0].values.map(val => {
          const obj = {};
          cols.forEach((col, idx) => obj[col] = val[idx]);
          return obj;
        });
        for (const msg of msgs) {
          msg.attachments = await this.getAttachmentsForMessage(msg.id);
        }
        return msgs;
      }
      return [];
    }
    const msgs = (this.fallbackStore.messages || [])
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (const msg of msgs) {
      msg.attachments = (this.fallbackStore.attachments || []).filter(a => a.message_id === msg.id);
    }
    return msgs;
  }

  async addMessage(msg) {
    await this.initPromise;
    const id = msg.id || 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const now = msg.created_at || new Date().toISOString();
    const citations = typeof msg.citations === 'string' ? msg.citations : JSON.stringify(msg.citations || []);
    const artifactData = msg.artifact_data ? (typeof msg.artifact_data === 'string' ? msg.artifact_data : JSON.stringify(msg.artifact_data)) : null;

    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT INTO messages (id, conversation_id, role, content, reasoning, citations, created_at, artifact_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, msg.conversation_id, msg.role, msg.content, msg.reasoning || '', citations, now, artifactData]
      );
      this.db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, msg.conversation_id]);

      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          const attId = att.id || 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          this.db.run(
            "INSERT INTO attachments (id, message_id, file_name, file_type, file_data_base64) VALUES (?, ?, ?, ?, ?)",
            [attId, id, att.name || att.file_name, att.type || att.file_type, att.data || att.file_data_base64]
          );
        }
      }
      await this.persist();
      return id;
    }

    const messageObj = {
      id,
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      reasoning: msg.reasoning || '',
      citations: citations,
      created_at: now,
      artifact_data: artifactData
    };
    if (!this.fallbackStore.messages) this.fallbackStore.messages = [];
    this.fallbackStore.messages.push(messageObj);

    if (msg.attachments && msg.attachments.length > 0) {
      if (!this.fallbackStore.attachments) this.fallbackStore.attachments = [];
      msg.attachments.forEach(att => {
        this.fallbackStore.attachments.push({
          id: att.id || 'att-' + Date.now(),
          message_id: id,
          file_name: att.name || att.file_name,
          file_type: att.type || att.file_type,
          file_data_base64: att.data || att.file_data_base64
        });
      });
    }

    const c = (this.fallbackStore.conversations || []).find(item => item.id === msg.conversation_id);
    if (c) c.updated_at = now;
    await this.persist();
    return id;
  }

  async getAttachmentsForMessage(messageId) {
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT * FROM attachments WHERE message_id = ?", [messageId]);
      if (res.length > 0) {
        const cols = res[0].columns;
        return res[0].values.map(val => {
          const obj = {};
          cols.forEach((col, idx) => obj[col] = val[idx]);
          return obj;
        });
      }
      return [];
    }
    return (this.fallbackStore.attachments || []).filter(a => a.message_id === messageId);
  }

  // --- Settings Operations ---
  async getSetting(key, defaultValue = null) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT value FROM settings WHERE key = ?", [key]);
      if (res.length > 0 && res[0].values.length > 0) {
        return res[0].values[0][0];
      }
      return defaultValue;
    }
    return (this.fallbackStore.settings || {})[key] ?? defaultValue;
  }

  async setSetting(key, value) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
      await this.persist();
      return;
    }
    if (!this.fallbackStore.settings) this.fallbackStore.settings = {};
    this.fallbackStore.settings[key] = String(value);
    await this.persist();
  }

  // --- Export Helpers ---
  async exportConversation(conversationId, format = 'markdown') {
    const convs = await this.getConversations();
    const current = convs.find(c => c.id === conversationId);
    if (!current) return null;
    const messages = await this.getMessages(conversationId);

    if (format === 'json') {
      return JSON.stringify({ conversation: current, messages }, null, 2);
    }

    if (format === 'html') {
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${current.title} - MK AI</title>`;
      html += `<style>body{font-family:system-ui,sans-serif;padding:30px;max-width:800px;margin:auto;background:#0d1117;color:#e6edf3;}h1{color:#10a37f;border-bottom:1px solid #30363d;padding-bottom:12px;}.msg{margin:20px 0;padding:16px;border-radius:10px;line-height:1.6;}.user{background:#21262d;}.assistant{background:#161b22;border:1px solid #30363d;}.meta{font-size:12px;color:#8b949e;margin-bottom:8px;font-weight:bold;}</style></head><body>`;
      html += `<h1>${current.title}</h1><p style="color:#8b949e;">تاريخ المحادثة: ${new Date(current.created_at).toLocaleString('ar-EG')} | النموذج: ${current.model_used}</p><hr style="border-color:#30363d;">`;
      messages.forEach(m => {
        const sender = m.role === 'user' ? '👤 أنت' : '🤖 MK AI';
        html += `<div class="msg ${m.role}"><div class="meta">${sender} (${new Date(m.created_at).toLocaleTimeString('ar-EG')})</div><div>${m.content.replace(/\n/g, '<br>')}</div></div>`;
      });
      html += `</body></html>`;
      return html;
    }

    // Markdown
    let md = `# ${current.title}\n`;
    md += `*تاريخ المحادثة: ${new Date(current.created_at).toLocaleString('ar-EG')}*\n`;
    md += `*النموذج: ${current.model_used}*\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.role === 'user' ? '👤 المستخدم' : '🤖 MK AI';
      md += `### ${sender} (${new Date(m.created_at).toLocaleTimeString('ar-EG')}):\n\n`;
      if (m.reasoning) {
        md += `> **مسار التفكير:**\n> ${m.reasoning.replace(/\n/g, '\n> ')}\n\n`;
      }
      md += `${m.content}\n\n`;
      if (m.attachments && m.attachments.length > 0) {
        md += `📎 **المرفقات:** ${m.attachments.map(a => a.file_name).join(', ')}\n\n`;
      }
      md += `---\n\n`;
    });

    return md;
  }

  async exportFullBackup() {
    await this.initPromise;
    const conversations = await this.getConversations();
    const gpts = await this.getCustomGPTs();
    let allMessages = [];
    let allAttachments = [];

    for (const c of conversations) {
      const msgs = await this.getMessages(c.id);
      allMessages = allMessages.concat(msgs);
      for (const m of msgs) {
        const atts = await this.getAttachmentsForMessage(m.id);
        allAttachments = allAttachments.concat(atts);
      }
    }

    const backupData = {
      version: '3.0',
      app: 'MK AI',
      exported_at: new Date().toISOString(),
      conversations,
      messages: allMessages,
      attachments: allAttachments,
      custom_gpts: gpts
    };

    return JSON.stringify(backupData, null, 2);
  }

  async importFullBackup(jsonContent) {
    await this.initPromise;
    const data = JSON.parse(jsonContent);

    if (!data.conversations || !Array.isArray(data.conversations)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح.');
    }

    if (data.custom_gpts && Array.isArray(data.custom_gpts)) {
      for (const gpt of data.custom_gpts) {
        await this.createCustomGPT(gpt);
      }
    }

    for (const conv of data.conversations) {
      await this.createConversation(conv.id, conv.title, conv.model_used, conv.gpt_id || 'default');
      if (conv.is_pinned) {
        await this.togglePinConversation(conv.id);
      }
    }

    if (data.messages && Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        await this.addMessage(msg);
      }
    }

    await this.persist();
    return {
      conversationsCount: data.conversations.length,
      messagesCount: data.messages ? data.messages.length : 0
    };
  }

  async initFallbackEngine() {
    const raw = localStorage.getItem('MK_AI_LOCAL_DB');
    if (raw) {
      try {
        this.fallbackStore = JSON.parse(raw);
      } catch (e) {
        this.fallbackStore = { conversations: [], messages: [], attachments: [], custom_gpts: [], settings: {} };
      }
    } else {
      this.fallbackStore = { conversations: [], messages: [], attachments: [], custom_gpts: [], settings: {} };
    }
  }

  async persistFallback() {
    localStorage.setItem('MK_AI_LOCAL_DB', JSON.stringify(this.fallbackStore));
  }
}

window.MK_DB = new MKDatabase();
