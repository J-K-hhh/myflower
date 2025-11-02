const modelUtils = require('../../utils/model_utils.js');
const backend = require('../../utils/backend_service.js');
const i18n = require('../../utils/i18n.js');
const exifUtils = require('../../utils/exif_utils.js');
Page({
  data: {
    tempImagePath: '',
    // 本地路径用于解析EXIF日期（cloud:// 时保留原始临时路径）
    tempImageLocalPath: '',
    // 照片日期（可编辑）
    photoDate: '',
    photoTimestamp: null,
    wateringDate: '',
    fertilizingDate: '',
    aiResult: {},
    isLoading: false,
    currentLocation: null,
    locationEnabled: false,
    selectedModel: 'baidu',
    i18n: i18n.getSection('add'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage()
  },
  onLoad: function () {
    this.updateTranslations();
    this.loadSettings();
    this.checkLocationPermission();
    // 移除自动API测试，避免无意义弹窗
  },

  onShow: function() {
    // 每次显示页面时重新加载设置，确保使用最新的模型选择
    this.updateTranslations();
    this.loadSettings();
    this.checkLocationPermission();
    this.setRandomTitle();
  },
  updateTranslations: function() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    this.setData({
      i18n: i18n.getSection('add', language),
      i18nCommon: i18n.getSection('common', language),
      language: language
    });
  },
  translate: function(namespace, keyPath, params = {}) {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
    const language = this.data.language || i18n.getLanguage();
    return i18n.t(namespace, keyPath, params, language);
  },
  
  setRandomTitle: function() {
    const app = getApp();
    app.setRandomTitle();
  },
  loadSettings: function() {
    const systemConfig = require('../../utils/system_config.js');
    const settings = wx.getStorageSync('appSettings') || {};
    const sysModel = (systemConfig.getAi().selectedModel) || null;
    this.setData({
      selectedModel: sysModel || settings.selectedModel || 'baidu'
    });
  },
  checkLocationPermission: function() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.setData({ locationEnabled: true });
          this.getCurrentLocation();
        }
      }
    });
  },
  getCurrentLocation: function() {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        this.setData({
          currentLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        });
      },
      fail: (err) => {
        console.log('获取位置失败:', err);
      }
    });
  },
  testApiConnection: function () {
    console.log('开始测试API连接，模型:', this.data.selectedModel);
    
    wx.showLoading({ title: this.translate('add', 'apiTest.testing') });
    
    // Baidu 改为云函数代理；其它模型仍按原逻辑
    const model = this.data.selectedModel;
    if (model === 'baidu') {
      try {
        wx.cloud.callFunction({ name: 'baidu-ai-proxy', data: { action: 'token' } })
          .then(r => {
            wx.hideLoading();
            if (r && r.result && r.result.ok) {
              wx.showToast({ title: this.translate('add', 'apiTest.successTitle'), icon: 'success' });
            } else {
              wx.showModal({ title: this.translate('add', 'apiTest.failedTitle') || '连接失败', content: (r && r.result && r.result.error) || 'unknown', showCancel: false });
            }
          })
          .catch(err => {
            wx.hideLoading();
            wx.showModal({ title: this.translate('add', 'apiTest.failedTitle') || '连接失败', content: err.message || 'unknown', showCancel: false });
          });
      } catch (e) {
        wx.hideLoading();
        wx.showModal({ title: this.translate('add', 'apiTest.failedTitle') || '连接失败', content: e.message || 'unknown', showCancel: false });
      }
      return;
    }
    // 非百度模型：保留原检查逻辑
    const modelConfig = modelUtils.getModelConfig(this.data.selectedModel);
    if (!modelConfig.apiKey) {
      wx.hideLoading();
      wx.showModal({
        title: this.translate('add', 'apiTest.missingKeyTitle'),
        content: this.translate('add', 'apiTest.missingKeyContent', { modelName: this.getModelDisplayName(this.data.selectedModel) }) + '',
        showCancel: false,
        confirmText: this.translate('common', 'ok')
      });
      return;
    }
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: this.translate('add', 'apiTest.successTitle'), icon: 'success', duration: 2000 });
      console.log('模型配置检查通过:', modelConfig.name);
    }, 1000);
  },

  chooseImage: function () {
    if (this.data.isLoading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed', 'original'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 去除EXIF调试弹窗
        // Upload to cloud when available; fallback to local saveFile
        if (backend.isAvailable()) {
          console.log('[add] cloud available, uploading image');
          backend.uploadImage(tempFilePath)
            .then(fileID => {
              // Use cloud fileID as image reference
              console.log('[add] upload success fileID:', fileID);
              this.setData({
                tempImagePath: fileID,
                tempImageLocalPath: tempFilePath,
                aiResult: {}
              });
              // 识别优先使用云文件ID，避免上传Base64超限
              this.recognizeImage(fileID);
              // 设置默认照片日期并弹出编辑窗口
              this.prepareAndOpenPhotoDateEditor(tempFilePath);
            })
            .catch((err) => {
              console.warn('[add] upload failed, fallback to saveFile:', err);
              const code = err && (err.errCode || err.code);
              let tip = this.translate('add', 'apiTest.cloudUploadFailedContent');
              if (code === -504003) {
                tip = '云存储权限或登录状态异常（错误码 -504003）。已改为本地保存，请在云开发控制台检查存储权限规则与体验版/成员设置。';
              }
              wx.showModal({
                title: this.translate('add', 'apiTest.cloudUploadFailedTitle'),
                content: tip,
                showCancel: false,
                confirmText: this.translate('common', 'gotIt')
              });
              wx.saveFile({
                tempFilePath: tempFilePath,
                success: (saveRes) => {
                  const savedPath = saveRes.savedFilePath;
                  this.setData({ tempImagePath: savedPath, tempImageLocalPath: savedPath, aiResult: {} });
                  this.recognizeImage(savedPath);
                  this.prepareAndOpenPhotoDateEditor(savedPath);
                },
                fail: (sfErr) => {
                  console.warn('[add] saveFile failed, fallback to temp path:', sfErr);
                  this.setData({ tempImagePath: tempFilePath, tempImageLocalPath: tempFilePath, aiResult: {} });
                  this.recognizeImage(tempFilePath);
                  this.prepareAndOpenPhotoDateEditor(tempFilePath);
                }
              });
            });
        } else {
          console.log('[add] cloud unavailable, using saveFile fallback');
          wx.showModal({
            title: this.translate('add', 'apiTest.cloudUnavailableTitle'),
            content: this.translate('add', 'apiTest.cloudUnavailableContent'),
            showCancel: false,
            confirmText: this.translate('common', 'gotIt')
          });
          wx.saveFile({
            tempFilePath: tempFilePath,
            success: (saveRes) => {
              const savedPath = saveRes.savedFilePath;
              this.setData({ tempImagePath: savedPath, tempImageLocalPath: savedPath, aiResult: {} });
              this.recognizeImage(savedPath);
              this.prepareAndOpenPhotoDateEditor(savedPath);
            },
            fail: (err) => {
              console.warn('[add] saveFile failed, fallback to temp path:', err);
              this.setData({ tempImagePath: tempFilePath, tempImageLocalPath: tempFilePath, aiResult: {} });
              this.recognizeImage(tempFilePath);
              this.prepareAndOpenPhotoDateEditor(tempFilePath);
            }
          });
        }
      }
    })
  },
  // 打开日期编辑器（添加植物场景）
  prepareAndOpenPhotoDateEditor: function(localPathForExif) {
    const nowTs = Date.now();
    const fallback = { timestamp: nowTs, dateString: new Date(nowTs).toISOString().split('T')[0] };
    const proceed = (defaultDate) => {
      try {
        wx.navigateTo({
          url: '/pages/photo-add/photo-add',
          success: (res) => {
            const ec = res.eventChannel;
            try { ec.emit('initData', { filePath: this.data.tempImageLocalPath || this.data.tempImagePath, dateInfo: defaultDate }); } catch (e) {}
            if (ec && ec.on) {
              ec.on('onPhotoDateSelected', (payload) => {
                const info = (payload && payload.dateInfo) || defaultDate;
                this.setData({ photoDate: info.dateString, photoTimestamp: info.timestamp });
                if (this._submitAfterDate === true) {
                  this._submitAfterDate = false;
                  this.formSubmit();
                }
              });
            }
          }
        });
      } catch (e) {}
    };
    try {
      exifUtils.extractImageDate(localPathForExif).then((d) => proceed(d || fallback)).catch(() => proceed(fallback));
    } catch (e) {
      proceed(fallback);
    }
  },
  bindPhotoDateChange: function(e) {
    const value = e.detail.value;
    const ts = new Date(value).getTime();
    this.setData({ photoDate: value, photoTimestamp: ts });
  },
  recognizeImage: function (filePath) {
    this.setData({ isLoading: true });
    const location = this.data.locationEnabled ? this.data.currentLocation : null;
    this.showRecognitionProgress(this.translate('add', 'recognition.analyzing'));
    modelUtils.recognizePlant(filePath, location, (message) => {
      if (message) this.showRecognitionProgress(message);
    })
    .then(res => {
      this.setData({ aiResult: res, isLoading: false });
      wx.hideLoading();
    })
    .catch(err => {
      this.setData({ isLoading: false });
      wx.hideLoading();
      wx.showModal({
        title: this.translate('add', 'recognition.failedTitle'),
        content: this.translate('add', 'recognition.failedContent', { error: err.message || this.translate('add', 'recognition.errorPlaceholder') }),
        showCancel: false,
        confirmText: this.translate('common', 'ok')
      });
    });
  },

  // 显示识别进度
  showRecognitionProgress: function(message) {
    wx.showLoading({
      title: message,
      mask: true
    });
  },
  
  bindWateringDateChange: function (e) {
    this.setData({
      wateringDate: e.detail.value
    });
  },
  bindFertilizingDateChange: function (e) {
    this.setData({
      fertilizingDate: e.detail.value
    });
  },
  formSubmit: function () {
    console.log('[add] formSubmit start');
    if (!this.data.tempImagePath) {
      wx.showToast({ title: this.translate('add', 'recognition.selectImageFirst'), icon: 'none' });
      return;
    }
    if (this.data.isLoading) {
      wx.showToast({ title: this.translate('add', 'recognition.recognizingWait'), icon: 'none' });
      return;
    }
    // 若未选择或未确认照片日期，先弹出日期编辑器
    if (!this.data.photoDate || !this.data.photoTimestamp) {
      this._submitAfterDate = true;
      const lp = this.data.tempImageLocalPath || this.data.tempImagePath;
      if (lp) {
        this.prepareAndOpenPhotoDateEditor(lp);
        return;
      }
    }
    const plantList = wx.getStorageSync('plantList') || [];
    // Enforce system-level plant count limit
    try {
      const systemConfig = require('../../utils/system_config.js');
      const limits = systemConfig.getLimits();
      if (Array.isArray(plantList) && plantList.length >= (limits.maxPlantsPerUser || 200)) {
        wx.showToast({ title: this.translate('add', 'recognition.limitReached') || '已达植物数量上限', icon: 'none' });
        return;
      }
    } catch (e) {}

    const d = (this.data.photoDate && this.data.photoTimestamp)
      ? { timestamp: this.data.photoTimestamp, dateString: this.data.photoDate }
      : (function(){ const nowTs = Date.now(); return { timestamp: nowTs, dateString: new Date(nowTs).toISOString().split('T')[0] }; })();
      const newPlant = {
        id: Date.now(),
        createTime: d.timestamp,
        createDate: new Date(d.timestamp).toLocaleDateString(),
        images: [this.data.tempImagePath],
        imageInfos: [{
          path: this.data.tempImagePath,
          timestamp: d.timestamp,
          date: d.dateString,
          memo: ''
        }],
        lastWateringDate: this.data.wateringDate,
        lastFertilizingDate: this.data.fertilizingDate,
        aiResult: this.data.aiResult,
        // 默认未手动调整顺序
        manualOrder: false,
        wateringHistory: this.data.wateringDate ? [{
          date: this.data.wateringDate,
          timestamp: new Date(this.data.wateringDate).getTime()
        }] : [],
        fertilizingHistory: this.data.fertilizingDate ? [{
          date: this.data.fertilizingDate,
          timestamp: new Date(this.data.fertilizingDate).getTime()
        }] : []
      };
      plantList.unshift(newPlant);
      wx.setStorageSync('plantList', plantList);
      console.log('[add] local saved, total count:', plantList.length);
      // Persist to cloud database once (best-effort, with short timeout)
      const ensurePersist = new Promise((resolve) => {
        try {
          if (backend && backend.savePlantList) {
            backend.savePlantList(plantList).then(() => resolve()).catch(() => resolve());
          } else { resolve(); }
        } catch (e) { resolve(); }
        // Safety timeout 1s
        setTimeout(() => resolve(), 1000);
      });
      ensurePersist.then(() => {
        wx.showToast({
          title: this.translate('add', 'recognition.successModalTitle'),
          icon: 'success',
          duration: 800
        });
        // 标记首页需要刷新
        try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
        setTimeout(() => {
          wx.navigateBack();
        }, 800);
      });
  },

  getModelDisplayName: function(modelId) {
    const id = modelId || this.data.selectedModel;
    if (!id) return '';
    if (id === 'baidu') {
      return this.translate('add', 'info.modelBaidu');
    }
    if (id.indexOf('qwen') === 0) {
      return this.translate('add', 'info.modelQwen');
    }
    if (id.indexOf('gemini') === 0) {
      return 'Gemini';
    }
    return id;
  }
});
