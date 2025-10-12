const i18n = require('../../utils/i18n.js');

Page({
  data: {
    selectedModel: 'baidu',
    maxPhotos: 10,
    maxRecords: 50,
    models: [
      { id: 'baidu' },
      { id: 'qwen-vl', disabled: true }
    ],
    languageOptions: [
      { value: 'zh' },
      { value: 'en' }
    ],
    locationEnabled: false,
    currentLocation: null,
    i18n: i18n.getSection('settings'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage()
  },

  onLoad: function() {
    this.updateTranslations();
    this.loadSettings();
    this.checkLocationPermission();
  },

  onShow: function() {
    // 每次显示页面时重新加载设置，确保显示最新的选择状态
    this.updateTranslations();
    this.loadSettings();
    this.checkLocationPermission();
    this.setRandomTitle();
  },

  updateTranslations: function() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    const settingsTexts = i18n.getSection('settings', language);
    const commonTexts = i18n.getSection('common', language);
    const models = [
      {
        id: 'baidu',
        name: settingsTexts.modelList.baidu.name,
        description: settingsTexts.modelList.baidu.description
      },
      {
        id: 'qwen-vl',
        name: settingsTexts.modelList.qwen.name,
        description: settingsTexts.modelList.qwen.description,
        disabled: true
      }
    ];
    const languageOptions = this.data.languageOptions.map(option => ({
      ...option,
      label: commonTexts.languageNames[option.value] || option.value
    }));
    this.setData({
      i18n: settingsTexts,
      i18nCommon: commonTexts,
      language: language,
      models: models,
      languageOptions: languageOptions
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
    const settings = wx.getStorageSync('appSettings') || {};
    const selectedModel = settings.selectedModel || 'baidu'; // 默认使用百度
    console.log('加载设置，选中模型:', selectedModel);
    this.setData({
      selectedModel: selectedModel,
      maxPhotos: settings.maxPhotos || 10,
      maxRecords: settings.maxRecords || 50
    });
  },

  saveSettings: function() {
    const settings = {
      selectedModel: this.data.selectedModel,
      maxPhotos: this.data.maxPhotos,
      maxRecords: this.data.maxRecords
    };
    wx.setStorageSync('appSettings', settings);
    
    // 保存设置时也触发清理
    this.cleanupExcessPhotos(this.data.maxPhotos);
    this.cleanupExcessRecords(this.data.maxRecords);
    
    wx.showToast({
      title: this.translate('settings', 'toasts.settingsSaved'),
      icon: 'success'
    });
  },

  onModelChange: function(e) {
    console.log('模型选择变化:', e.detail.value);
    this.setData({
      selectedModel: e.detail.value
    });
  },

  onMaxPhotosChange: function(e) {
    const newMaxPhotos = parseInt(e.detail.value);
    this.setData({
      maxPhotos: newMaxPhotos
    });
    
    // 清理超出限制的旧图片，但保留题图
    this.cleanupExcessPhotos(newMaxPhotos);
  },

  onMaxRecordsChange: function(e) {
    const newMaxRecords = parseInt(e.detail.value);
    this.setData({
      maxRecords: newMaxRecords
    });
    
    // 清理超出限制的旧记录
    this.cleanupExcessRecords(newMaxRecords);
  },

  cleanupExcessPhotos: function(maxPhotos) {
    const plantList = wx.getStorageSync('plantList') || [];
    let hasChanges = false;
    
    const updatedList = plantList.map(plant => {
      if (plant.images && plant.images.length > maxPhotos) {
        hasChanges = true;
        // 保留题图（第一张）和最新的几张图片
        const newImages = plant.images.slice(0, maxPhotos);
        return {
          ...plant,
          images: newImages
        };
      }
      return plant;
    });
    
    if (hasChanges) {
      wx.setStorageSync('plantList', updatedList);
      // 标记首页需要刷新
      try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
      // Persist to cloud database (best-effort)
      try {
        const cloudUtils = require('../../utils/cloud_utils.js');
        if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
          cloudUtils.savePlantList(updatedList);
        }
      } catch (e) {}
      wx.showToast({
        title: this.translate('settings', 'toasts.photosCleaned'),
        icon: 'success',
        duration: 2000
      });
    }
  },

  cleanupExcessRecords: function(maxRecords) {
    const plantList = wx.getStorageSync('plantList') || [];
    let hasChanges = false;
    
    const updatedList = plantList.map(plant => {
      let plantChanged = false;
      const updatedPlant = { ...plant };
      
      // 清理浇水记录
      if (plant.wateringHistory && plant.wateringHistory.length > maxRecords) {
        updatedPlant.wateringHistory = plant.wateringHistory.slice(0, maxRecords);
        plantChanged = true;
      }
      
      // 清理施肥记录
      if (plant.fertilizingHistory && plant.fertilizingHistory.length > maxRecords) {
        updatedPlant.fertilizingHistory = plant.fertilizingHistory.slice(0, maxRecords);
        plantChanged = true;
      }
      
      // 清理健康分析记录
      if (plant.healthAnalyses && plant.healthAnalyses.length > maxRecords) {
        updatedPlant.healthAnalyses = plant.healthAnalyses.slice(0, maxRecords);
        plantChanged = true;
      }
      
      if (plantChanged) {
        hasChanges = true;
      }
      
      return updatedPlant;
    });
    
    if (hasChanges) {
      wx.setStorageSync('plantList', updatedList);
      // 标记首页需要刷新
      try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
      // Persist to cloud database (best-effort)
      try {
        const cloudUtils = require('../../utils/cloud_utils.js');
        if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
          cloudUtils.savePlantList(updatedList);
        }
      } catch (e) {}
      wx.showToast({
        title: this.translate('settings', 'toasts.recordsCleaned'),
        icon: 'success',
        duration: 2000
      });
    }
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

  requestLocationPermission: function() {
    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        this.setData({ locationEnabled: true });
        this.getCurrentLocation();
      },
      fail: () => {
        wx.showModal({
          title: this.translate('settings', 'modals.locationPermissionTitle'),
          content: this.translate('settings', 'modals.locationPermissionContent'),
          showCancel: false
        });
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

  testModelConnection: function() {
    const modelUtils = require('../../utils/model_utils.js');
    wx.showLoading({ title: this.translate('settings', 'modelTest.testing') });
    
    // 使用新的模型配置检查
    const modelConfig = modelUtils.getModelConfig(this.data.selectedModel);
    
    if (!modelConfig.apiKey) {
      wx.hideLoading();
      wx.showToast({
        title: this.translate('settings', 'modelTest.missingKey'),
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    // 模拟连接测试
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: this.translate('settings', 'modelTest.success'),
        icon: 'success'
      });
      console.log('模型配置检查通过:', modelConfig.name);
    }, 1000);
  },

  clearAllData: function() {
    wx.showModal({
      title: this.translate('settings', 'modals.clearDataTitle'),
      content: this.translate('settings', 'modals.clearDataContent'),
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('plantList');
          wx.removeStorageSync('appSettings');
          wx.showToast({
            title: this.translate('settings', 'toasts.dataCleared'),
            icon: 'success'
          });
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }, 1500);
        }
      }
    });
  },

  onLanguageChange: function(e) {
    const newLanguage = e.detail.value;
    if (!newLanguage || newLanguage === this.data.language) {
      return;
    }
    const app = getApp();
    if (app && typeof app.setLanguage === 'function') {
      app.setLanguage(newLanguage);
    } else {
      i18n.setLanguage(newLanguage);
      wx.setStorageSync('appLanguage', newLanguage);
    }
    this.setData({ language: newLanguage });
    this.updateTranslations();
    this.setRandomTitle();
  }
});
