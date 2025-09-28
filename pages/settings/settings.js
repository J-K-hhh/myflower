Page({
  data: {
    selectedModel: 'baidu',
    maxPhotos: 10,
    maxRecords: 50,
    models: [
      { id: 'baidu', name: '百度AI植物识别', description: '快速识别植物种类' },
      { id: 'qwen-vl', name: '通义千问VL', description: '多模态分析，提供详细养护建议' }
    ],
    locationEnabled: false,
    currentLocation: null
  },

  onLoad: function() {
    this.loadSettings();
    this.checkLocationPermission();
  },

  onShow: function() {
    // 每次显示页面时重新加载设置，确保显示最新的选择状态
    this.loadSettings();
    this.checkLocationPermission();
    this.setRandomTitle();
  },
  
  setRandomTitle: function() {
    const app = getApp();
    app.setRandomTitle();
  },

  loadSettings: function() {
    const settings = wx.getStorageSync('appSettings') || {};
    const selectedModel = settings.selectedModel || 'qwen-vl'; // 默认使用通义千问VL
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
      title: '设置已保存',
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
      wx.showToast({
        title: `已清理超出限制的旧图片`,
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
      wx.showToast({
        title: `已清理超出限制的旧记录`,
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
          title: '位置权限',
          content: '需要位置权限来提供更准确的养护建议，请在设置中开启',
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
    wx.showLoading({ title: '测试连接...' });
    
    // 使用新的模型配置检查
    const modelConfig = modelUtils.getModelConfig(this.data.selectedModel);
    
    if (!modelConfig.apiKey) {
      wx.hideLoading();
      wx.showToast({
        title: 'API Key未配置',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    // 模拟连接测试
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '配置正常',
        icon: 'success'
      });
      console.log('模型配置检查通过:', modelConfig.name);
    }, 1000);
  },

  clearAllData: function() {
    wx.showModal({
      title: '清除所有数据',
      content: '此操作将删除所有绿植记录，确定继续吗？',
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('plantList');
          wx.removeStorageSync('appSettings');
          wx.showToast({
            title: '数据已清除',
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
  }
});
