/**
 * MK AI - Client-Side In-Browser Python Code Interpreter (Pyodide WebAssembly)
 * Enables true serverless Python execution, NumPy, data analysis, Matplotlib plots,
 * and virtual filesystem manipulation directly in the browser.
 */

class MKPythonEngine {
  constructor() {
    this.pyodide = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }

  async loadPyodideEngine(onStatus = () => {}) {
    if (this.isLoaded && this.pyodide) return this.pyodide;
    if (this.isLoading && this.loadPromise) return this.loadPromise;

    this.isLoading = true;
    onStatus('⏳ جاري تحميل بيئة بايثون (Pyodide WASM)...');

    this.loadPromise = new Promise(async (resolve, reject) => {
      try {
        if (!window.loadPyodide) {
          await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js');
        }

        onStatus('⚙️ تهيئة معالج بايثون في الذاكرة...');
        this.pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
        });

        // Setup custom stdout / stderr capture
        this.pyodide.runPython(`
import sys
import io
import os

class OutputCapture:
    def __init__(self):
        self.stdout_buf = io.StringIO()
        self.stderr_buf = io.StringIO()
    def start(self):
        sys.stdout = self.stdout_buf
        sys.stderr = self.stderr_buf
    def reset(self):
        self.stdout_buf = io.StringIO()
        self.stderr_buf = io.StringIO()
        sys.stdout = self.stdout_buf
        sys.stderr = self.stderr_buf
    def get_output(self):
        return self.stdout_buf.getvalue(), self.stderr_buf.getvalue()

_mk_capture = OutputCapture()
`);

        this.isLoaded = true;
        this.isLoading = false;
        onStatus('✅ بيئة بايثون جاهزة للتشغيل!');
        resolve(this.pyodide);
      } catch (err) {
        this.isLoading = false;
        console.error('[MK Pyodide Error]:', err);
        onStatus('❌ تعذر تحميل بايثون: ' + err.message);
        reject(err);
      }
    });

    return this.loadPromise;
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load script: ' + src));
      document.head.appendChild(s);
    });
  }

  async runCode(code, files = [], onStatus = () => {}) {
    try {
      const py = await this.loadPyodideEngine(onStatus);
      onStatus('⚡ جاري تنفيذ كود Python...');

      // Mount virtual files if any (e.g. CSV, TXT)
      if (files && files.length > 0) {
        for (const file of files) {
          if (file.text || file.data) {
            const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileContent = file.text || file.data;
            py.FS.writeFile(fileName, fileContent);
          }
        }
      }

      // Check if code requires popular data packages like numpy, pandas, matplotlib
      const needsPackages = [];
      if (/import\s+numpy|from\s+numpy/i.test(code)) needsPackages.push('numpy');
      if (/import\s+pandas|from\s+pandas/i.test(code)) needsPackages.push('pandas');
      if (/import\s+matplotlib|from\s+matplotlib/i.test(code)) needsPackages.push('matplotlib');

      for (const pkg of needsPackages) {
        onStatus(`📦 استدعاء حزمة ${pkg}...`);
        await py.loadPackage(pkg);
      }

      // Execute code with capture and plot checking
      const wrappedExecutionScript = `
_mk_capture.reset()
_mk_capture.start()

_plot_b64 = None
try:
    exec('''${code.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")}''')
    
    # Check if matplotlib has rendered any figures
    if 'matplotlib.pyplot' in sys.modules:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            import base64
            img_buf = io.BytesIO()
            plt.savefig(img_buf, format='png', bbox_inches='tight')
            img_buf.seek(0)
            _plot_b64 = base64.b64encode(img_buf.read()).decode('utf-8')
            plt.close('all')
except Exception as e:
    import traceback
    traceback.print_exc(file=sys.stderr)

_stdout, _stderr = _mk_capture.get_output()
`;

      await py.runPythonAsync(wrappedExecutionScript);

      const stdout = py.globals.get('_stdout');
      const stderr = py.globals.get('_stderr');
      const plotB64 = py.globals.get('_plot_b64');

      onStatus(' اكتمل التنفيذ!');
      return {
        success: !stderr,
        stdout: stdout || '',
        stderr: stderr || '',
        plot: plotB64 ? `data:image/png;base64,${plotB64}` : null
      };

    } catch (err) {
      console.error('[MK Python Execution Error]:', err);
      return {
        success: false,
        stdout: '',
        stderr: err.message,
        plot: null
      };
    }
  }
}

window.MK_PYTHON = new MKPythonEngine();
