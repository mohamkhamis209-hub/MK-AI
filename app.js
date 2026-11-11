/**
 * MK AI - Advanced ChatGPT-Style Application Controller
 * Elite Supercharged Edition with 6 Core Pillars:
 * 1. Interactive Code Artifacts & Live Canvas Sandbox (Desktop/Tablet/Mobile viewports)
 * 2. Real-time Live Voice Mode (Animated Fluid Glowing Voice Orb & Continuous Interruption)
 * 3. AI Image Generation Studio (Flux High-Res Generator with Lightbox)
 * 4. Custom MK GPTs Store & Persona Builder (Stored in SQLite)
 * 5. In-Browser Semantic Vector RAG (Multi-page PDF Cosine Similarity Search)
 * 6. Interactive Data Charts Visualizer (Markdown Tables to Chart.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. STATE & GLOBAL CONFIGURATION
  // =========================================================================
  let currentConversationId = null;
  let activeAttachments = [];
  let isWebSearchEnabled = false;
  let currentModel = 'mk-4o';
  let customApiKey = '';
  let isSoundEnabled = true;
  let isGenerating = false;
  let activeCustomGpt = null;
  let currentArtifact = null;

  // Voice State
  let isLiveVoiceActive = false;
  let voiceRecognitionInstance = null;
  let isVoiceMuted = false;
  let voiceState = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
  let voiceAnimFrameId = null;
  let voicePhase = 0;

  // Fast Dictation State
  let speechDictationInstance = null;
  let isSpeechRecording = false;
  let currentSpeechUtterance = null;
  let deferredInstallPrompt = null;

  // Chart State
  let activeChartInstance = null;
  let activeChartData = null;
  let currentChartType = 'bar';

  // =========================================================================
  // 2. DOM ELEMENTS SELECTION
  // =========================================================================
  const messagesViewport = document.getElementById('messagesViewport');
  const promptTextarea = document.getElementById('promptTextarea');
  const composerForm = document.getElementById('composerForm');
  const fileUploader = document.getElementById('fileUploader');
  const attachmentsPreviewBar = document.getElementById('attachmentsPreviewBar');
  const btnSendOrStop = document.getElementById('btnSendOrStop');
  const iconSend = document.getElementById('iconSend');
  const iconStop = document.getElementById('iconStop');
  const btnVoiceDictation = document.getElementById('btnVoiceDictation');
  const btnQuickImageGen = document.getElementById('btnQuickImageGen');
  const btnScrollBottom = document.getElementById('btnScrollBottom');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const btnNewChat = document.getElementById('btnNewChat');
  const sidebarHistory = document.getElementById('sidebarHistory');
  const inputSearchChats = document.getElementById('inputSearchChats');
  const btnWebSearchToggle = document.getElementById('btnWebSearchToggle');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const btnInstallPwa = document.getElementById('btnInstallPwa');
  const dbStatusBadge = document.getElementById('dbStatusBadge');

  // In-Chat Search
  const btnToggleInChatSearch = document.getElementById('btnToggleInChatSearch');
  const inchatSearchBar = document.getElementById('inchatSearchBar');
  const inputInChatQuery = document.getElementById('inputInChatQuery');
  const searchMatchesCount = document.getElementById('searchMatchesCount');
  const btnCloseInChatSearch = document.getElementById('btnCloseInChatSearch');

  // Export Dropdown
  const btnExportMenuTrigger = document.getElementById('btnExportMenuTrigger');
  const exportDropdownMenu = document.getElementById('exportDropdownMenu');
  const btnExportMarkdown = document.getElementById('btnExportMarkdown');
  const btnExportHtmlPdf = document.getElementById('btnExportHtmlPdf');
  const btnExportJson = document.getElementById('btnExportJson');

  // Model Dropdown
  const modelDropdownTrigger = document.getElementById('modelDropdownTrigger');
  const modelDropdownMenu = document.getElementById('modelDropdownMenu');
  const activeModelLabel = document.getElementById('activeModelLabel');
  const modelMenuItems = document.querySelectorAll('.model-menu-item');

  // 1. Artifacts Live Canvas Drawer
  const artifactsCanvasDrawer = document.getElementById('artifactsCanvasDrawer');
  const canvasArtifactTitle = document.getElementById('canvasArtifactTitle');
  const btnDownloadArtifact = document.getElementById('btnDownloadArtifact');
  const btnToggleCodeView = document.getElementById('btnToggleCodeView');
  const btnCloseArtifactCanvas = document.getElementById('btnCloseArtifactCanvas');
  const liveSandboxIframe = document.getElementById('liveSandboxIframe');
  const canvasBodyContainer = document.getElementById('canvasBodyContainer');
  const canvasCodeWrapper = document.getElementById('canvasCodeWrapper');
  const canvasCodeContent = document.getElementById('canvasCodeContent');
  const vpTabs = document.querySelectorAll('.btn-vp-tab');

  // 2. Real-Time Live Voice Mode Overlay
  const btnLaunchLiveVoice = document.getElementById('btnLaunchLiveVoice');
  const btnTriggerVoiceModeSidebar = document.getElementById('btnTriggerVoiceModeSidebar');
  const voiceModeOverlay = document.getElementById('voiceModeOverlay');
  const btnCloseVoiceMode = document.getElementById('btnCloseVoiceMode');
  const btnEndVoiceCall = document.getElementById('btnEndVoiceCall');
  const btnToggleVoiceMute = document.getElementById('btnToggleVoiceMute');
  const voiceOrbPulse = document.getElementById('voiceOrbPulse');
  const voiceOrbCore = document.getElementById('voiceOrbCore');
  const voiceVisualizerCanvas = document.getElementById('voiceVisualizerCanvas');
  const voiceStatusLabel = document.getElementById('voiceStatusLabel');
  const voiceSubtitlesBox = document.getElementById('voiceSubtitlesBox');

  // 3. Custom GPTs Store Modal
  const btnOpenGptsStore = document.getElementById('btnOpenGptsStore');
  const gptsStoreModal = document.getElementById('gptsStoreModal');
  const btnCloseGptsModal = document.getElementById('btnCloseGptsModal');
  const tabGptExplore = document.getElementById('tabGptExplore');
  const tabGptCreate = document.getElementById('tabGptCreate');
  const paneGptExplore = document.getElementById('paneGptExplore');
  const paneGptCreate = document.getElementById('paneGptCreate');
  const gptsStoreGrid = document.getElementById('gptsStoreGrid');
  const createGptForm = document.getElementById('createGptForm');
  const inputGptAvatar = document.getElementById('inputGptAvatar');
  const inputGptName = document.getElementById('inputGptName');
  const inputGptDescription = document.getElementById('inputGptDescription');
  const inputGptPrompt = document.getElementById('inputGptPrompt');

  // 4. Interactive Data Chart Modal (Chart.js)
  const chartViewerModal = document.getElementById('chartViewerModal');
  const btnCloseChartModal = document.getElementById('btnCloseChartModal');
  const chartModalTitle = document.getElementById('chartModalTitle');
  const interactiveDataCanvas = document.getElementById('interactiveDataCanvas');
  const btnDownloadChartPng = document.getElementById('btnDownloadChartPng');
  const chartTypeButtons = document.querySelectorAll('.btn-chart-type');

  // 5. Image Lightbox Modal
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const lightboxImage = document.getElementById('lightboxImage');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');
  const btnDownloadLightboxImg = document.getElementById('btnDownloadLightboxImg');

  // 6. Backup & Restore Modal
  const backupModal = document.getElementById('backupModal');
  const btnOpenBackupModal = document.getElementById('btnOpenBackupModal');
  const btnCloseBackupModal = document.getElementById('btnCloseBackupModal');
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  const fileBackupInput = document.getElementById('fileBackupInput');
  const statsConversationsCount = document.getElementById('statsConversationsCount');

  // 7. Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettingsModal = document.getElementById('btnOpenSettingsModal');
  const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
  const selectAiEngine = document.getElementById('selectAiEngine');
  const rowCustomApiKey = document.getElementById('rowCustomApiKey');
  const inputCustomApiKey = document.getElementById('inputCustomApiKey');
  const chkSoundEffects = document.getElementById('chkSoundEffects');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnClearAllData = document.getElementById('btnClearAllData');

  // =========================================================================
  // 3. SYNCHRONOUS EVENT LISTENERS ATTACHMENT (Never Blocked by Async Code)
  // =========================================================================

  // Sidebar Toggles
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarBackdrop.classList.toggle('active');
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    });
  }

  if (btnNewChat) {
    btnNewChat.addEventListener('click', async () => {
      await startNewConversation();
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
      }
    });
  }

  if (inputSearchChats) {
    inputSearchChats.addEventListener('input', () => {
      renderConversationsList(inputSearchChats.value);
    });
  }

  // Model Dropdown
  if (modelDropdownTrigger) {
    modelDropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
      const isShown = modelDropdownMenu.style.display === 'block';
      modelDropdownMenu.style.display = isShown ? 'none' : 'block';
    });
  }

  document.addEventListener('click', () => {
    if (modelDropdownMenu) modelDropdownMenu.style.display = 'none';
    if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
  });

  modelMenuItems.forEach((item) => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selected = item.dataset.model;
      currentModel = selected;
      activeCustomGpt = null;
      updateModelUI(selected);
      if (window.MK_DB) await window.MK_DB.setSetting('ai_model', selected);
      modelDropdownMenu.style.display = 'none';
    });
  });

  // Export Dropdown
  if (btnExportMenuTrigger) {
    btnExportMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modelDropdownMenu) modelDropdownMenu.style.display = 'none';
      const isShown = exportDropdownMenu.style.display === 'block';
      exportDropdownMenu.style.display = isShown ? 'none' : 'block';
    });
  }

  if (btnExportMarkdown) {
    btnExportMarkdown.addEventListener('click', async () => {
      if (!currentConversationId) return;
      const md = await window.MK_DB.exportConversation(currentConversationId, 'markdown');
      downloadFile(md, `MK_Chat_${Date.now()}.md`, 'text/markdown');
      exportDropdownMenu.style.display = 'none';
    });
  }

  if (btnExportHtmlPdf) {
    btnExportHtmlPdf.addEventListener('click', async () => {
      if (!currentConversationId) return;
      const html = await window.MK_DB.exportConversation(currentConversationId, 'html');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      } else {
        downloadFile(html, `MK_Chat_${Date.now()}.html`, 'text/html');
      }
      exportDropdownMenu.style.display = 'none';
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', async () => {
      if (!currentConversationId) return;
      const json = await window.MK_DB.exportConversation(currentConversationId, 'json');
      downloadFile(json, `MK_Chat_${Date.now()}.json`, 'application/json');
      exportDropdownMenu.style.display = 'none';
    });
  }

  // In-Chat Search
  if (btnToggleInChatSearch) {
    btnToggleInChatSearch.addEventListener('click', () => {
      const isShown = inchatSearchBar.style.display === 'flex';
      inchatSearchBar.style.display = isShown ? 'none' : 'flex';
      if (!isShown) {
        inputInChatQuery.focus();
      } else {
        clearInChatSearch();
      }
    });
  }

  if (btnCloseInChatSearch) {
    btnCloseInChatSearch.addEventListener('click', () => {
      inchatSearchBar.style.display = 'none';
      clearInChatSearch();
    });
  }

  if (inputInChatQuery) {
    inputInChatQuery.addEventListener('input', () => {
      const query = inputInChatQuery.value.trim().toLowerCase();
      const rows = messagesViewport.querySelectorAll('.message-row');
      if (!query) {
        searchMatchesCount.textContent = '0 نتيجة';
        rows.forEach(r => r.classList.remove('highlight-search'));
        return;
      }

      let matchCount = 0;
      let firstMatch = null;
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
          row.classList.add('highlight-search');
          matchCount++;
          if (!firstMatch) firstMatch = row;
        } else {
          row.classList.remove('highlight-search');
        }
      });

      searchMatchesCount.textContent = `${matchCount} نتيجة`;
      if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Web Search Toggle
  if (btnWebSearchToggle) {
    btnWebSearchToggle.addEventListener('click', () => {
      isWebSearchEnabled = !isWebSearchEnabled;
      btnWebSearchToggle.classList.toggle('active', isWebSearchEnabled);
      btnWebSearchToggle.querySelector('.lbl').textContent = isWebSearchEnabled 
        ? 'بحث الويب: دائم 🌐' 
        : 'بحث الويب: ذكي';
    });
  }

  // Theme Toggle
  if (btnThemeToggle) {
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
  }

  // Artifacts Canvas Controls
  if (btnCloseArtifactCanvas) {
    btnCloseArtifactCanvas.addEventListener('click', () => {
      artifactsCanvasDrawer.style.display = 'none';
    });
  }

  if (btnToggleCodeView) {
    btnToggleCodeView.addEventListener('click', () => {
      if (canvasCodeWrapper.style.display === 'none') {
        canvasCodeWrapper.style.display = 'block';
        liveSandboxIframe.style.display = 'none';
        btnToggleCodeView.textContent = '🖥️ معاينة';
      } else {
        canvasCodeWrapper.style.display = 'none';
        liveSandboxIframe.style.display = 'block';
        btnToggleCodeView.textContent = '💻 كود';
      }
    });
  }

  if (btnDownloadArtifact) {
    btnDownloadArtifact.addEventListener('click', () => {
      if (!currentArtifact) return;
      const ext = currentArtifact.type === 'svg' ? '.svg' : '.html';
      const mime = currentArtifact.type === 'svg' ? 'image/svg+xml' : 'text/html';
      downloadFile(currentArtifact.code, `MK_Artifact_${Date.now()}${ext}`, mime);
    });
  }

  vpTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      vpTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const vp = tab.dataset.vp;
      canvasBodyContainer.className = 'canvas-body ' + (vp === 'tablet' ? 'vp-tablet' : vp === 'mobile' ? 'vp-mobile' : '');
    });
  });

  // Real-Time Live Voice Controls
  if (btnLaunchLiveVoice) btnLaunchLiveVoice.addEventListener('click', launchLiveVoiceMode);
  if (btnTriggerVoiceModeSidebar) btnTriggerVoiceModeSidebar.addEventListener('click', launchLiveVoiceMode);
  if (btnCloseVoiceMode) btnCloseVoiceMode.addEventListener('click', closeLiveVoiceMode);
  if (btnEndVoiceCall) btnEndVoiceCall.addEventListener('click', closeLiveVoiceMode);

  if (btnToggleVoiceMute) {
    btnToggleVoiceMute.addEventListener('click', () => {
      isVoiceMuted = !isVoiceMuted;
      btnToggleVoiceMute.textContent = isVoiceMuted ? '🔇' : '🎙️';
      btnToggleVoiceMute.style.background = isVoiceMuted ? '#ef4444' : 'var(--bg-hover)';
      if (isVoiceMuted) {
        voiceStatusLabel.textContent = 'الميكروفون مكتوم';
        if (voiceRecognitionInstance) {
          try { voiceRecognitionInstance.stop(); } catch (e) {}
        }
      } else {
        setVoiceState('listening');
        initVoiceRecognition();
      }
    });
  }

  // AI Image Quick Action & Lightbox
  if (btnQuickImageGen) {
    btnQuickImageGen.addEventListener('click', () => {
      promptTextarea.value = 'ارسم صورة احترافية فائقة الدقة لـ ';
      promptTextarea.focus();
      promptTextarea.style.height = 'auto';
      promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
    });
  }

  if (btnCloseLightbox) {
    btnCloseLightbox.addEventListener('click', () => {
      imageLightboxModal.style.display = 'none';
    });
  }

  if (imageLightboxModal) {
    imageLightboxModal.addEventListener('click', (e) => {
      if (e.target === imageLightboxModal) {
        imageLightboxModal.style.display = 'none';
      }
    });
  }

  // Custom GPTs Store
  if (btnOpenGptsStore) {
    btnOpenGptsStore.addEventListener('click', async () => {
      await renderGptsStore();
      gptsStoreModal.style.display = 'flex';
    });
  }

  if (btnCloseGptsModal) {
    btnCloseGptsModal.addEventListener('click', () => {
      gptsStoreModal.style.display = 'none';
    });
  }

  if (tabGptExplore) {
    tabGptExplore.addEventListener('click', () => {
      tabGptExplore.classList.add('active');
      tabGptCreate.classList.remove('active');
      paneGptExplore.style.display = 'block';
      paneGptCreate.style.display = 'none';
    });
  }

  if (tabGptCreate) {
    tabGptCreate.addEventListener('click', () => {
      tabGptCreate.classList.add('active');
      tabGptExplore.classList.remove('active');
      paneGptCreate.style.display = 'block';
      paneGptExplore.style.display = 'none';
    });
  }

  if (createGptForm) {
    createGptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const avatar = inputGptAvatar.value.trim() || '🤖';
      const name = inputGptName.value.trim();
      const description = inputGptDescription.value.trim();
      const prompt = inputGptPrompt.value.trim();

      if (!name || !description || !prompt) return;

      await window.MK_DB.addCustomGPT({
        avatar,
        name,
        description,
        system_prompt: prompt,
        is_preset: 0
      });

      createGptForm.reset();
      inputGptAvatar.value = '🤖';
      tabGptExplore.click();
      await renderGptsStore();
      alert(`تم إنشاء المساعد "${name}" بنجاح في متجر MK GPTs!`);
    });
  }

  // Chart Viewer Controls
  chartTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      renderInteractiveChart(btn.dataset.type);
    });
  });

  if (btnCloseChartModal) {
    btnCloseChartModal.addEventListener('click', () => {
      chartViewerModal.style.display = 'none';
      if (activeChartInstance) {
        activeChartInstance.destroy();
        activeChartInstance = null;
      }
    });
  }

  if (btnDownloadChartPng) {
    btnDownloadChartPng.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `MK_Chart_${Date.now()}.png`;
      link.href = interactiveDataCanvas.toDataURL('image/png');
      link.click();
    });
  }

  // Backup & Restore
  if (btnOpenBackupModal) {
    btnOpenBackupModal.addEventListener('click', async () => {
      const convs = await window.MK_DB.getConversations();
      statsConversationsCount.textContent = convs.length;
      backupModal.style.display = 'flex';
    });
  }

  if (btnCloseBackupModal) {
    btnCloseBackupModal.addEventListener('click', () => {
      backupModal.style.display = 'none';
    });
  }

  if (btnDownloadBackup) {
    btnDownloadBackup.addEventListener('click', async () => {
      const backupJson = await window.MK_DB.exportFullBackup();
      downloadFile(backupJson, `MK_AI_Full_Backup_${Date.now()}.mkbackup`, 'application/json');
    });
  }

  if (fileBackupInput) {
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
  }

  // Settings
  if (btnOpenSettingsModal) {
    btnOpenSettingsModal.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });
  }

  if (btnCloseSettingsModal) {
    btnCloseSettingsModal.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (selectAiEngine) {
    selectAiEngine.addEventListener('change', () => {
      rowCustomApiKey.style.display = selectAiEngine.value === 'custom-api' ? 'flex' : 'none';
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      currentModel = selectAiEngine.value;
      customApiKey = inputCustomApiKey.value.trim();
      isSoundEnabled = chkSoundEffects.checked;

      await window.MK_DB.setSetting('ai_model', currentModel);
      await window.MK_DB.setSetting('custom_api_key', customApiKey);
      await window.MK_DB.setSetting('sound_effects_enabled', String(isSoundEnabled));

      updateModelUI(currentModel);
      settingsModal.style.display = 'none';
    });
  }

  if (btnClearAllData) {
    btnClearAllData.addEventListener('click', async () => {
      if (confirm('تحذير: هل أنت متأكد من حذف جميع المحادثات والبيانات بالكامل؟')) {
        localStorage.clear();
        indexedDB.deleteDatabase(window.MK_DB.indexedDbName);
        location.reload();
      }
    });
  }

  // Voice Dictation
  if (btnVoiceDictation) {
    btnVoiceDictation.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('ميزة الإملاء الصوتي غير مدعومة في هذا المتصفح. استخدم متصفح Chrome أو Safari.');
        return;
      }

      if (isSpeechRecording) {
        if (speechDictationInstance) speechDictationInstance.stop();
        isSpeechRecording = false;
        btnVoiceDictation.classList.remove('recording');
        return;
      }

      speechDictationInstance = new SpeechRecognition();
      speechDictationInstance.lang = 'ar-EG';
      speechDictationInstance.interimResults = false;
      speechDictationInstance.continuous = false;

      speechDictationInstance.onstart = () => {
        isSpeechRecording = true;
        btnVoiceDictation.classList.add('recording');
      };

      speechDictationInstance.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        promptTextarea.value = (promptTextarea.value ? promptTextarea.value + ' ' : '') + transcript;
        promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 200) + 'px';
        promptTextarea.focus();
      };

      speechDictationInstance.onend = () => {
        isSpeechRecording = false;
        btnVoiceDictation.classList.remove('recording');
      };

      speechDictationInstance.onerror = () => {
        isSpeechRecording = false;
        btnVoiceDictation.classList.remove('recording');
      };

      speechDictationInstance.start();
    });
  }

  // Scroll Bottom Button
  if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', scrollToBottom);
  }

  if (messagesViewport) {
    messagesViewport.addEventListener('scroll', () => {
      const distFromBottom = messagesViewport.scrollHeight - messagesViewport.scrollTop - messagesViewport.clientHeight;
      if (distFromBottom > 150) {
        btnScrollBottom.style.display = 'flex';
      } else {
        btnScrollBottom.style.display = 'none';
      }
    });
  }

  // Composer Input & Auto-grow
  if (promptTextarea) {
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
  }

  // Attachments Uploader
  if (fileUploader) {
    fileUploader.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await processUploadedFile(file);
      }
      renderAttachmentsPreview();
      fileUploader.value = '';
    });
  }

  // Composer Form Submit
  if (composerForm) {
    composerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

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

      playAudioCue('send');

      // Add User Message
      const userMsg = {
        conversation_id: currentConversationId,
        role: 'user',
        content: prompt,
        attachments: [...activeAttachments]
      };
      appendMessageToUI(userMsg);
      await window.MK_DB.addMessage(userMsg);

      // Auto title update
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

      // Prepare Assistant Row
      const assistantRow = document.createElement('div');
      assistantRow.className = 'message-row assistant';
      assistantRow.innerHTML = `
        <div class="message-inner">
          <div class="msg-avatar">MK</div>
          <div class="msg-content-wrapper">
            <div class="status-pill" id="liveStatusPill">
              <span class="loading-dots"><span>•</span><span>•</span><span>•</span></span>
              <span id="liveStatusText">جاري التفكير وصياغة الرد...</span>
            </div>
            <details class="reasoning-accordion" id="liveReasoningBox" style="display:none;" open>
              <summary class="reasoning-summary">🧠 مسار الاستدلال والتفكير المتعمق (o1)...</summary>
              <div class="reasoning-content" id="liveReasoningContent"></div>
            </details>
            <div class="markdown-body" id="liveAssistantMarkdown"></div>
            <div id="liveArtifactContainer"></div>
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
      const liveArtifactContainer = assistantRow.querySelector('#liveArtifactContainer');

      let accumulatedText = '';
      let accumulatedReasoning = '';
      let finalCitations = [];
      let generatedArtifact = null;

      setGeneratingState(true);

      const history = await window.MK_DB.getMessages(currentConversationId);

      // Invoke Generation
      await window.MK_AI.generateResponse({
        prompt: prompt,
        conversationHistory: history,
        attachments: currentFiles,
        enableWebSearch: isWebSearchEnabled,
        model: currentModel,
        apiKey: customApiKey,
        customGpt: activeCustomGpt
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
          generatedArtifact = chunk.artifact || null;

          if (finalCitations.length > 0) {
            liveSourcesBar.style.display = 'flex';
            liveSourcesBar.innerHTML = `<span style="font-size:11px;color:var(--text-muted);font-weight:bold;width:100%;margin-bottom:2px;">مصادر موثوقة:</span>` +
              finalCitations.map((c, i) => `
                <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="source-pill">
                  <span class="source-idx">[${i + 1}]</span>
                  <span>${escapeHtml(c.title)}</span>
                </a>
              `).join('');
          }

          // Handle Image Artifact
          if (generatedArtifact && generatedArtifact.type === 'image') {
            liveArtifactContainer.innerHTML = `
              <div class="ai-image-card">
                <div class="ai-image-wrapper">
                  <img src="${generatedArtifact.url}" alt="${escapeHtml(generatedArtifact.prompt)}" class="generated-image-thumb" loading="lazy">
                  <div class="image-overlay-actions">
                    <button class="btn-image-action btn-zoom-art" data-url="${generatedArtifact.url}">🔍 تكبير</button>
                    <a href="${generatedArtifact.url}" download="MK_Flux_Image.png" class="btn-image-action" target="_blank">📥 تنزيل</a>
                  </div>
                </div>
              </div>
            `;
            const zoomBtn = liveArtifactContainer.querySelector('.btn-zoom-art');
            if (zoomBtn) zoomBtn.addEventListener('click', () => openImageLightbox(generatedArtifact.url));
          }

          // Handle Code Artifact Auto Launch
          if (generatedArtifact && (generatedArtifact.type === 'html' || generatedArtifact.type === 'svg')) {
            openArtifactCanvas(generatedArtifact);
          }

          attachCodeCopyButtons(assistantRow);
          scanAndAttachChartButtons(assistantRow);
          playAudioCue('chime');
        }
      });

      setGeneratingState(false);

      // Save to SQLite
      const assistantMsgId = await window.MK_DB.addMessage({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: accumulatedText,
        reasoning: accumulatedReasoning,
        citations: finalCitations,
        artifact_data: generatedArtifact ? JSON.stringify(generatedArtifact) : null
      });

      const savedMsg = (await window.MK_DB.getMessages(currentConversationId)).find(m => m.id === assistantMsgId);
      if (savedMsg) {
        assistantRow.remove();
        appendMessageToUI(savedMsg, false);
      }
    });
  }

  // =========================================================================
  // 4. ASYNC INITIALIZATION & DATA LOADING (Non-blocking with Timeout)
  // =========================================================================
  async function initApplicationData() {
    try {
      // Allow max 4 seconds for DB initialization
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 4000));
      await Promise.race([window.MK_DB.initPromise, timeoutPromise]);

      if (dbStatusBadge) {
        dbStatusBadge.textContent = window.MK_DB.isWasmLoaded ? 'قاعدة SQLite: نشطة محلياً' : 'قاعدة SQLite: نشطة';
      }

      currentModel = await window.MK_DB.getSetting('ai_model', 'mk-4o');
      customApiKey = await window.MK_DB.getSetting('custom_api_key', '');
      isSoundEnabled = (await window.MK_DB.getSetting('sound_effects_enabled', 'true')) === 'true';

      updateModelUI(currentModel);
      if (selectAiEngine) selectAiEngine.value = currentModel;
      if (inputCustomApiKey) inputCustomApiKey.value = customApiKey;
      if (chkSoundEffects) chkSoundEffects.checked = isSoundEnabled;

      const savedTheme = localStorage.getItem('mk_ai_theme') || 'dark';
      if (savedTheme === 'light') {
        document.body.classList.replace('dark-theme', 'light-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
      }

      await renderConversationsList();
      const convs = await window.MK_DB.getConversations();
      if (convs.length > 0) {
        await switchConversation(convs[0].id);
      } else {
        await startNewConversation();
      }
    } catch (err) {
      console.warn('[MK App] Non-fatal init warning:', err);
      renderMessagesViewport([]);
    }
  }

  // Run data initialization
  initApplicationData();

  // =========================================================================
  // 5. HELPER FUNCTIONS & CONTROLLERS
  // =========================================================================

  function playAudioCue(type) {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'chime') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  }

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

  function updateModelUI(modelId) {
    modelMenuItems.forEach(item => {
      item.classList.toggle('active', item.dataset.model === modelId);
    });

    if (activeCustomGpt) {
      activeModelLabel.textContent = `${activeCustomGpt.avatar} ${activeCustomGpt.name}`;
      return;
    }

    if (modelId === 'mk-o1') {
      activeModelLabel.textContent = '🧠 MK o1 (تفكير عميق)';
    } else if (modelId === 'mk-coder') {
      activeModelLabel.textContent = '💻 MK Coder (مهندس برمجيات)';
    } else if (modelId === 'mk-creative') {
      activeModelLabel.textContent = '🎨 MK Creative (إبداعي وأدبي)';
    } else {
      activeModelLabel.textContent = '✨ MK 4o (الذكي والسريع)';
    }
  }

  async function startNewConversation(title = 'محادثة جديدة', model = currentModel, gpt = null) {
    const id = 'conv-' + Date.now();
    activeCustomGpt = gpt;
    if (window.MK_DB) {
      await window.MK_DB.createConversation(id, title, model);
      await renderConversationsList();
      await switchConversation(id);
    }
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
    if (!sidebarHistory) return;
    sidebarHistory.innerHTML = '';
    const list = await window.MK_DB.getConversations();
    const filtered = filterQuery 
      ? list.filter(c => c.title.toLowerCase().includes(filterQuery.toLowerCase()))
      : list;

    if (filtered.length === 0) {
      sidebarHistory.innerHTML = `<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted)">لا توجد محادثات سابقة</div>`;
      return;
    }

    const pinnedItems = filtered.filter(c => c.is_pinned === 1);
    const unpinnedItems = filtered.filter(c => !c.is_pinned);

    if (pinnedItems.length > 0) {
      renderHistoryGroup('📌 المحادثات المثبتة', pinnedItems);
    }

    const groups = { today: [], yesterday: [], week: [], older: [] };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    unpinnedItems.forEach((conv) => {
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
      item.className = `chat-history-item ${conv.id === currentConversationId ? 'active' : ''} ${conv.is_pinned ? 'pinned' : ''}`;
      item.dataset.id = conv.id;

      item.innerHTML = `
        <span class="chat-title-text" title="${escapeHtml(conv.title)}">${conv.is_pinned ? '📌 ' : ''}${escapeHtml(conv.title)}</span>
        <div class="chat-actions">
          <button class="btn-chat-action" data-action="pin" title="${conv.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}">📌</button>
          <button class="btn-chat-action" data-action="rename" title="إعادة التسمية">✏️</button>
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

      item.querySelector('[data-action="pin"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.MK_DB.togglePinConversation(conv.id);
        await renderConversationsList(inputSearchChats.value);
      });

      item.querySelector('[data-action="rename"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = prompt('أدخل الاسم الجديد للمحادثة:', conv.title);
        if (newTitle && newTitle.trim()) {
          await window.MK_DB.updateConversationTitle(conv.id, newTitle.trim());
          await renderConversationsList(inputSearchChats.value);
        }
      });

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

  function clearInChatSearch() {
    inputInChatQuery.value = '';
    searchMatchesCount.textContent = '0 نتيجة';
    messagesViewport.querySelectorAll('.message-row').forEach(r => r.classList.remove('highlight-search'));
  }

  function renderMessagesViewport(messages) {
    if (!messagesViewport) return;
    messagesViewport.innerHTML = '';

    if (!messages || messages.length === 0) {
      messagesViewport.innerHTML = `
        <div class="welcome-container">
          <div class="welcome-logo">MK</div>
          <h2 class="welcome-title">أهلاً بك، كيف يمكنني مساعدتك اليوم؟</h2>
          <p class="welcome-sub">
            أنا <strong>MK AI</strong>، مساعدك الخارق. جاهز لأي محادثة، الإجابة عن كل تساؤل، كتابة الأكواد وتشغيلها في القماش الحي، رسم الصور، وتحليل البيانات.
          </p>
          <div class="prompt-suggestions-grid">
            <div class="prompt-card" data-prompt="ارسم صورة لسيارة مستقبلية فائقة السرعة تسير في شوارع نيون بدقة 4K">
              🎨 <strong>استوديو الصور (Flux)</strong>
              <div>توليد صور واقعية فائقة الجمال</div>
            </div>
            <div class="prompt-card" data-prompt="اكتب لي كود لعبة Snake كاملة مع واجهة تفاعلية لتشغيلها في القماش الحي">
              📦 <strong>القماش الحي (Live Canvas)</strong>
              <div>بناء وتشغيل تطبيقات وألعاب فورية</div>
            </div>
            <div class="prompt-card" data-prompt="اعمل جدول مقارنة إحصائي بين أداء موديلات الذكاء الاصطناعي مع أرقام دقيقة">
              📊 <strong>الرسوم البيانية (Chart.js)</strong>
              <div>تحويل الجداول لرسوم بيانية تفاعلية</div>
            </div>
            <div class="prompt-card" data-prompt="ما هي أحدث تطورات وسيناريوهات الذكاء الاصطناعي لعام 2026؟">
              🌐 <strong>بحث وتدقيق الحقائق</strong>
              <div>معلومات حية ومصادر موثوقة</div>
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
      // Assistant Message
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
              <span style="font-size:11px;color:var(--text-muted);font-weight:bold;width:100%;margin-bottom:2px;">مصادر موثوقة:</span>
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

      const artifact = window.MK_AI.extractCodeArtifact(msg.content);

      let imageCardHtml = '';
      if (msg.artifact_data) {
        try {
          const artData = JSON.parse(msg.artifact_data);
          if (artData.type === 'image') {
            imageCardHtml = `
              <div class="ai-image-card">
                <div class="ai-image-wrapper">
                  <img src="${artData.url}" alt="${escapeHtml(artData.prompt)}" class="generated-image-thumb" loading="lazy">
                  <div class="image-overlay-actions">
                    <button class="btn-image-action btn-zoom-art" data-url="${artData.url}">🔍 تكبير</button>
                    <a href="${artData.url}" download="MK_Flux_Image.png" class="btn-image-action" target="_blank">📥 تنزيل</a>
                  </div>
                </div>
              </div>
            `;
          }
        } catch (e) {}
      }

      const parsedMarkdown = window.marked ? window.marked.parse(msg.content || '') : escapeHtml(msg.content || '');

      row.innerHTML = `
        <div class="message-inner">
          <div class="msg-avatar">MK</div>
          <div class="msg-content-wrapper">
            ${reasoningHtml}
            <div class="markdown-body">${parsedMarkdown}</div>
            ${imageCardHtml}
            ${citationsHtml}
            <div class="assistant-actions-bar">
              <button class="btn-action-tool btn-copy-reply" title="نسخ الرد">
                <span>📋</span> <span>نسخ</span>
              </button>
              <button class="btn-action-tool btn-read-aloud" title="قراءة صوتية">
                <span>🔊</span> <span>استماع</span>
              </button>
              ${artifact ? `
                <button class="btn-action-tool btn-open-canvas-action" title="تشغيل في القماش الحي">
                  <span>🚀</span> <span>تشغيل في القماش</span>
                </button>
              ` : ''}
              <button class="btn-action-tool btn-regenerate-reply" title="إعادة التوليد">
                <span>🔄</span> <span>إعادة المحاولة</span>
              </button>
              <button class="btn-action-tool btn-thumbs-up" title="مفيد">👍</button>
              <button class="btn-action-tool btn-thumbs-down" title="غير دقيق">👎</button>
            </div>
          </div>
        </div>
      `;

      row.querySelector('.btn-copy-reply').addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        const btn = row.querySelector('.btn-copy-reply span:last-child');
        btn.textContent = 'تم النسخ ✓';
        setTimeout(() => { btn.textContent = 'نسخ'; }, 2000);
      });

      row.querySelector('.btn-read-aloud').addEventListener('click', () => {
        handleTextToSpeech(msg.content, row.querySelector('.btn-read-aloud'));
      });

      if (artifact) {
        const btnCanvas = row.querySelector('.btn-open-canvas-action');
        if (btnCanvas) {
          btnCanvas.addEventListener('click', () => openArtifactCanvas(artifact));
        }
      }

      const btnZoom = row.querySelector('.btn-zoom-art');
      if (btnZoom) {
        btnZoom.addEventListener('click', () => openImageLightbox(btnZoom.dataset.url));
      }

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
    scanAndAttachChartButtons(row);
  }

  function handleTextToSpeech(text, btnElement) {
    if (!('speechSynthesis' in window)) {
      alert('ميزة القراءة الصوتية غير مدعومة في هذا المتصفح.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btnElement) {
        btnElement.classList.remove('speaking');
        btnElement.querySelector('span:last-child').textContent = 'استماع';
      }
      return;
    }

    const cleanText = text.replace(/```[\s\S]*?```/g, 'تم تجاوز الكود البرمجي.').replace(/[#*`_]/g, '');
    currentSpeechUtterance = new SpeechSynthesisUtterance(cleanText);
    currentSpeechUtterance.lang = 'ar-SA';
    currentSpeechUtterance.rate = 1.05;

    currentSpeechUtterance.onstart = () => {
      if (btnElement) {
        btnElement.classList.add('speaking');
        btnElement.querySelector('span:last-child').textContent = 'إيقاف ⏹';
      }
    };
    currentSpeechUtterance.onend = () => {
      if (btnElement) {
        btnElement.classList.remove('speaking');
        btnElement.querySelector('span:last-child').textContent = 'استماع';
      }
    };
    currentSpeechUtterance.onerror = () => {
      if (btnElement) {
        btnElement.classList.remove('speaking');
        btnElement.querySelector('span:last-child').textContent = 'استماع';
      }
    };

    window.speechSynthesis.speak(currentSpeechUtterance);
  }

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

  function scrollToBottom() {
    if (!messagesViewport) return;
    messagesViewport.scrollTop = messagesViewport.scrollHeight;
    if (btnScrollBottom) btnScrollBottom.style.display = 'none';
  }

  // File Upload Processing
  async function processUploadedFile(file) {
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const pagesData = [];

        for (let i = 1; i <= Math.min(pdf.numPages, 18); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
          pagesData.push({ pageNumber: i, text: pageText });
        }

        if (window.MK_RAG) {
          await window.MK_RAG.indexDocument('doc_' + Date.now(), file.name, fullText, pagesData);
        }

        activeAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          text: fullText,
          data: '',
          isRagIndexed: true
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
      if (window.MK_RAG) {
        await window.MK_RAG.indexDocument('doc_' + Date.now(), file.name, text);
      }
      activeAttachments.push({
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        text: text,
        data: '',
        isRagIndexed: true
      });
    }
  }

  function renderAttachmentsPreview() {
    if (!attachmentsPreviewBar) return;
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
        ${att.isRagIndexed ? '<span style="color:#10a37f;font-size:10px;font-weight:bold;">⚡ RAG</span>' : ''}
        <button class="btn-remove-attachment" data-idx="${idx}">✕</button>
      `;
      chip.querySelector('.btn-remove-attachment').addEventListener('click', () => {
        activeAttachments.splice(idx, 1);
        renderAttachmentsPreview();
      });
      attachmentsPreviewBar.appendChild(chip);
    });
  }

  // Artifacts Drawer
  function openArtifactCanvas(artifact) {
    if (!artifact || !artifact.code) return;
    currentArtifact = artifact;
    canvasArtifactTitle.textContent = artifact.title || 'تطبيق تفاعلي حي';
    artifactsCanvasDrawer.style.display = 'flex';

    liveSandboxIframe.srcdoc = artifact.code;
    canvasCodeContent.textContent = artifact.code;
    if (window.hljs) {
      window.hljs.highlightElement(canvasCodeContent);
    }

    liveSandboxIframe.style.display = 'block';
    canvasCodeWrapper.style.display = 'none';
    btnToggleCodeView.textContent = '💻 كود';
  }

  // Voice Mode
  function launchLiveVoiceMode() {
    isLiveVoiceActive = true;
    voiceModeOverlay.style.display = 'flex';
    setVoiceState('listening');
    voiceSubtitlesBox.textContent = 'أهلاً بك! أنا معك صوتياً، اسألني عن أي شيء وسأجيبك فوراً وبشكل طبيعي.';
    startVoiceVisualizerLoop();
    initVoiceRecognition();
  }

  function closeLiveVoiceMode() {
    isLiveVoiceActive = false;
    voiceModeOverlay.style.display = 'none';
    if (voiceAnimFrameId) cancelAnimationFrame(voiceAnimFrameId);
    if (voiceRecognitionInstance) {
      try { voiceRecognitionInstance.stop(); } catch (e) {}
      voiceRecognitionInstance = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function setVoiceState(state) {
    voiceState = state;
    if (state === 'listening') {
      voiceStatusLabel.textContent = 'استماع... تحدث بحرية';
      voiceOrbCore.style.background = 'radial-gradient(circle, #38ef7d 0%, #11998e 100%)';
      voiceOrbPulse.style.background = 'radial-gradient(circle, rgba(16, 163, 127, 0.6) 0%, rgba(16, 163, 127, 0) 70%)';
    } else if (state === 'thinking') {
      voiceStatusLabel.textContent = '🧠 جاري التفكير والتحليل...';
      voiceOrbCore.style.background = 'radial-gradient(circle, #a855f7 0%, #6366f1 100%)';
      voiceOrbPulse.style.background = 'radial-gradient(circle, rgba(168, 85, 247, 0.6) 0%, rgba(99, 102, 241, 0) 70%)';
    } else if (state === 'speaking') {
      voiceStatusLabel.textContent = 'MK AI يتحدث...';
      voiceOrbCore.style.background = 'radial-gradient(circle, #10b981 0%, #059669 100%)';
      voiceOrbPulse.style.background = 'radial-gradient(circle, rgba(16, 185, 129, 0.7) 0%, rgba(5, 150, 105, 0) 70%)';
    }
  }

  function startVoiceVisualizerLoop() {
    const canvas = voiceVisualizerCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    function renderFrame() {
      if (!isLiveVoiceActive) return;
      ctx.clearRect(0, 0, width, height);
      voicePhase += 0.04;

      const numRings = voiceState === 'speaking' ? 4 : voiceState === 'thinking' ? 3 : 2;
      const baseRadius = 60;

      for (let i = 0; i < numRings; i++) {
        ctx.beginPath();
        const freq = (i + 1) * 2;
        const amplitude = voiceState === 'speaking' ? 18 + Math.sin(voicePhase * 3 + i) * 12 : voiceState === 'thinking' ? 10 : 5;
        const currentR = baseRadius + i * 22;

        for (let angle = 0; angle <= Math.PI * 2; angle += 0.08) {
          const offset = Math.sin(angle * freq + voicePhase + i) * amplitude;
          const r = currentR + offset;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (voiceState === 'speaking') {
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.4 + i * 0.15})`;
          ctx.lineWidth = 2.5;
        } else if (voiceState === 'thinking') {
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.35 + i * 0.15})`;
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + i * 0.1})`;
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }

      voiceAnimFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();
  }

  function initVoiceRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      voiceSubtitlesBox.textContent = 'المتصفح لا يدعم ميزة التعرف الصوتي المباشر. يرجى تجربة متصفح Google Chrome.';
      return;
    }

    voiceRecognitionInstance = new SpeechRec();
    voiceRecognitionInstance.lang = 'ar-SA';
    voiceRecognitionInstance.continuous = true;
    voiceRecognitionInstance.interimResults = true;

    let silenceTimer = null;
    let accumulatedUserVoicePrompt = '';

    voiceRecognitionInstance.onresult = (e) => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const item = e.results[i];
        if (item.isFinal) {
          accumulatedUserVoicePrompt += ' ' + item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const displayTranscript = accumulatedUserVoicePrompt || interim;
      if (displayTranscript) {
        voiceSubtitlesBox.textContent = `🗣️ أنت: "${displayTranscript.trim()}"`;
      }

      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(async () => {
        const finalPrompt = accumulatedUserVoicePrompt.trim();
        if (finalPrompt && !isVoiceMuted && isLiveVoiceActive) {
          accumulatedUserVoicePrompt = '';
          await processVoiceInteraction(finalPrompt);
        }
      }, 1600);
    };

    voiceRecognitionInstance.onerror = (e) => {
      console.warn('[Voice Mode Rec Error]:', e);
    };

    voiceRecognitionInstance.onend = () => {
      if (isLiveVoiceActive && !isVoiceMuted && voiceState !== 'speaking') {
        try { voiceRecognitionInstance.start(); } catch (err) {}
      }
    };

    try {
      voiceRecognitionInstance.start();
    } catch (e) {}
  }

  async function processVoiceInteraction(promptText) {
    if (!isLiveVoiceActive) return;
    setVoiceState('thinking');
    voiceSubtitlesBox.textContent = '🧠 جاري التفكير وصياغة الرد...';

    let aiVoiceReply = '';
    const history = await window.MK_DB.getMessages(currentConversationId);

    await window.MK_AI.generateResponse({
      prompt: promptText,
      conversationHistory: history,
      model: currentModel,
      apiKey: customApiKey,
      customGpt: activeCustomGpt
    }, (chunk) => {
      if (chunk.type === 'delta') {
        aiVoiceReply += chunk.content;
      }
    });

    if (!isLiveVoiceActive) return;

    const cleanSpeech = aiVoiceReply
      .replace(/```[\s\S]*?```/g, 'تم عرض الكود في الشاشة.')
      .replace(/[#*`_>]/g, '')
      .trim();

    setVoiceState('speaking');
    voiceSubtitlesBox.textContent = `🤖 MK: "${aiVoiceReply.slice(0, 180)}..."`;

    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(cleanSpeech);
      utter.lang = 'ar-SA';
      utter.rate = 1.05;

      utter.onend = () => {
        if (isLiveVoiceActive) {
          setVoiceState('listening');
          voiceSubtitlesBox.textContent = 'استماع... تحدث بحرية.';
          if (voiceRecognitionInstance) {
            try { voiceRecognitionInstance.start(); } catch (e) {}
          }
        }
      };

      utter.onerror = () => {
        if (isLiveVoiceActive) setVoiceState('listening');
      };

      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => {
        if (isLiveVoiceActive) setVoiceState('listening');
      }, 3000);
    }
  }

  function openImageLightbox(url) {
    lightboxImage.src = url;
    btnDownloadLightboxImg.href = url;
    imageLightboxModal.style.display = 'flex';
  }

  async function renderGptsStore() {
    gptsStoreGrid.innerHTML = '';
    const gpts = await window.MK_DB.getCustomGPTs();

    gpts.forEach((gpt) => {
      const card = document.createElement('div');
      card.className = 'gpt-card';
      card.innerHTML = `
        <div class="gpt-card-header">
          <div class="gpt-avatar">${escapeHtml(gpt.avatar || '🤖')}</div>
          <div class="gpt-title-box">
            <h4>${escapeHtml(gpt.name)}</h4>
            ${gpt.is_preset ? '<span class="gpt-badge-preset">رسمي</span>' : '<span class="gpt-badge-custom">مخصص</span>'}
          </div>
        </div>
        <p class="gpt-card-desc">${escapeHtml(gpt.description)}</p>
        <div class="gpt-card-actions">
          <button class="btn-start-gpt" data-id="${gpt.id}">💬 بدء محادثة</button>
          ${!gpt.is_preset ? `<button class="btn-delete-gpt" data-id="${gpt.id}" title="حذف">🗑️</button>` : ''}
        </div>
      `;

      card.querySelector('.btn-start-gpt').addEventListener('click', async () => {
        gptsStoreModal.style.display = 'none';
        await startNewConversation(`${gpt.avatar} ${gpt.name}`, 'custom-gpt', gpt);
        updateModelUI(gpt.id);
      });

      if (!gpt.is_preset) {
        card.querySelector('.btn-delete-gpt').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`هل أنت متأكد من حذف المساعد "${gpt.name}"؟`)) {
            await window.MK_DB.deleteCustomGPT(gpt.id);
            await renderGptsStore();
          }
        });
      }

      gptsStoreGrid.appendChild(card);
    });
  }

  function scanAndAttachChartButtons(containerEl) {
    if (!window.Chart) return;
    const tables = containerEl.querySelectorAll('.markdown-body table');

    tables.forEach((table) => {
      if (table.dataset.hasChartBtn) return;
      table.dataset.hasChartBtn = 'true';

      const tableData = extractTableData(table);
      if (!tableData || tableData.datasets.length === 0) return;

      const btnChart = document.createElement('button');
      btnChart.className = 'btn-visualize-table';
      btnChart.innerHTML = `<span>📊</span> تحويل الجدول إلى رسم بياني تفاعلي (Chart.js)`;
      btnChart.addEventListener('click', () => {
        activeChartData = tableData;
        chartModalTitle.textContent = `📊 رسم بياني تفاعلي: ${tableData.title}`;
        chartViewerModal.style.display = 'flex';
        renderInteractiveChart(currentChartType);
      });

      table.parentNode.insertBefore(btnChart, table.nextSibling);
    });
  }

  function extractTableData(table) {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (headers.length < 2 || rows.length === 0) return null;

    const labels = [];
    const values = [];

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
      if (cells.length >= 2) {
        labels.push(cells[0]);
        const num = parseFloat(cells[1].replace(/[^0-9.-]/g, ''));
        values.push(isNaN(num) ? 0 : num);
      }
    });

    if (labels.length === 0 || values.every(v => v === 0)) return null;

    return {
      title: headers[1] || 'البيانات',
      labels: labels,
      datasets: [{
        label: headers[1] || 'القيم',
        data: values,
        backgroundColor: [
          'rgba(16, 163, 127, 0.7)',
          'rgba(56, 189, 248, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(20, 184, 166, 0.7)'
        ],
        borderColor: [
          '#10a37f',
          '#38bdf8',
          '#a855f7',
          '#f59e0b',
          '#ef4444',
          '#14b8a6'
        ],
        borderWidth: 1.5
      }]
    };
  }

  function renderInteractiveChart(type) {
    if (!activeChartData || !window.Chart) return;
    currentChartType = type;

    chartTypeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });

    if (activeChartInstance) {
      activeChartInstance.destroy();
    }

    const ctx = interactiveDataCanvas.getContext('2d');
    activeChartInstance = new Chart(ctx, {
      type: type,
      data: {
        labels: activeChartData.labels,
        datasets: activeChartData.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#d1d5db',
              font: { family: 'inherit', size: 12 }
            }
          }
        },
        scales: (type === 'bar' || type === 'line') ? {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } }
        } : {}
      }
    });
  }

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
