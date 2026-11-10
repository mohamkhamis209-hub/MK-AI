/**
 * MK AI - Advanced ChatGPT-Style Application Controller
 * Features:
 * - Multi-Model Switcher (MK 4o, MK o1 Reasoning, MK Coder)
 * - Voice Dictation (Speech-to-Text) & Read Aloud (Text-to-Speech)
 * - Stop Generation (⏹) with AbortController
 * - Message Actions: Copy, Read Aloud, Regenerate, Edit User Prompt
 * - Sidebar Date Grouping: Today, Yesterday, Previous 7 Days, Older
 * - Scroll-to-bottom Floating Button
 * - SQLite Persistent Storage with Full Backup & Portability
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. State Variables
  let currentConversationId = null;
  let activeAttachments = [];
  let isWebSearchEnabled = false;
  let currentModel = 'mk-4o';
  let customApiKey = '';
  let isGenerating = false;
  let speechRecognitionInstance = null;
  let isSpeechRecording = false;
  let currentSpeechUtterance = null;
  let deferredInstallPrompt = null;

  // 2. DOM Elements
  const messagesViewport = document.getElementById('messagesViewport');
  const promptTextarea = document.getElementById('promptTextarea');
  const composerForm = document.getElementById('composerForm');
  const fileUploader = document.getElementById('fileUploader');
  const attachmentsPreviewBar = document.getElementById('attachmentsPreviewBar');
  const btnSendOrStop = document.getElementById('btnSendOrStop');
  const iconSend = document.getElementById('iconSend');
  const iconStop = document.getElementById('iconStop');
  const btnVoiceDictation = document.getElementById('btnVoiceDictation');
  const btnScrollBottom = document.getElementById('btnScrollBottom');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const btnNewChat = document.getElementById('btnNewChat');
  const sidebarHistory = document.getElementById('sidebarHistory');
  const inputSearchChats = document.getElementById('inputSearchChats');
  const btnWebSearchToggle = document.getElementById('btnWebSearchToggle');
  const btnExportCurrentChat = document.getElementById('btnExportCurrentChat');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const btnInstallPwa = document.getElementById('btnInstallPwa');
  const dbStatusBadge = document.getElementById('dbStatusBadge');

  // Model Dropdown
  const modelDropdownTrigger = document.getElementById('modelDropdownTrigger');
  const modelDropdownMenu = document.getElementById('modelDropdownMenu');
  const activeModelLabel = document.getElementById('activeModelLabel');
  const modelMenuItems = document.querySelectorAll('.model-menu-item');

  // Modals
  const backupModal = document.getElementById('backupModal');
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenBackupModal = document.getElementById('btnOpenBackupModal');
  const btnCloseBackupModal = document.getElementById('btnCloseBackupModal');
  const btnOpenSettingsModal = document.getElementById('btnOpenSettingsModal');
  const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  const fileBackupInput = document.getElementById('fileBackupInput');
  const statsConversationsCount = document.getElementById('statsConversationsCount');
  const selectAiEngine = document.getElementById('selectAiEngine');
  const rowCustomApiKey = document.getElementById('rowCustomApiKey');
  const inputCustomApiKey = document.getElementById('inputCustomApiKey');
  const chkDefaultSearch = document.getElementById('chkDefaultSearch');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnClearAllData = document.getElementById('btnClearAllData');

  // 3. Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[PWA] Service Worker registered.'))
      .catch((err) => console.warn('[PWA] SW error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstallPwa.style.display = 'flex';
  });

  btnInstallPwa.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        btnInstallPwa.style.display = 'none';
      }
      deferredInstallPrompt = null;
    }
  });

  // 4. Initialize Database & Saved Settings
  await window.MK_DB.initPromise;
  dbStatusBadge.textContent = window.MK_DB.isWasmLoaded ? 'قاعدة SQLite: نشطة محلياً' : 'قاعدة SQLite: نشطة';

  currentModel = await window.MK_DB.getSetting('ai_model', 'mk-4o');
  customApiKey = await window.MK_DB.getSetting('custom_api_key', '');
  isWebSearchEnabled = (await window.MK_DB.getSetting('web_search_enabled', 'false')) === 'true';

  updateModelUI(currentModel);
  selectAiEngine.value = currentModel;
  inputCustomApiKey.value = customApiKey;
  chkDefaultSearch.checked = isWebSearchEnabled;
  updateWebSearchUI();

  // Load Saved Theme
  const savedTheme = localStorage.getItem('mk_ai_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.replace('dark-theme', 'light-theme');
    themeIcon.textContent = '🌙';
  }

  // 5. Load Initial Conversation
  await renderConversationsList();
  const convs = await window.MK_DB.getConversations();
  if (convs.length > 0) {
    await switchConversation(convs[0].id);
  } else {
    await startNewConversation();
  }

  // 6. Model Switcher Dropdown Interaction
  modelDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = modelDropdownMenu.style.display === 'block';
    modelDropdownMenu.style.display = isShown ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    modelDropdownMenu.style.display = 'none';
  });

  modelMenuItems.forEach((item) => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selected = item.dataset.model;
      currentModel = selected;
      updateModelUI(selected);
      await window.MK_DB.setSetting('ai_model', selected);
      modelDropdownMenu.style.display = 'none';
    });
  });

  function updateModelUI(modelId) {
    modelMenuItems.forEach(item => {
      item.classList.toggle('active', item.dataset.model === modelId);
    });
    if (modelId === 'mk-o1') {
      activeModelLabel.textContent = 'MK o1 (تفكير عميق)';
    } else if (modelId === 'mk-coder') {
      activeModelLabel.textContent = 'MK Coder (مهندس أكواد)';
    } else {
      activeModelLabel.textContent = 'MK 4o (الذكي والسريع)';
    }
  }

  // 7. Sidebar & History Grouped by Dates
  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarBackdrop.classList.toggle('active');
  });

  sidebarBackdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('active');
  });

  btnNewChat.addEventListener('click', async () => {
    await startNewConversation();
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    }
  });

  async function startNewConversation() {
    const id = 'conv-' + Date.now();
    await window.MK_DB.createConversation(id, 'محادثة جديدة', currentModel);
    await renderConversationsList();
    await switchConversation(id);
  }

  async function switchConversation(id) {
    currentConversationId = id;
    document.querySelectorAll('.chat-history-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    const messages = await window.MK_DB.getMessages(id);
    renderMessagesViewport(messages);
  }

  async function renderConversationsList(filterQuery = '') {
    sidebarHistory.innerHTML = '';
    const list = await window.MK_DB.getConversations();
    const filtered = filterQuery 
      ? list.filter(c => c.title.toLowerCase().includes(filterQuery.toLowerCase()))
      : list;

    if (filtered.length === 0) {
      sidebarHistory.innerHTML = `<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted)">لا توجد محادثات سابقة</div>`;
      return;
    }

    // Grouping by date
    const groups = { today: [], yesterday: [], week: [], older: [] };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    filtered.forEach((conv) => {
      const convTime = new Date(conv.updated_at || conv.created_at).getTime();
      if (convTime >= todayStart) groups.today.push(conv);
      else if (convTime >= yesterdayStart) groups.yesterday.push(conv);
      else if (convTime >= weekStart) groups.week.push(conv);
      else groups.older.push(conv);
    });

    renderHistoryGroup('اليوم', groups.today);
    renderHistoryGroup('أمس', groups.yesterday);
    renderHistoryGroup('الأسبوع الماضي', groups.week);
    renderHistoryGroup('سابقاً', groups.older);
  }

  function renderHistoryGroup(title, items) {
    if (!items || items.length === 0) return;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'history-group-title';
    groupHeader.textContent = title;
    sidebarHistory.appendChild(groupHeader);

    items.forEach((conv) => {
      const item = document.createElement('div');
      item.className = `chat-history-item ${conv.id === currentConversationId ? 'active' : ''}`;
      item.dataset.id = conv.id;

      item.innerHTML = `
        <span class="chat-title-text" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title)}</span>
        <div class="chat-actions">
          <button class="btn-chat-action" data-action="rename" title="إعادة التسمية">✏️</button>
          <button class="btn-chat-action" data-action="export" title="تصدير">📥</button>
          <button class="btn-chat-action" data-action="delete" title="حذف">🗑️</button>
        </div>
      `;

      item.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-chat-action')) return;
        await switchConversation(conv.id);
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          sidebarBackdrop.classList.remove('active');
        }
      });

      // Rename
      item.querySelector('[data-action="rename"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = prompt('أدخل الاسم الجديد للمحادثة:', conv.title);
        if (newTitle && newTitle.trim()) {
          await window.MK_DB.updateConversationTitle(conv.id, newTitle.trim());
          await renderConversationsList(inputSearchChats.value);
        }
      });

      // Export
      item.querySelector('[data-action="export"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const md = await window.MK_DB.exportConversation(conv.id, 'markdown');
        downloadFile(md, `${conv.title.replace(/\s+/g, '_')}.md`, 'text/markdown');
      });

      // Delete
      item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`هل تريد حذف محادثة "${conv.title}"؟`)) {
          await window.MK_DB.deleteConversation(conv.id);
          const remaining = await window.MK_DB.getConversations();
          if (remaining.length > 0) {
            await switchConversation(remaining[0].id);
          } else {
            await startNewConversation();
          }
          await renderConversationsList();
        }
      });

      sidebarHistory.appendChild(item);
    });
  }

  inputSearchChats.addEventListener('input', () => {
    renderConversationsList(inputSearchChats.value);
  });

  // 8. Messages Viewport Rendering & Interaction
  function renderMessagesViewport(messages) {
    messagesViewport.innerHTML = '';

    if (!messages || messages.length === 0) {
      messagesViewport.innerHTML = `
        <div class="welcome-container">
          <div class="welcome-logo">MK</div>
          <h2 class="welcome-title">أهلاً بك، كيف يمكنني مساعدتك اليوم؟</h2>
          <p class="welcome-sub">
            أنا <strong>MK AI</strong>، مساعدك فائق الذكاء. جاهز للمحادثة، كتابة وفحص الأكواد، صياغة الخطط، وتحليل المستندات.
          </p>
          <div class="prompt-suggestions-grid">
            <div class="prompt-card" data-prompt="اكتب لي كود بايثون كامل لإنشاء تطبيق مهام يومية Todo App مع واجهة رسومية">
              💻 <strong>كتابة وهندسة الأكواد</strong>
              <div>تطبيق مهام Todo كامل بلغة Python</div>
            </div>
            <div class="prompt-card" data-prompt="ساعدني في صياغة خطة تسويقية متكاملة لمشروع ناشئ مع مراحل التنفيذ">
              📈 <strong>التخطيط والاستراتيجية</strong>
              <div>خطة تسويق ونمو للمشاريع الناشئة</div>
            </div>
            <div class="prompt-card" data-prompt="اشرح لي نظرية الحوسبة والذكاء الاصطناعي الحديث بأسلوب مبسط وشيق">
              🧠 <strong>التعلم وتبسيط المفاهيم</strong>
              <div>شرح أنظمة الذكاء الاصطناعي والـ LLMs</div>
            </div>
          </div>
        </div>
      `;

      document.querySelectorAll('.prompt-card').forEach((card) => {
        card.addEventListener('click', () => {
          promptTextarea.value = card.dataset.prompt;
          composerForm.dispatchEvent(new Event('submit'));
        });
      });
      return;
    }

    messages.forEach((msg) => {
      appendMessageToUI(msg, false);
    });

    scrollToBottom();
  }

  function appendMessageToUI(msg, animate = true) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;
    row.id = msg.id || 'msg-' + Math.random().toString(36).substring(2);

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = `
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          ${msg.attachments.map(att => `
            <div class="attachment-chip">
              <span>${att.file_type && att.file_type.startsWith('image') ? '🖼️' : '📄'}</span>
              <span class="filename">${escapeHtml(att.file_name)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (msg.role === 'user') {
      row.innerHTML = `
        <div class="message-inner">
          <div class="msg-avatar">👤</div>
          <div class="msg-content-wrapper">
            ${attachmentsHtml}
            <div class="msg-bubble-user">${escapeHtml(msg.content)}</div>
            <div class="user-msg-tools">
              <button class="btn-user-tool btn-edit-user-msg" title="تعديل الرسالة">✏️ تعديل</button>
              <button class="btn-user-tool btn-copy-user-msg" title="نسخ">📋 نسخ</button>
            </div>
          </div>
        </div>
      `;

      row.querySelector('.btn-copy-user-msg').addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        const btn = row.querySelector('.btn-copy-user-msg');
        btn.textContent = 'تم النسخ ✓';
        setTimeout(() => { btn.textContent = '📋 نسخ'; }, 2000);
      });

      row.querySelector('.btn-edit-user-msg').addEventListener('click', () => {
        promptTextarea.value = msg.content;
        promptTextarea.focus();
        promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
      });

    } else {
      // Assistant Message with Reasoning & Actions Bar
      let reasoningHtml = '';
      if (msg.reasoning) {
        reasoningHtml = `
          <details class="reasoning-accordion">
            <summary class="reasoning-summary">🧠 مسار الاستدلال والتفكير المتعمق (o1)</summary>
            <div class="reasoning-content">${escapeHtml(msg.reasoning)}</div>
          </details>
        `;
      }

      let citationsHtml = '';
      if (msg.citations) {
        let cits = [];
        try {
          cits = typeof msg.citations === 'string' ? JSON.parse(msg.citations) : msg.citations;
        } catch (e) {}
        if (Array.isArray(cits) && cits.length > 0) {
          citationsHtml = `
            <div class="sources-pills-bar">
              ${cits.map((c, i) => `
                <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="source-pill">
                  <span class="source-idx">[${i + 1}]</span>
                  <span>${escapeHtml(c.title)}</span>
                </a>
              `).join('')}
            </div>
          `;
        }
      }

      const parsedMarkdown = window.marked ? window.marked.parse(msg.content || '') : escapeHtml(msg.content || '');

      row.innerHTML = `
        <div class="message-inner">
          <div class="msg-avatar">MK</div>
          <div class="msg-content-wrapper">
            ${reasoningHtml}
            <div class="markdown-body">${parsedMarkdown}</div>
            ${citationsHtml}
            <div class="assistant-actions-bar">
              <button class="btn-action-tool btn-copy-reply" title="نسخ الرد">
                <span>📋</span> <span>نسخ</span>
              </button>
              <button class="btn-action-tool btn-read-aloud" title="قراءة صوتية">
                <span>🔊</span> <span>استماع</span>
              </button>
              <button class="btn-action-tool btn-regenerate-reply" title="إعادة التوليد">
                <span>🔄</span> <span>إعادة المحاولة</span>
              </button>
              <button class="btn-action-tool btn-thumbs-up" title="مفيد">👍</button>
              <button class="btn-action-tool btn-thumbs-down" title="غير دقيق">👎</button>
            </div>
          </div>
        </div>
      `;

      // Assistant action listeners
      row.querySelector('.btn-copy-reply').addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        const btn = row.querySelector('.btn-copy-reply span:last-child');
        btn.textContent = 'تم النسخ ✓';
        setTimeout(() => { btn.textContent = 'نسخ'; }, 2000);
      });

      row.querySelector('.btn-read-aloud').addEventListener('click', () => {
        handleTextToSpeech(msg.content, row.querySelector('.btn-read-aloud'));
      });

      row.querySelector('.btn-regenerate-reply').addEventListener('click', async () => {
        const msgs = await window.MK_DB.getMessages(currentConversationId);
        const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          promptTextarea.value = lastUserMsg.content;
          composerForm.dispatchEvent(new Event('submit'));
        }
      });

      row.querySelector('.btn-thumbs-up').addEventListener('click', (e) => {
        e.target.style.color = '#10a37f';
      });
      row.querySelector('.btn-thumbs-down').addEventListener('click', (e) => {
        e.target.style.color = '#ef4444';
      });
    }

    messagesViewport.appendChild(row);
    if (animate) scrollToBottom();

    attachCodeCopyButtons(row);
  }

  // 9. Text-to-Speech (Read Aloud)
  function handleTextToSpeech(text, btnElement) {
    if (!('speechSynthesis' in window)) {
      alert('ميزة القراءة الصوتية غير مدعومة في هذا المتصفح.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btnElement) btnElement.querySelector('span:last-child').textContent = 'استماع';
      return;
    }

    const cleanText = text.replace(/```[\s\S]*?```/g, 'تم تجاوز الكود البرمجي.').replace(/[#*`_]/g, '');
    currentSpeechUtterance = new SpeechSynthesisUtterance(cleanText);
    currentSpeechUtterance.lang = 'ar-SA';
    currentSpeechUtterance.rate = 1.05;

    currentSpeechUtterance.onstart = () => {
      if (btnElement) btnElement.querySelector('span:last-child').textContent = 'إيقاف ⏹';
    };
    currentSpeechUtterance.onend = () => {
      if (btnElement) btnElement.querySelector('span:last-child').textContent = 'استماع';
    };
    currentSpeechUtterance.onerror = () => {
      if (btnElement) btnElement.querySelector('span:last-child').textContent = 'استماع';
    };

    window.speechSynthesis.speak(currentSpeechUtterance);
  }

  // 10. Voice Dictation (Speech to Text)
  btnVoiceDictation.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('ميزة الإملاء الصوتي غير مدعومة في هذا المتصفح. استخدم Chrome أو Safari.');
      return;
    }

    if (isSpeechRecording) {
      speechRecognitionInstance.stop();
      isSpeechRecording = false;
      btnVoiceDictation.classList.remove('recording');
      return;
    }

    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.lang = 'ar-EG';
    speechRecognitionInstance.interimResults = false;
    speechRecognitionInstance.continuous = false;

    speechRecognitionInstance.onstart = () => {
      isSpeechRecording = true;
      btnVoiceDictation.classList.add('recording');
    };

    speechRecognitionInstance.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      promptTextarea.value = (promptTextarea.value ? promptTextarea.value + ' ' : '') + transcript;
      promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
      promptTextarea.focus();
    };

    speechRecognitionInstance.onend = () => {
      isSpeechRecording = false;
      btnVoiceDictation.classList.remove('recording');
    };

    speechRecognitionInstance.onerror = () => {
      isSpeechRecording = false;
      btnVoiceDictation.classList.remove('recording');
    };

    speechRecognitionInstance.start();
  });

  // 11. Code Blocks Copy & Highlighting
  function attachCodeCopyButtons(container) {
    container.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.code-header')) return;
      const code = pre.querySelector('code');
      const lang = code ? (code.className.match(/language-(\w+)/) || [])[1] || 'code' : 'code';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span>${lang}</span>
        <button class="btn-copy-code">نسخ الكود</button>
      `;

      header.querySelector('.btn-copy-code').addEventListener('click', () => {
        navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
        const btn = header.querySelector('.btn-copy-code');
        btn.textContent = 'تم النسخ ✓';
        setTimeout(() => { btn.textContent = 'نسخ الكود'; }, 2000);
      });

      pre.insertBefore(header, pre.firstChild);
    });

    if (window.hljs) {
      container.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }

  // 12. Auto Scroll & Floating Scroll Bottom Button
  function scrollToBottom() {
    messagesViewport.scrollTop = messagesViewport.scrollHeight;
    btnScrollBottom.style.display = 'none';
  }

  messagesViewport.addEventListener('scroll', () => {
    const distFromBottom = messagesViewport.scrollHeight - messagesViewport.scrollTop - messagesViewport.clientHeight;
    if (distFromBottom > 150) {
      btnScrollBottom.style.display = 'flex';
    } else {
      btnScrollBottom.style.display = 'none';
    }
  });

  btnScrollBottom.addEventListener('click', scrollToBottom);

  // 13. Composer & Prompt Handling
  promptTextarea.addEventListener('input', () => {
    promptTextarea.style.height = 'auto';
    promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
  });

  promptTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composerForm.dispatchEvent(new Event('submit'));
    }
  });

  // Attachments
  fileUploader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      await processUploadedFile(file);
    }
    renderAttachmentsPreview();
    fileUploader.value = '';
  });

  async function processUploadedFile(file) {
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + '\n';
        }
        activeAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          text: fullText,
          data: ''
        });
      } catch (err) {
        console.warn('PDF extraction failed:', err);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        activeAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
          text: ''
        });
        renderAttachmentsPreview();
      };
      reader.readAsDataURL(file);
    } else {
      const text = await file.text();
      activeAttachments.push({
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        text: text,
        data: ''
      });
    }
  }

  function renderAttachmentsPreview() {
    if (activeAttachments.length === 0) {
      attachmentsPreviewBar.style.display = 'none';
      attachmentsPreviewBar.innerHTML = '';
      return;
    }
    attachmentsPreviewBar.style.display = 'flex';
    attachmentsPreviewBar.innerHTML = '';

    activeAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.innerHTML = `
        <span>${att.type.startsWith('image') ? '🖼️' : '📄'}</span>
        <span class="filename">${escapeHtml(att.name)}</span>
        <button class="btn-remove-attachment" data-idx="${idx}">✕</button>
      `;
      chip.querySelector('.btn-remove-attachment').addEventListener('click', () => {
        activeAttachments.splice(idx, 1);
        renderAttachmentsPreview();
      });
      attachmentsPreviewBar.appendChild(chip);
    });
  }

  // Web Search Toggle
  btnWebSearchToggle.addEventListener('click', () => {
    isWebSearchEnabled = !isWebSearchEnabled;
    updateWebSearchUI();
  });

  function updateWebSearchUI() {
    btnWebSearchToggle.classList.toggle('active', isWebSearchEnabled);
    btnWebSearchToggle.querySelector('.lbl').textContent = isWebSearchEnabled 
      ? 'البحث في الويب: مفعّل 🌐' 
      : 'البحث في الويب';
  }

  // 14. Submit Prompt & Stop Generation
  composerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // If currently generating, Stop Generation!
    if (isGenerating) {
      window.MK_AI.stopGeneration();
      setGeneratingState(false);
      return;
    }

    const prompt = promptTextarea.value.trim();
    if (!prompt && activeAttachments.length === 0) return;

    promptTextarea.value = '';
    promptTextarea.style.height = 'auto';

    if (messagesViewport.querySelector('.welcome-container')) {
      messagesViewport.innerHTML = '';
    }

    // 1. Add User Message
    const userMsg = {
      conversation_id: currentConversationId,
      role: 'user',
      content: prompt,
      attachments: [...activeAttachments]
    };
    appendMessageToUI(userMsg);
    await window.MK_DB.addMessage(userMsg);

    // Auto update title
    const convs = await window.MK_DB.getConversations();
    const currentConv = convs.find(c => c.id === currentConversationId);
    if (currentConv && currentConv.title === 'محادثة جديدة' && prompt) {
      const shortTitle = prompt.length > 28 ? prompt.slice(0, 28) + '...' : prompt;
      await window.MK_DB.updateConversationTitle(currentConversationId, shortTitle);
      await renderConversationsList();
    }

    const currentFiles = [...activeAttachments];
    activeAttachments = [];
    renderAttachmentsPreview();

    // 2. Prepare Assistant Row in UI
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant';
    assistantRow.innerHTML = `
      <div class="message-inner">
        <div class="msg-avatar">MK</div>
        <div class="msg-content-wrapper">
          <div class="status-pill" id="liveStatusPill">
            <span class="loading-dots"><span>•</span><span>•</span><span>•</span></span>
            <span id="liveStatusText">جاري التفكير وكتابة الرد...</span>
          </div>
          <details class="reasoning-accordion" id="liveReasoningBox" style="display:none;" open>
            <summary class="reasoning-summary">🧠 مسار الاستدلال والتفكير المتعمق (o1)...</summary>
            <div class="reasoning-content" id="liveReasoningContent"></div>
          </details>
          <div class="markdown-body" id="liveAssistantMarkdown"></div>
          <div class="sources-pills-bar" id="liveSourcesBar" style="display:none;"></div>
        </div>
      </div>
    `;
    messagesViewport.appendChild(assistantRow);
    scrollToBottom();

    const liveMarkdown = assistantRow.querySelector('#liveAssistantMarkdown');
    const liveStatusPill = assistantRow.querySelector('#liveStatusPill');
    const liveStatusText = assistantRow.querySelector('#liveStatusText');
    const liveReasoningBox = assistantRow.querySelector('#liveReasoningBox');
    const liveReasoningContent = assistantRow.querySelector('#liveReasoningContent');
    const liveSourcesBar = assistantRow.querySelector('#liveSourcesBar');

    let accumulatedText = '';
    let accumulatedReasoning = '';
    let finalCitations = [];

    // Switch Send button to Stop button (⏹)
    setGeneratingState(true);

    const history = await window.MK_DB.getMessages(currentConversationId);

    // 3. Invoke Generation
    await window.MK_AI.generateResponse({
      prompt: prompt,
      conversationHistory: history,
      attachments: currentFiles,
      enableWebSearch: isWebSearchEnabled,
      model: currentModel,
      apiKey: customApiKey
    }, (chunk) => {
      if (chunk.type === 'status') {
        liveStatusText.textContent = chunk.message;
      } else if (chunk.type === 'reasoning') {
        liveReasoningBox.style.display = 'block';
        accumulatedReasoning += chunk.delta;
        liveReasoningContent.textContent = accumulatedReasoning;
        scrollToBottom();
      } else if (chunk.type === 'delta') {
        liveStatusPill.style.display = 'none';
        accumulatedText += chunk.content;
        liveMarkdown.innerHTML = window.marked ? window.marked.parse(accumulatedText) : escapeHtml(accumulatedText);
        scrollToBottom();
      } else if (chunk.type === 'done') {
        liveStatusPill.style.display = 'none';
        finalCitations = chunk.citations || [];
        if (finalCitations.length > 0) {
          liveSourcesBar.style.display = 'flex';
          liveSourcesBar.innerHTML = finalCitations.map((c, i) => `
            <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="source-pill">
              <span class="source-idx">[${i + 1}]</span>
              <span>${escapeHtml(c.title)}</span>
            </a>
          `).join('');
        }
        attachCodeCopyButtons(assistantRow);
      }
    });

    setGeneratingState(false);

    // 4. Save Final Message to SQLite
    const assistantMsgId = await window.MK_DB.addMessage({
      conversation_id: currentConversationId,
      role: 'assistant',
      content: accumulatedText,
      reasoning: accumulatedReasoning,
      citations: finalCitations
    });

    // Re-render message row to bind actions bar
    const savedMsg = (await window.MK_DB.getMessages(currentConversationId)).find(m => m.id === assistantMsgId);
    if (savedMsg) {
      assistantRow.remove();
      appendMessageToUI(savedMsg, false);
    }
  });

  function setGeneratingState(generating) {
    isGenerating = generating;
    if (generating) {
      btnSendOrStop.classList.add('generating');
      btnSendOrStop.title = 'إيقاف التوليد (⏹)';
      iconSend.style.display = 'none';
      iconStop.style.display = 'block';
    } else {
      btnSendOrStop.classList.remove('generating');
      btnSendOrStop.title = 'إرسال (Enter)';
      iconSend.style.display = 'block';
      iconStop.style.display = 'none';
    }
  }

  // 15. Export Current Chat
  btnExportCurrentChat.addEventListener('click', async () => {
    if (!currentConversationId) return;
    const md = await window.MK_DB.exportConversation(currentConversationId, 'markdown');
    downloadFile(md, `MK_Chat_${Date.now()}.md`, 'text/markdown');
  });

  // 16. Backup & Restore Modal Operations
  btnOpenBackupModal.addEventListener('click', async () => {
    const convs = await window.MK_DB.getConversations();
    statsConversationsCount.textContent = convs.length;
    backupModal.style.display = 'flex';
  });

  btnCloseBackupModal.addEventListener('click', () => {
    backupModal.style.display = 'none';
  });

  btnDownloadBackup.addEventListener('click', async () => {
    const backupJson = await window.MK_DB.exportFullBackup();
    downloadFile(backupJson, `MK_AI_Full_Backup_${Date.now()}.mkbackup`, 'application/json');
  });

  fileBackupInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await window.MK_DB.importFullBackup(text);
      alert(`تم استيراد النسخة الاحتياطية بنجاح!\nالمحادثات المسترجعة: ${res.conversationsCount}`);
      backupModal.style.display = 'none';
      await renderConversationsList();
      const convs = await window.MK_DB.getConversations();
      if (convs.length > 0) await switchConversation(convs[0].id);
    } catch (err) {
      alert('فشل استيراد النسخة الاحتياطية: ' + err.message);
    }
    fileBackupInput.value = '';
  });

  // 17. Settings Modal Operations
  btnOpenSettingsModal.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });

  btnCloseSettingsModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  selectAiEngine.addEventListener('change', () => {
    rowCustomApiKey.style.display = selectAiEngine.value === 'custom-api' ? 'flex' : 'none';
  });

  btnSaveSettings.addEventListener('click', async () => {
    currentModel = selectAiEngine.value;
    customApiKey = inputCustomApiKey.value.trim();
    isWebSearchEnabled = chkDefaultSearch.checked;

    await window.MK_DB.setSetting('ai_model', currentModel);
    await window.MK_DB.setSetting('custom_api_key', customApiKey);
    await window.MK_DB.setSetting('web_search_enabled', String(isWebSearchEnabled));

    updateModelUI(currentModel);
    updateWebSearchUI();
    settingsModal.style.display = 'none';
  });

  btnClearAllData.addEventListener('click', async () => {
    if (confirm('تحذير: هل أنت متأكد من حذف جميع المحادثات والبيانات بالكامل؟')) {
      localStorage.clear();
      indexedDB.deleteDatabase(window.MK_DB.indexedDbName);
      location.reload();
    }
  });

  // 18. Theme Toggle
  btnThemeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.classList.replace('dark-theme', 'light-theme');
      themeIcon.textContent = '🌙';
      localStorage.setItem('mk_ai_theme', 'light');
    } else {
      document.body.classList.replace('light-theme', 'dark-theme');
      themeIcon.textContent = '☀️';
      localStorage.setItem('mk_ai_theme', 'dark');
    }
  });

  // Utilities
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
