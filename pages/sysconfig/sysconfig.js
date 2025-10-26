const systemConfig = require('../../utils/system_config.js');

Page({
  data: {
    backend: { type: 'tencent', options: { baseUrl: '', apiKey: '' } },
    ai: { selectedModel: 'baidu', models: {} },
    limits: { maxPlantsPerUser: 200, maxImagesPerPlant: 10, maxRecordsPerPlant: 50 },
    modelOptions: [
      { id: 'baidu', name: 'baidu' },
      { id: 'qwen-vl-max-2025-08-13', name: 'qwen-vl-max-2025-08-13' },
      { id: 'gemini-pro-vision', name: 'gemini-pro-vision' }
    ],
    modelIndex: 0
  },
  onLoad() {
    this.reload();
  },
  reload() {
    const cfg = systemConfig.getConfig();
    const idx = Math.max(0, this.data.modelOptions.findIndex(o => o.id === (cfg.ai && cfg.ai.selectedModel)));
    this.setData({ backend: cfg.backend, ai: cfg.ai, limits: cfg.limits, modelIndex: idx });
  },
  // Backend
  onBackendTypeChange(e) {
    const type = e.detail.value;
    const backend = { ...this.data.backend, type };
    this.setData({ backend });
  },
  onBaseUrlInput(e) {
    const backend = { ...this.data.backend, options: { ...this.data.backend.options, baseUrl: e.detail.value } };
    this.setData({ backend });
  },
  onHttpApiKeyInput(e) {
    const backend = { ...this.data.backend, options: { ...this.data.backend.options, apiKey: e.detail.value } };
    this.setData({ backend });
  },
  // AI
  onModelPick(e) {
    const i = Number(e.detail.value || 0);
    const id = this.data.modelOptions[i].id;
    const ai = { ...this.data.ai, selectedModel: id };
    this.setData({ ai, modelIndex: i });
  },
  onBaiduKeyInput(e) {
    const ai = { ...this.data.ai, models: { ...this.data.ai.models, baidu: { ...this.data.ai.models.baidu, apiKey: (e.detail.value || '').trim() } } };
    this.setData({ ai });
  },
  onBaiduSecretInput(e) {
    const ai = { ...this.data.ai, models: { ...this.data.ai.models, baidu: { ...this.data.ai.models.baidu, secretKey: (e.detail.value || '').trim() } } };
    this.setData({ ai });
  },
  onQwenKeyInput(e) {
    const models = { ...this.data.ai.models };
    const cur = models['qwen-vl-max-2025-08-13'] || {};
    models['qwen-vl-max-2025-08-13'] = { ...cur, apiKey: (e.detail.value || '').trim() };
    this.setData({ ai: { ...this.data.ai, models } });
  },
  onGeminiKeyInput(e) {
    const models = { ...this.data.ai.models };
    const cur = models['gemini-pro-vision'] || {};
    models['gemini-pro-vision'] = { ...cur, apiKey: (e.detail.value || '').trim() };
    this.setData({ ai: { ...this.data.ai, models } });
  },
  // Limits
  onMaxPlantsInput(e) {
    const n = Math.max(1, Number(e.detail.value || 0));
    this.setData({ limits: { ...this.data.limits, maxPlantsPerUser: n } });
  },
  onMaxImagesInput(e) {
    const n = Math.max(1, Number(e.detail.value || 0));
    this.setData({ limits: { ...this.data.limits, maxImagesPerPlant: n } });
  },
  onMaxRecordsInput(e) {
    const n = Math.max(1, Number(e.detail.value || 0));
    this.setData({ limits: { ...this.data.limits, maxRecordsPerPlant: n } });
  },
  // Save
  saveAll() {
    systemConfig.setBackend(this.data.backend.type, this.data.backend.options);
    systemConfig.setAi(this.data.ai);
    systemConfig.setLimits(this.data.limits);
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});

