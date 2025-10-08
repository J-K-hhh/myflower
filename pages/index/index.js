Page({
  data: {
    plantList: [],
    batchMode: false,
    selectedPlants: [],
    showBatchActions: false,
    // V0.3 批量操作历史
    showBatchHistoryModal: false,
    batchHistoryData: []
  },
  onShow: function () {
    // 仅在需要时刷新，减少从详情返回时的全量刷新闪烁
    try {
      const shouldRefresh = wx.getStorageSync('shouldRefreshPlantList');
      const hasLocal = Array.isArray(this.data.plantList) && this.data.plantList.length > 0;
      if (!shouldRefresh && hasLocal) {
        this.setRandomTitle();
        return;
      }
    } catch (e) {}
    // 清除刷新标记并加载
    try { wx.removeStorageSync('shouldRefreshPlantList'); } catch (e) {}
    this.loadPlantData();
    this.setRandomTitle();
  },
  
  setRandomTitle: function() {
    const app = getApp();
    app.setRandomTitle();
  },
  loadPlantData: function () {
    const localList = wx.getStorageSync('plantList') || [];
    let plantList = (localList).map(p => ({
      ...p,
      id: Number(p.id),
      selected: Array.isArray(this.data.selectedPlants) ? this.data.selectedPlants.indexOf(Number(p.id)) > -1 : false
    }));
    // If no local data, try cloud restore
    if (plantList.length === 0 && wx.cloud && wx.cloud.database) {
      // Load per-user list via cloud_utils to ensure openid isolation
      try {
        const cloudUtils = require('../../utils/cloud_utils.js');
        if (cloudUtils && cloudUtils.loadPlantList) {
          cloudUtils.loadPlantList().then(cloudList => {
            if (cloudList.length > 0) {
              wx.setStorageSync('plantList', cloudList);
              wx.showToast({ title: '已从云端恢复数据', icon: 'success' });
              this.loadPlantData();
            } else {
              wx.showToast({ title: '没有云端数据', icon: 'none' });
              this.finishLoad(plantList);
            }
          }).catch((err) => {
            console.warn('[index] cloud restore failed:', err);
            wx.showToast({ title: '云端恢复失败', icon: 'none' });
            this.finishLoad(plantList);
          });
          return;
        }
      } catch (e) {
        console.error('[index] restore try-catch error:', e);
      }
      this.finishLoad(plantList);
      return;
    }
    plantList.forEach(plant => {
      if (plant.createTime) {
        plant.createDate = new Date(plant.createTime).toLocaleDateString();
      }
    });
    // Resolve cloud fileIDs to temp URLs for display (if any)
    const firstImages = plantList.map(p => p.images && p.images[0] ? p.images[0] : null);
    const cloudIds = firstImages.filter(path => path && path.indexOf('cloud://') === 0);
    if (cloudIds.length > 0 && wx.cloud && wx.cloud.getTempFileURL) {
      wx.cloud.getTempFileURL({
        fileList: cloudIds,
        success: (res) => {
          const map = {};
          (res.fileList || []).forEach(i => { map[i.fileID] = i.tempFileURL; });
          plantList.forEach(p => {
            if (p.images && p.images[0] && map[p.images[0]]) {
              p.images[0] = map[p.images[0]];
            }
          });
          this.finishLoad(plantList);
        },
        fail: (err) => {
          console.warn('[index] getTempFileURL failed:', err);
          this.finishLoad(plantList);
        }
      });
      return;
    }
    this.finishLoad(plantList);
  },

  finishLoad: function(plantList) {
    this.setData({ plantList: plantList });
  },
  goToAdd: function () {
    wx.navigateTo({
      url: '/pages/add/add',
    });
  },
  goToDetail: function (e) {
    const plantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${plantId}`,
    });
  },
  goToSettings: function () {
    wx.navigateTo({
      url: '/pages/settings/settings',
    });
  },
  
  // V0.3 批量操作功能
  toggleBatchMode: function() {
    const newBatchMode = !this.data.batchMode;
    this.setData({
      batchMode: newBatchMode,
      selectedPlants: newBatchMode ? [] : [],
      showBatchActions: false
    });
  },
  
  togglePlantSelection: function(e) {
    if (!this.data.batchMode) return;
    
    const plantId = Number(e.currentTarget.dataset.id);
    const selectedPlants = [...this.data.selectedPlants];
    const index = selectedPlants.indexOf(plantId);
    
    if (index > -1) {
      selectedPlants.splice(index, 1);
    } else {
      selectedPlants.push(plantId);
    }
    
    const plantList = this.data.plantList.map(item => ({
      ...item,
      selected: selectedPlants.indexOf(item.id) > -1
    }));
    
    this.setData({
      selectedPlants: selectedPlants,
      plantList: plantList,
      showBatchActions: selectedPlants.length > 0
    });
  },
  
  batchWatering: function() {
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: '请选择植物', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量浇水',
      content: `确定要为选中的 ${this.data.selectedPlants.length} 株植物浇水吗？`,
      success: (res) => {
        if (res.confirm) {
          this.performBatchWatering();
        }
      }
    });
  },
  
  batchFertilizing: function() {
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: '请选择植物', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量施肥',
      content: `确定要为选中的 ${this.data.selectedPlants.length} 株植物施肥吗？`,
      success: (res) => {
        if (res.confirm) {
          this.performBatchFertilizing();
        }
      }
    });
  },
  
  performBatchWatering: function() {
    wx.showLoading({ title: '正在批量浇水...' });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || '未知植物');
        plant.lastWateringDate = today;
        if (!plant.wateringHistory) {
          plant.wateringHistory = [];
        }
        plant.wateringHistory.unshift({
          date: today,
          timestamp: timestamp
        });
      }
      return plant;
    });
    
    // 记录批量操作历史
    this.recordBatchOperation('watering', selectedPlantNames, timestamp);
    
    wx.setStorageSync('plantList', updatedList);
    // Persist to cloud database (best-effort)
    try {
      const cloudUtils = require('../../utils/cloud_utils.js');
      if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
        cloudUtils.savePlantList(updatedList);
      }
    } catch (e) {}
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ 
        title: `已为 ${this.data.selectedPlants.length} 株植物浇水`, 
        icon: 'success',
        duration: 2000
      });
      this.loadPlantData();
      this.exitBatchMode();
    }, 1000);
  },
  
  performBatchFertilizing: function() {
    wx.showLoading({ title: '正在批量施肥...' });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || '未知植物');
        plant.lastFertilizingDate = today;
        if (!plant.fertilizingHistory) {
          plant.fertilizingHistory = [];
        }
        plant.fertilizingHistory.unshift({
          date: today,
          timestamp: timestamp
        });
      }
      return plant;
    });
    
    // 记录批量操作历史
    this.recordBatchOperation('fertilizing', selectedPlantNames, timestamp);
    
    wx.setStorageSync('plantList', updatedList);
    // Persist to cloud database (best-effort)
    try {
      const cloudUtils = require('../../utils/cloud_utils.js');
      if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
        cloudUtils.savePlantList(updatedList);
      }
    } catch (e) {}
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ 
        title: `已为 ${this.data.selectedPlants.length} 株植物施肥`, 
        icon: 'success',
        duration: 2000
      });
      this.loadPlantData();
      this.exitBatchMode();
    }, 1000);
  },
  
  exitBatchMode: function() {
    this.setData({
      batchMode: false,
      selectedPlants: [],
      showBatchActions: false
    });
  },
  
  // V0.3 批量操作历史记录
  recordBatchOperation: function(type, plantNames, timestamp) {
    const batchHistory = wx.getStorageSync('batchOperationHistory') || [];
    const operation = {
      type: type,
      plantNames: plantNames,
      count: plantNames.length,
      timestamp: timestamp,
      date: new Date(timestamp).toISOString().split('T')[0],
      time: new Date(timestamp).toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
    
    batchHistory.unshift(operation);
    
    // 限制历史记录数量
    if (batchHistory.length > 50) {
      batchHistory.splice(50);
    }
    
    wx.setStorageSync('batchOperationHistory', batchHistory);
  },
  
  viewBatchHistory: function() {
    const batchHistory = wx.getStorageSync('batchOperationHistory') || [];
    if (batchHistory.length === 0) {
      wx.showToast({
        title: '暂无批量操作记录',
        icon: 'none'
      });
      return;
    }
    
    const formattedHistory = batchHistory.map(item => {
      const typeText = item.type === 'watering' ? '批量浇水' : '批量施肥';
      const plantList = item.plantNames.join('、');
      return {
        ...item,
        typeText: typeText,
        plantList: plantList
      };
    });
    
    this.setData({
      showBatchHistoryModal: true,
      batchHistoryData: formattedHistory
    });
  },
  
  closeBatchHistoryModal: function() {
    this.setData({
      showBatchHistoryModal: false,
      batchHistoryData: []
    });
  }
});
