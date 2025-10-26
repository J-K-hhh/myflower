// System-level configuration module
// Provides defaults and read/write helpers for backend, AI, and limits
// Stored in local storage under key `systemConfig` but may be extended to fetch from cloud.

const DEFAULT_CONFIG = {
  backend: {
    // Supported: 'tencent' (WeChat Cloud), 'local' (no cloud), 'custom-http'
    type: 'tencent',
    options: {
      // For custom-http adapter
      baseUrl: '',
      apiKey: ''
    }
  },
  ai: {
    // System-wide selected model. Users may have a preference but system can enforce.
    selectedModel: 'baidu',
    models: {
      'baidu': {
        name: 'baidu',
        apiKey: '',
        secretKey: ''
      },
      // Placeholders; do not ship real keys in client code.
      'qwen-vl-max-2025-08-13': {
        name: 'qwen-vl-max-2025-08-13',
        apiKey: '',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        timeout: 60000,
        maxImageSize: 300000
      },
      'qwen-vl-max': {
        name: 'qwen-vl-max',
        apiKey: '',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        timeout: 60000,
        maxImageSize: 300000
      },
      'qwen-vl-max-latest': {
        name: 'qwen-vl-max-latest',
        apiKey: '',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        timeout: 60000,
        maxImageSize: 300000
      },
      'gemini-pro-vision': {
        name: 'gemini-pro-vision',
        apiKey: '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent',
        timeout: 60000,
        maxImageSize: 120000
      }
    }
  },
  limits: {
    maxPlantsPerUser: 200,
    maxImagesPerPlant: 10,
    maxRecordsPerPlant: 50
  }
};

function _readConfig() {
  try {
    const stored = wx.getStorageSync('systemConfig');
    if (stored && typeof stored === 'object') {
      return { ...DEFAULT_CONFIG, ...stored, ai: { ...DEFAULT_CONFIG.ai, ...(stored.ai || {}) } };
    }
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

function _writeConfig(cfg) {
  try { wx.setStorageSync('systemConfig', cfg); } catch (e) {}
}

function getConfig() { return _readConfig(); }

function setConfig(patch) {
  const current = _readConfig();
  const next = { ...current, ...patch };
  _writeConfig(next);
  return next;
}

function getBackend() {
  const cfg = _readConfig();
  return cfg.backend || DEFAULT_CONFIG.backend;
}

function setBackend(type, options = {}) {
  const cfg = _readConfig();
  cfg.backend = { type, options: { ...(cfg.backend && cfg.backend.options), ...options } };
  _writeConfig(cfg);
  return cfg.backend;
}

function getAi() {
  const cfg = _readConfig();
  return cfg.ai || DEFAULT_CONFIG.ai;
}

function setAi(patch) {
  const cfg = _readConfig();
  cfg.ai = { ...cfg.ai, ...patch };
  _writeConfig(cfg);
  return cfg.ai;
}

function getModelConfig(modelName = null) {
  const ai = getAi();
  const name = modelName || ai.selectedModel || 'baidu';
  return ai.models[name] || ai.models['qwen-vl-max-2025-08-13'];
}

function getLimits() {
  const cfg = _readConfig();
  return cfg.limits || DEFAULT_CONFIG.limits;
}

function setLimits(patch) {
  const cfg = _readConfig();
  cfg.limits = { ...cfg.limits, ...patch };
  _writeConfig(cfg);
  return cfg.limits;
}

module.exports = {
  getConfig,
  setConfig,
  getBackend,
  setBackend,
  getAi,
  setAi,
  getModelConfig,
  getLimits,
  setLimits
};
