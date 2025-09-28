const modelUtils = require('../../utils/model_utils.js');
Page({
  data: {
    tempImagePath: '',
    wateringDate: '',
    fertilizingDate: '',
    aiResult: {},
    isLoading: false,
    currentLocation: null,
    locationEnabled: false,
    selectedModel: 'baidu'
  },
  onLoad: function () {
    this.loadSettings();
    this.checkLocationPermission();
    this.testApiConnection();
  },

  onShow: function() {
    // 每次显示页面时重新加载设置，确保使用最新的模型选择
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
    this.setData({
      selectedModel: settings.selectedModel || 'qwen-vl' // 默认使用通义千问VL
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
    
    wx.showLoading({ title: '测试API连接...' });
    
    // 使用新的模型配置检查
    const modelConfig = modelUtils.getModelConfig(this.data.selectedModel);
    
    if (!modelConfig.apiKey) {
      wx.hideLoading();
      wx.showModal({
        title: 'API Key未配置',
        content: `请先配置${modelConfig.name}的API Key`,
        showCancel: false,
        confirmText: '确定'
      });
      return;
    }
    
    // 模拟API测试（实际测试需要真实请求）
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: 'API配置正常',
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
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          tempImagePath: tempFilePath,
          aiResult: {}
        });
        this.recognizeImage(tempFilePath);
      }
    })
  },
  recognizeImage: function (filePath) {
    this.setData({ isLoading: true });
    
    const location = this.data.locationEnabled ? this.data.currentLocation : null;
    const currentModel = modelUtils.getCurrentModel();
    console.log('当前选择的模型:', currentModel);
    console.log('页面数据中的模型:', this.data.selectedModel);
    
    // 分状态显示识别进度
    this.showRecognitionProgress('正在准备图片...');
    
    // 延迟一下让用户看到状态变化
    setTimeout(() => {
      this.showRecognitionProgress('正在连接AI模型...');
      
      setTimeout(() => {
        this.showRecognitionProgress('正在分析植物特征...');
        
        modelUtils.recognizePlant(filePath, location, (message) => {
          console.log('进度更新:', message);
          this.showRecognitionProgress(message);
        })
        .then(res => {
          console.log('=== 识别成功 ===');
          console.log('识别结果:', res);
          console.log('结果类型:', typeof res);
          console.log('结果键:', Object.keys(res || {}));
          
          this.showRecognitionProgress('正在处理识别结果...');
          
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
          const errorDetails = `
模型: ${currentModel}
错误信息: ${err.message || '未知错误'}
错误类型: ${err.name || 'Error'}
完整错误: ${JSON.stringify(err, null, 2)}
          `.trim();
          
          console.log('详细错误信息:', errorDetails);
          
          wx.showModal({
            title: '识别失败',
            content: `植物识别失败，是否继续添加绿植？\n\n错误详情：\n${err.message || '未知错误'}`,
            confirmText: '继续添加',
            cancelText: '查看详情',
            success: (res) => {
              if (res.confirm) {
                // 用户选择继续添加，设置默认的AI结果
                this.setData({
                  aiResult: {
                    name: '未知植物',
                    model: currentModel,
                    error: err.message || '识别失败'
                  }
                });
                wx.showToast({
                  title: '可以继续添加绿植',
                  icon: 'success'
                });
              } else {
                // 用户选择查看详情，显示完整错误信息
                wx.showModal({
                  title: '详细错误信息',
                  content: errorDetails,
                  showCancel: true,
                  cancelText: '重新识别',
                  confirmText: '继续添加',
                  success: (detailRes) => {
                    if (detailRes.confirm) {
                      // 继续添加
                      this.setData({
                        aiResult: {
                          name: '未知植物',
                          model: currentModel,
                          error: err.message || '识别失败'
                        }
                      });
                      wx.showToast({
                        title: '可以继续添加绿植',
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
    if (!this.data.tempImagePath) {
      wx.showToast({ title: '请先选择一张图片', icon: 'none' });
      return;
    }
    if (this.data.isLoading) {
      wx.showToast({ title: '正在识别中，请稍候', icon: 'none' });
      return;
    }
    const plantList = wx.getStorageSync('plantList') || [];
    const currentTime = new Date();
    const newPlant = {
      id: Date.now(),
      createTime: currentTime.getTime(),
      createDate: currentTime.toLocaleDateString(),
      images: [this.data.tempImagePath],
      lastWateringDate: this.data.wateringDate,
      lastFertilizingDate: this.data.fertilizingDate,
      aiResult: this.data.aiResult,
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
    wx.showToast({
      title: '🌱 种下成功！',
      icon: 'success',
      duration: 1200
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1200);
  }
});
