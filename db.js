/**
 * MK AI - Local In-Browser SQLite Database (WASM + IndexedDB Storage)
 * Supports full SQLite schema, persistent storage, single chat export,
 * and complete phone-to-phone backup export & import (.mkbackup / JSON).
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
      // 1. Try loading SQL.js from CDN if available
      if (window.initSqlJs) {
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });

        // Check if there is saved SQLite binary in IndexedDB
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
        await this.persist();
        return;
      }
    } catch (err) {
      console.warn('[MK Database] SQL.js WASM load failed or offline, falling back to Native Local Storage engine:', err);
    }

    // Fallback: Persistent In-Browser Relational Store with identical SQL semantics
    await this.initFallbackEngine();
  }

  createTables() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        model_used TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        reasoning TEXT,
        citations TEXT,
        created_at TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        file_name TEXT,
        file_type TEXT,
        file_data_base64 TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  // --- IndexedDB Binary Persistence Helpers ---
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

  // --- Conversations Operations ---
  async getConversations() {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      const res = this.db.exec("SELECT * FROM conversations ORDER BY updated_at DESC");
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
    return this.fallbackStore.conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  async createConversation(id, title, model = 'MK Local Engine') {
    await this.initPromise;
    const now = new Date().toISOString();
    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT INTO conversations (id, title, created_at, updated_at, model_used) VALUES (?, ?, ?, ?, ?)",
        [id, title, now, now, model]
      );
      await this.persist();
      return { id, title, created_at: now, updated_at: now, model_used: model };
    }
    const conv = { id, title, created_at: now, updated_at: now, model_used: model };
    this.fallbackStore.conversations.push(conv);
    await this.persist();
    return conv;
  }

  async updateConversationTitle(id, newTitle) {
    await this.initPromise;
    const now = new Date().toISOString();
    if (this.isWasmLoaded && this.db) {
      this.db.run("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", [newTitle, now, id]);
      await this.persist();
      return;
    }
    const c = this.fallbackStore.conversations.find(item => item.id === id);
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
    this.fallbackStore.messages = this.fallbackStore.messages.filter(m => m.conversation_id !== id);
    this.fallbackStore.conversations = this.fallbackStore.conversations.filter(c => c.id !== id);
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
        // Attach attachments
        for (const msg of msgs) {
          msg.attachments = await this.getAttachmentsForMessage(msg.id);
        }
        return msgs;
      }
      return [];
    }
    const msgs = this.fallbackStore.messages
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

    if (this.isWasmLoaded && this.db) {
      this.db.run(
        "INSERT INTO messages (id, conversation_id, role, content, reasoning, citations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, msg.conversation_id, msg.role, msg.content, msg.reasoning || '', citations, now]
      );
      this.db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, msg.conversation_id]);

      // Save attachments if any
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
      created_at: now
    };
    this.fallbackStore.messages.push(messageObj);

    if (msg.attachments && msg.attachments.length > 0) {
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

    const c = this.fallbackStore.conversations.find(item => item.id === msg.conversation_id);
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
    return this.fallbackStore.settings[key] ?? defaultValue;
  }

  async setSetting(key, value) {
    await this.initPromise;
    if (this.isWasmLoaded && this.db) {
      this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
      await this.persist();
      return;
    }
    this.fallbackStore.settings[key] = String(value);
    await this.persist();
  }

  // --- Backup & Portability (Section 4) ---
  /**
   * Export single conversation as formatted Markdown or JSON
   */
  async exportConversation(conversationId, format = 'markdown') {
    const convs = await this.getConversations();
    const current = convs.find(c => c.id === conversationId);
    if (!current) return null;
    const messages = await this.getMessages(conversationId);

    if (format === 'json') {
      return JSON.stringify({ conversation: current, messages }, null, 2);
    }

    // Markdown format
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

  /**
   * Full database backup export (.mkbackup file)
   */
  async exportFullBackup() {
    await this.initPromise;
    const conversations = await this.getConversations();
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
      version: '1.0',
      app: 'MK AI',
      exported_at: new Date().toISOString(),
      conversations,
      messages: allMessages,
      attachments: allAttachments
    };

    return JSON.stringify(backupData, null, 2);
  }

  /**
   * Import full backup from .mkbackup file
   */
  async importFullBackup(jsonContent) {
    await this.initPromise;
    const data = JSON.parse(jsonContent);

    if (!data.conversations || !Array.isArray(data.conversations)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح.');
    }

    for (const conv of data.conversations) {
      await this.createConversation(conv.id, conv.title, conv.model_used);
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

  // --- Fallback In-Browser Relational Store ---
  async initFallbackEngine() {
    const raw = localStorage.getItem('MK_AI_LOCAL_DB');
    if (raw) {
      try {
        this.fallbackStore = JSON.parse(raw);
      } catch (e) {
        this.fallbackStore = { conversations: [], messages: [], attachments: [], settings: {} };
      }
    } else {
      this.fallbackStore = { conversations: [], messages: [], attachments: [], settings: {} };
    }
  }

  async persistFallback() {
    localStorage.setItem('MK_AI_LOCAL_DB', JSON.stringify(this.fallbackStore));
  }
}

window.MK_DB = new MKDatabase();
