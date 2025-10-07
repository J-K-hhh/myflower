const modelUtils = require('../../utils/model_utils.js');
const cloudUtils = require('../../utils/cloud_utils.js');

Page({
  data: {
    plantId: null,
    plant: {},
    isEditingName: false,
    editingName: '',
    showHistoryModal: false,
    historyModalTitle: '',
    historyModalData: [],
    historyModalIcon: '',
    currentLocation: null,
    locationEnabled: false,
    selectedModel: 'baidu',
    maxPhotos: 10,
    maxRecords: 50,
    // V0.3 图片备忘功能
    editingMemoIndex: -1,
    editingMemo: ''
  },
  onLoad: function (options) {
    if (options.id) {
      this.setData({ plantId: options.id });
      this.loadSettings();
      this.checkLocationPermission();
      this.loadPlantDetail(options.id);
    } else {
      wx.showToast({
        title: '缺少植物ID',
        icon: 'error',
        complete: () => wx.navigateBack()
      });
    }
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
      selectedModel: settings.selectedModel || 'baidu', // 默认使用百度
      maxPhotos: settings.maxPhotos || 10,
      maxRecords: settings.maxRecords || 50
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
  loadPlantDetail: function (plantId) {
    const plantList = wx.getStorageSync('plantList') || [];
    const plant = plantList.find(p => p.id == plantId);
    if (plant) {
      plant.createDate = new Date(plant.createTime).toLocaleDateString();
      this.setData({ plant: plant });
    } else {
      wx.showToast({
        title: '找不到该植物信息',
        icon: 'error',
        complete: () => wx.navigateBack()
      });
    }
  },
  previewImage: function (e) {
    const currentSrc = e.currentTarget.dataset.src;
    wx.previewImage({
      current: currentSrc,
      urls: this.data.plant.images
    });
  },
  goToBaike: function() {
    const url = this.data.plant.aiResult.baike.baike_url;
    if (url) {
      wx.showModal({
        title: '外部链接',
        content: '小程序不支持直接打开网页，您可以复制链接后在浏览器中打开。',
        confirmText: '复制链接',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: url,
              success: () => wx.showToast({ title: '已复制' })
            });
          }
        }
      });
    }
  },
  toggleNameEdit: function () {
    if (this.data.isEditingName) {
      this.saveName();
    } else {
      this.setData({
        isEditingName: true,
        editingName: this.data.plant.aiResult.name || '未知植物'
      });
    }
  },
  onNameInput: function (e) {
    this.setData({ editingName: e.detail.value });
  },
  saveName: function () {
    const newName = this.data.editingName.trim();
    if (!newName) {
      wx.showToast({ title: '名称不能为空', icon: 'none' });
      return;
    }
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        plant.aiResult.name = newName;
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    this.setData({
      'plant.aiResult.name': newName,
      isEditingName: false
    });
    wx.showToast({ title: '名称已更新', icon: 'success' });
  },
  updateWatering: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastWateringDate', today, 'wateringHistory', '浇水时间已更新');
  },
  updateFertilizing: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastFertilizingDate', today, 'fertilizingHistory', '施肥时间已更新');
  },
  takePhoto: function () {
    // 检查照片数量限制
    if (this.data.plant.images && this.data.plant.images.length >= this.data.maxPhotos) {
      wx.showToast({
        title: `最多只能保存${this.data.maxPhotos}张照片`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // Prefer uploading to cloud; fallback to saveFile
        if (cloudUtils.isCloudAvailable()) {
          cloudUtils.uploadImage(tempFilePath)
            .then(fileID => {
              // We store the cloud fileID and use it in imageInfos
              if (this.data.selectedModel === 'qwen-vl') {
                this.analyzePlantHealth(tempFilePath); // analysis needs local path
              }
              this.addPhotoToPlant(fileID);
            })
            .catch(() => {
              wx.saveFile({
                tempFilePath: tempFilePath,
                success: (saveRes) => {
                  const savedPath = saveRes.savedFilePath;
                  if (this.data.selectedModel === 'qwen-vl') {
                    this.analyzePlantHealth(savedPath);
                  } else {
                    this.addPhotoToPlant(savedPath);
                  }
                },
                fail: () => {
                  if (this.data.selectedModel === 'qwen-vl') {
                    this.analyzePlantHealth(tempFilePath);
                  } else {
                    this.addPhotoToPlant(tempFilePath);
                  }
                }
              });
            });
        } else {
          wx.saveFile({
            tempFilePath: tempFilePath,
            success: (saveRes) => {
              const savedPath = saveRes.savedFilePath;
              if (this.data.selectedModel === 'qwen-vl') {
                this.analyzePlantHealth(savedPath);
              } else {
                this.addPhotoToPlant(savedPath);
              }
            },
            fail: () => {
              if (this.data.selectedModel === 'qwen-vl') {
                this.analyzePlantHealth(tempFilePath);
              } else {
                this.addPhotoToPlant(tempFilePath);
              }
            }
          });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },
  analyzePlantHealth: function(filePath) {
    wx.showLoading({ title: '分析健康状态...' });
    
    const location = this.data.locationEnabled ? this.data.currentLocation : null;
    modelUtils.analyzePlantHealth(filePath, location)
      .then(result => {
        wx.hideLoading();
        
        // 显示分析结果
        wx.showModal({
          title: '健康分析结果',
          content: result.healthAnalysis,
          showCancel: true,
          cancelText: '取消',
          confirmText: '保存照片',
          success: (res) => {
            if (res.confirm) {
              this.addPhotoToPlant(filePath, result);
            }
          }
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '分析失败: ' + err.message,
          icon: 'none',
          duration: 3000
        });
        // 分析失败也允许保存照片
        this.addPhotoToPlant(filePath);
      });
  },
  addPhotoToPlant: function(filePath, healthAnalysis = null) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        // 初始化图片信息数组
        if (!plant.imageInfos) {
          plant.imageInfos = [];
        }
        
        // 如果达到照片数量限制，删除最旧的照片
        if (plant.images && plant.images.length >= this.data.maxPhotos) {
          plant.images.pop();
          plant.imageInfos.pop();
        }
        
        // 添加新图片和图片信息
        const currentTime = Date.now();
        const imageInfo = {
          path: filePath,
          timestamp: currentTime,
          date: new Date(currentTime).toISOString().split('T')[0],
          memo: ''
        };
        
        plant.images.unshift(filePath);
        plant.imageInfos.unshift(imageInfo);
        
        // 保存健康分析结果
        if (healthAnalysis) {
          if (!plant.healthAnalyses) {
            plant.healthAnalyses = [];
          }
          plant.healthAnalyses.unshift({
            ...healthAnalysis,
            imagePath: filePath,
            timestamp: currentTime
          });
          // 限制健康分析记录数量
          if (plant.healthAnalyses.length > this.data.maxRecords) {
            plant.healthAnalyses = plant.healthAnalyses.slice(0, this.data.maxRecords);
          }
        }
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    // Persist to cloud database (best-effort)
    if (cloudUtils && cloudUtils.isCloudAvailable) {
      try { cloudUtils.savePlantList(updatedList); } catch (e) {}
    }
    this.setData({
      'plant.images': updatedList.find(p => p.id == this.data.plantId).images,
      'plant.imageInfos': updatedList.find(p => p.id == this.data.plantId).imageInfos || [],
      'plant.healthAnalyses': updatedList.find(p => p.id == this.data.plantId).healthAnalyses || []
    });
    wx.showToast({ title: '照片已添加', icon: 'success' });
  },
  setCoverImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    const imageInfos = this.data.plant.imageInfos || [];
    if (index === 0) {
      wx.showToast({ title: '已经是题图了', icon: 'none' });
      return;
    }
    const newImages = [...images];
    const newImageInfos = [...imageInfos];
    [newImages[0], newImages[index]] = [newImages[index], newImages[0]];
    [newImageInfos[0], newImageInfos[index]] = [newImageInfos[index], newImageInfos[0]];
    this.updatePlantImages(newImages, newImageInfos);
    wx.showToast({ title: '已设为题图', icon: 'success' });
  },
  deleteImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    if (images.length <= 1) {
      wx.showToast({ title: '至少保留一张照片', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
      success: (res) => {
        if (res.confirm) {
          const newImages = images.filter((_, i) => i !== index);
          const newImageInfos = (this.data.plant.imageInfos || []).filter((_, i) => i !== index);
          this.updatePlantImages(newImages, newImageInfos);
          wx.showToast({ title: '照片已删除', icon: 'success' });
        }
      }
    });
  },
  updatePlantImages: function (newImages, newImageInfos = null) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        plant.images = newImages;
        if (newImageInfos) {
          plant.imageInfos = newImageInfos;
        }
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    const updateData = { 'plant.images': newImages };
    if (newImageInfos) {
      updateData['plant.imageInfos'] = newImageInfos;
    }
    this.setData(updateData);
  },
  updatePlantData: function (field, value, successMsg) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        plant[field] = value;
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    const updateData = {};
    updateData[`plant.${field}`] = value;
    this.setData(updateData);
    wx.showToast({ title: successMsg, icon: 'success' });
  },
  updatePlantDataWithHistory: function (field, value, historyField, successMsg) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        plant[field] = value;
        if (!plant[historyField]) {
          plant[historyField] = [];
        }
        plant[historyField].unshift({
          date: value,
          timestamp: Date.now()
        });
        // 使用设置中的记录数量限制
        if (plant[historyField].length > this.data.maxRecords) {
          plant[historyField] = plant[historyField].slice(0, this.data.maxRecords);
        }
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    const updateData = {};
    updateData[`plant.${field}`] = value;
    updateData[`plant.${historyField}`] = updatedList.find(p => p.id == this.data.plantId)[historyField];
    this.setData(updateData);
    wx.showToast({ title: successMsg, icon: 'success' });
  },
  viewWateringHistory: function () {
    const history = this.data.plant.wateringHistory || [];
    this.showHistoryModal('浇水记录', history, '💧');
  },
  viewFertilizingHistory: function () {
    const history = this.data.plant.fertilizingHistory || [];
    this.showHistoryModal('施肥记录', history, '🌱');
  },
  viewHealthAnalyses: function () {
    const analyses = this.data.plant.healthAnalyses || [];
    if (analyses.length === 0) {
      wx.showToast({
        title: '暂无健康分析记录',
        icon: 'none'
      });
      return;
    }
    this.showHealthAnalysesModal(analyses);
  },
  showHealthAnalysesModal: function (analyses) {
    const formattedAnalyses = analyses
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(item => {
        const date = new Date(item.timestamp);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const formattedTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        return { ...item, formattedDate, formattedTime };
      });
    
    this.setData({
      showHistoryModal: true,
      historyModalTitle: '健康分析记录',
      historyModalData: formattedAnalyses,
      historyModalIcon: '🏥'
    });
  },
  showHistoryModal: function (title, history, icon) {
    const formattedHistory = history
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(item => {
        const date = new Date(item.timestamp);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const formattedTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        return { ...item, formattedDate, formattedTime };
      });
    this.setData({
      showHistoryModal: true,
      historyModalTitle: title,
      historyModalData: formattedHistory,
      historyModalIcon: icon
    });
  },
  closeHistoryModal: function () {
    this.setData({
      showHistoryModal: false,
      historyModalTitle: '',
      historyModalData: [],
      historyModalIcon: ''
    });
  },
  stopPropagation: function () {},
  
  // V0.3 图片备忘功能
  editImageMemo: function(e) {
    const index = e.currentTarget.dataset.index;
    const currentMemo = this.data.plant.imageInfos && this.data.plant.imageInfos[index] ? 
                       this.data.plant.imageInfos[index].memo : '';
    this.setData({
      editingMemoIndex: index,
      editingMemo: currentMemo
    });
  },
  
  onMemoInput: function(e) {
    this.setData({ editingMemo: e.detail.value });
  },
  
  saveImageMemo: function() {
    const index = this.data.editingMemoIndex;
    const memo = this.data.editingMemo.trim();
    
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        if (!plant.imageInfos) {
          plant.imageInfos = [];
        }
        if (plant.imageInfos[index]) {
          plant.imageInfos[index].memo = memo;
        }
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.setData({
      'plant.imageInfos': updatedList.find(p => p.id == this.data.plantId).imageInfos,
      editingMemoIndex: -1,
      editingMemo: ''
    });
    wx.showToast({ title: '备忘已保存', icon: 'success' });
  },
  
  cancelMemoEdit: function() {
    this.setData({
      editingMemoIndex: -1,
      editingMemo: ''
    });
  },
  
  // V0.3 图片顺序管理功能
  moveImageUp: function(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) {
      wx.showToast({ title: '已经是第一张了', icon: 'none' });
      return;
    }
    
    const images = [...this.data.plant.images];
    const imageInfos = [...(this.data.plant.imageInfos || [])];
    
    // 交换位置
    [images[index], images[index - 1]] = [images[index - 1], images[index]];
    if (imageInfos.length > index) {
      [imageInfos[index], imageInfos[index - 1]] = [imageInfos[index - 1], imageInfos[index]];
    }
    
    this.updatePlantImages(images, imageInfos);
    wx.showToast({ title: '图片顺序已调整', icon: 'success' });
  },
  
  moveImageDown: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    if (index === images.length - 1) {
      wx.showToast({ title: '已经是最后一张了', icon: 'none' });
      return;
    }
    
    const newImages = [...images];
    const newImageInfos = [...(this.data.plant.imageInfos || [])];
    
    // 交换位置
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    if (newImageInfos.length > index + 1) {
      [newImageInfos[index], newImageInfos[index + 1]] = [newImageInfos[index + 1], newImageInfos[index]];
    }
    
    this.updatePlantImages(newImages, newImageInfos);
    wx.showToast({ title: '图片顺序已调整', icon: 'success' });
  },
  
  deletePlant: function () {
    wx.showModal({
      title: '确认删除',
      content: `您确定要删除 "${this.data.plant.aiResult.name || '此绿植'}" 吗？此操作不可恢复。`,
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          const plantList = wx.getStorageSync('plantList') || [];
          const newList = plantList.filter(p => p.id != this.data.plantId);
          wx.setStorageSync('plantList', newList);
          wx.showToast({ title: '删除成功', icon: 'success', duration: 1500 });
          setTimeout(() => { wx.navigateBack(); }, 1500);
        }
      }
    });
  }
});