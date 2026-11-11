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
    this.fallbackStore = { conversations: [], messages: [], attachments: [], custom_gpts: [], settings: {} };
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
    try {
      this.db.exec(`
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

      // Ensure columns exist for upgraded schemas
      try { this.db.run(`ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0;`); } catch (e) {}
      try { this.db.run(`ALTER TABLE conversations ADD COLUMN gpt_id TEXT DEFAULT 'default';`); } catch (e) {}
      try { this.db.run(`ALTER TABLE messages ADD COLUMN artifact_data TEXT;`); } catch (e) {}
    } catch (err) {
      console.warn('[MK Database] Create tables warning:', err);
    }
  }

  getDefaultGPTList() {
    return [
      {
        id: 'gpt-coder',
        name: 'MK Code Architect',
        description: 'مهندس برمجيات أول متخصص في بناء وتطوير وهندسة الأكواد وحل المشكلات المعقدة.',
        avatar: '💻',
        system_prompt: 'أنت مهندس برمجيات أول (Senior Software Engineer). كودك فائق النظافة، يتبع أفضل الممارسات البرمجية، متقن للأمان والأداء، ويحتوي على تعليقات شارحة.',
        category: 'البرمجة والتطوير'
      },
      {
        id: 'gpt-legal',
        name: 'MK المستشار القانوني',
        description: 'صياغة ومراجعة العقود، الاستشارات القانونية، وتحليل البنود والاتفاقيات بدقة.',
        avatar: '⚖️',
        system_prompt: 'أنت مستشار قانوني خبير في صياغة العقود التجارية، الاتفاقيات، اللوائح، وحماية الحقوق. أسلوبك رصين وموثق.',
        category: 'القانون والأعمال'
      },
      {
        id: 'gpt-creative',
        name: 'MK الكاتب الإبداعي',
        description: 'تأليف القصص المشوقة، كتابة المقالات، وتصميم الحملات الإعلانية والمحتوى التسويقي.',
        avatar: '✍️',
        system_prompt: 'أنت كاتب أدبي وإعلاني مبدع. أسلوبك ساحر وبلاغي يجذب القارئ ويصنع نصوصاً متفردة ومشوقة.',
        category: 'الكتابة والإبداع'
      },
      {
        id: 'gpt-health',
        name: 'MK كوتش اللياقة والصحة',
        description: 'خطط التغذية السليمة، جداول التمارين الرياضية، وبناء نمط حياة صحي ومتوازن.',
        avatar: '🩺',
        system_prompt: 'أنت مدرب لياقة بدنية وأخصائي تغذية رياضية. تقدم نصائح علمية دقيقة لبناء العضلات وخسارة الدهون والتمتع بصحة مثالية.',
        category: 'الصحة والرياضة'
      },
      {
        id: 'gpt-translator',
        name: 'MK المترجم الاحترافي',
        description: 'ترجمة فورية متقنة بين اللغات مع الحفاظ على روح وسياق المعنى البشري.',
        avatar: '🌐',
        system_prompt: 'أنت مترجم فوري محترف تتقن النقل الدقيق للمصطلحات والسياقات الثقافية بين اللغات بدون أي ترجمة حرفية ركيكة.',
        category: 'اللغات والترجمة'
      }
    ];
  }

  async seedDefaultGPTs() {
    const list = this.getDefaultGPTList();
    const now = new Date().toISOString();

    if (this.isWasmLoaded && this.db) {
      try {
        const res = this.db.exec("SELECT COUNT(*) FROM custom_gpts");
        const count = (res.length > 0 && res[0].values.length > 0) ? res[0].values[0][0] : 0;
        if (count === 0) {
          for (const gpt of list) {
            this.db.run(
              "INSERT OR REPLACE INTO custom_gpts (id, name, description, avatar, system_prompt, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [gpt.id, gpt.name, gpt.description, gpt.avatar, gpt.system_prompt, gpt.category || 'عام', now]
            );
          }
        }
      } catch (err) {
        console.warn('[MK Database] Seed GPTs error:', err);
      }
    } else if (this.fallbackStore) {
      if (!this.fallbackStore.custom_gpts || this.fallbackStore.custom_gpts.length === 0) {
        this.fallbackStore.custom_gpts = list.map(g => ({ ...g, created_at: now }));
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
    try {
      const idb = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(binaryData, 'main_database_bytes');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[MK Database] IndexedDB save error:', e);
    }
  }

  async loadBinaryFromIndexedDB() {
    try {
      const idb = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get('main_database_bytes');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
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
      try {
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
      } catch (e) {
        return [];
      }
    }
    return this.fallbackStore.custom_gpts || [];
  }

  async createCustomGPT(gpt) {
    await this.initPromise;
    const now = gpt.created_at || new Date().toISOString();
    const id = gpt.id || 'gpt-' + Date.now();
    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT OR REPLACE INTO custom_gpts (id, name, description, avatar, system_prompt, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, gpt.name, gpt.description, gpt.avatar, gpt.system_prompt, gpt.category || 'عام', now]
      );
      await this.persist();
      return { ...gpt, id, created_at: now };
    }
    if (!this.fallbackStore.custom_gpts) this.fallbackStore.custom_gpts = [];
    this.fallbackStore.custom_gpts = this.fallbackStore.custom_gpts.filter(g => g.id !== id);
    const newGpt = { ...gpt, id, created_at: now };
    this.fallbackStore.custom_gpts.push(newGpt);
    await this.persist();
    return newGpt;
  }

  async addCustomGPT(gpt) {
    return this.createCustomGPT(gpt);
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
      try {
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
      } catch (e) {
        return [];
      }
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
      try {
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
      } catch (e) {
        return [];
      }
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
      for (const att of msg.attachments) {
        this.fallbackStore.attachments.push({
          id: att.id || 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          message_id: id,
          file_name: att.name || att.file_name,
          file_type: att.type || att.file_type,
          file_data_base64: att.data || att.file_data_base64
        });
      }
    }
    await this.persist();
    return id;
  }

  async getAttachmentsForMessage(messageId) {
    if (this.isWasmLoaded && this.db) {
      try {
        const res = this.db.exec("SELECT * FROM attachments WHERE message_id = ?", [messageId]);
        if (res.length > 0) {
          const cols = res[0].columns;
          return res[0].values.map(val => {
            const obj = {};
            cols.forEach((col, idx) => obj[col] = val[idx]);
            return obj;
          });
        }
      } catch (e) {}
      return [];
    }
    return (this.fallbackStore.attachments || []).filter(a => a.message_id === messageId);
  }

  // --- Settings Operations ---
  async getSetting(key, defaultValue = '') {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      try {
        const res = this.db.exec("SELECT value FROM settings WHERE key = ?", [key]);
        if (res.length > 0 && res[0].values.length > 0) {
          return res[0].values[0][0];
        }
      } catch (e) {}
      return defaultValue;
    }
    return (this.fallbackStore.settings && this.fallbackStore.settings[key] !== undefined)
      ? this.fallbackStore.settings[key]
      : defaultValue;
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

  // --- Export / Import ---
  async exportConversation(conversationId, format = 'markdown') {
    const convs = await this.getConversations();
    const conv = convs.find(c => c.id === conversationId);
    const messages = await this.getMessages(conversationId);

    if (format === 'json') {
      return JSON.stringify({ conversation: conv, messages }, null, 2);
    }

    if (format === 'html') {
      const msgsHtml = messages.map(m => `
        <div style="margin-bottom: 20px; padding: 12px; border-radius: 8px; background: ${m.role === 'user' ? '#f0f4f8' : '#fff'}; border: 1px solid #e2e8f0;">
          <strong>${m.role === 'user' ? '👤 المستخدم' : '🤖 MK AI'}:</strong>
          <div style="margin-top: 8px; line-height: 1.6;">${window.marked ? window.marked.parse(m.content || '') : m.content}</div>
        </div>
      `).join('');

      return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${conv ? conv.title : 'MK AI Chat'}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #1a202c; }
    h1 { border-bottom: 2px solid #10a37f; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${conv ? conv.title : 'محادثة MK AI'}</h1>
  <p><small>تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}</small></p>
  ${msgsHtml}
</body>
</html>`;
    }

    // Default: Markdown
    let md = `# ${conv ? conv.title : 'محادثة MK AI'}\n\n`;
    md += `*تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}*\n\n---\n\n`;

    messages.forEach(m => {
      md += `### ${m.role === 'user' ? '👤 المستخدم' : '🤖 MK AI'}:\n\n${m.content}\n\n`;
      if (m.reasoning) {
        md += `> **مسار التفكير (o1):**\n> ${m.reasoning.replace(/\n/g, '\n> ')}\n\n`;
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
