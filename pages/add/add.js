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
    this.testApiConnection();
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
    
    // 使用新的模型配置检查
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
    
    // 模拟API测试（实际测试需要真实请求）
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: this.translate('add', 'apiTest.successTitle'),
        icon: 'success',
        duration: 2000
      });
      console.log('模型配置检查通过:', modelConfig.name);
    }, 1000);
  },

  chooseImage: function () {
    if (this.data.isLoading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 调试弹窗：读取EXIF日期
        try {
          exifUtils.extractImageDateWithDebug(tempFilePath).then((dbg) => {
            const title = '照片日期调试';
            const content = dbg && dbg.success
              ? `成功读取日期\n时间戳: ${dbg.data.timestamp}\n日期: ${dbg.data.dateString}`
              : `未能读取日期\n原因: ${dbg ? dbg.reason : 'unknown'}\n详情: ${dbg ? dbg.details : ''}`;
            wx.showModal({ title, content, showCancel: false, confirmText: this.translate('common', 'ok') });
          }).catch(() => {});
        } catch (e) {}
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
              // For recognition, still need a real file path; use tempFilePath
              this.recognizeImage(tempFilePath);
              // 设置默认照片日期并弹出编辑窗口
              this.prepareAndOpenPhotoDateEditor(tempFilePath);
            })
            .catch((err) => {
              console.warn('[add] upload failed, fallback to saveFile:', err);
              wx.showModal({
                title: this.translate('add', 'apiTest.cloudUploadFailedTitle'),
                content: this.translate('add', 'apiTest.cloudUploadFailedContent'),
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
    const currentModel = modelUtils.getCurrentModel();
    console.log('当前选择的模型:', currentModel);
    console.log('页面数据中的模型:', this.data.selectedModel);
    
    // 分状态显示识别进度
    this.showRecognitionProgress(this.translate('add', 'recognition.preparingImage'));
    
    // 延迟一下让用户看到状态变化
    setTimeout(() => {
      this.showRecognitionProgress(this.translate('add', 'recognition.connectingModel'));
      
      setTimeout(() => {
        this.showRecognitionProgress(this.translate('add', 'recognition.analyzing'));
        
        modelUtils.recognizePlant(filePath, location, (message) => {
          console.log('进度更新:', message);
          this.showRecognitionProgress(message);
        })
        .then(res => {
          console.log('=== 识别成功 ===');
          console.log('识别结果:', res);
          console.log('结果类型:', typeof res);
          console.log('结果键:', Object.keys(res || {}));
          
          this.showRecognitionProgress(this.translate('add', 'recognition.processing'));
          
          setTimeout(() => {
            console.log('=== 更新页面状态 ===');
            this.setData({
              aiResult: res,
              isLoading: false
            });
            wx.hideLoading();
            console.log('页面状态更新完成');
          }, 500);
        })
        .catch(err => {
          console.log('识别失败:', err);
          this.setData({ isLoading: false });
          wx.hideLoading();
          
          // 识别失败时提供选择
          const errorDetails = [
            `${this.translate('add', 'recognition.errorLabels.model')}: ${currentModel}`,
            `${this.translate('add', 'recognition.errorLabels.message')}: ${err.message || this.translate('add', 'recognition.errorPlaceholder')}`,
            `${this.translate('add', 'recognition.errorLabels.type')}: ${err.name || 'Error'}`,
            `${this.translate('add', 'recognition.errorLabels.full')}: ${JSON.stringify(err, null, 2)}`
          ].join('\n');
          
          console.log('详细错误信息:', errorDetails);
          
          wx.showModal({
            title: this.translate('add', 'recognition.failedTitle'),
            content: this.translate('add', 'recognition.failedContent', { error: err.message || this.translate('add', 'recognition.errorPlaceholder') }),
            confirmText: this.translate('common', 'continueAdding'),
            cancelText: this.translate('common', 'viewDetails'),
            success: (res) => {
              if (res.confirm) {
                // 用户选择继续添加，设置默认的AI结果
                this.setData({
                  aiResult: {
                    name: this.translate('common', 'unknownPlant'),
                    model: currentModel,
                    error: err.message || this.translate('add', 'recognition.failedTitle')
                  }
                });
                wx.showToast({
                  title: this.translate('add', 'recognition.continueAddingTitle'),
                  icon: 'success'
                });
              } else {
                // 用户选择查看详情，显示完整错误信息
                wx.showModal({
                  title: this.translate('add', 'recognition.fullErrorTitle'),
                  content: errorDetails,
                  showCancel: true,
                  cancelText: this.translate('common', 'retry'),
                  confirmText: this.translate('common', 'continueAdding'),
                  success: (detailRes) => {
                    if (detailRes.confirm) {
                      // 继续添加
                      this.setData({
                        aiResult: {
                          name: this.translate('common', 'unknownPlant'),
                          model: currentModel,
                          error: err.message || this.translate('add', 'recognition.failedTitle')
                        }
                      });
                      wx.showToast({
                        title: this.translate('add', 'recognition.continueAddingTitle'),
                        icon: 'success'
                      });
                    } else {
                      // 重新识别，清空图片
                      this.setData({
                        tempImagePath: '',
                        aiResult: {}
                      });
                    }
                  }
                });
              }
            }
          });
        });
      }, 1000);
    }, 1000);
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
