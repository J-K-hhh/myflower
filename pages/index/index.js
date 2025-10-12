const i18n = require('../../utils/i18n.js');

Page({
  data: {
    plantList: [],
    batchMode: false,
    selectedPlants: [],
    showBatchActions: false,
    // V0.3 批量操作历史
    showBatchHistoryModal: false,
    batchHistoryData: [],
    // V0.4 提醒功能
    reminderStatus: 'noPlants', // noPlants, needsWatering, wateredRecently
    reminderText: '',
    needsWateringPlants: [], // 需要浇水的植物列表
    i18n: i18n.getSection('index'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage(),
    batchSelectionText: i18n.t('index', 'batchMode.selectedCount', { count: 0 })
  },
  onLoad: function () {
    this.updateTranslations();
  },
  onShow: function () {
    // 仅在需要时刷新，减少从详情返回时的全量刷新闪烁
    this.updateTranslations();
    try {
      const shouldRefresh = wx.getStorageSync('shouldRefreshPlantList');
      const hasLocal = Array.isArray(this.data.plantList) && this.data.plantList.length > 0;
      if (!shouldRefresh && hasLocal) {
        // 即使不刷新数据，也要重新计算提醒状态（语言可能已切换）
        this.calculateReminderStatus(this.data.plantList);
        this.setRandomTitle();
        return;
      }
    } catch (e) {}
    // 清除刷新标记并加载
    try { wx.removeStorageSync('shouldRefreshPlantList'); } catch (e) {}
    this.loadPlantData();
    this.setRandomTitle();
  },
  updateTranslations: function() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    this.setData({
      i18n: i18n.getSection('index', language),
      i18nCommon: i18n.getSection('common', language),
      language: language
    });
    this.updateBatchSelectionText(this.data.selectedPlants.length || 0);
    if (Array.isArray(this.data.batchHistoryData) && this.data.batchHistoryData.length > 0) {
      const delimiter = this.translate('common', 'listDelimiter');
      const updatedHistory = this.data.batchHistoryData.map(item => {
        const plantList = Array.isArray(item.plantNames) ? item.plantNames.join(delimiter) : item.plantList;
        const typeText = item.type === 'watering'
          ? this.translate('index', 'batchMode.watering')
          : this.translate('index', 'batchMode.fertilizing');
        return {
          ...item,
          plantList,
          typeText,
          plantCountLabel: this.translate('index', 'batchMode.plantCountLabel', { count: item.count })
        };
      });
      this.setData({ batchHistoryData: updatedHistory });
    }
  },
  translate: function(namespace, keyPath, params = {}) {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
    const language = this.data.language || i18n.getLanguage();
    return i18n.t(namespace, keyPath, params, language);
  },

  updateBatchSelectionText: function(count) {
    const text = this.translate('index', 'batchMode.selectedCount', { count });
    this.setData({ batchSelectionText: text });
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
              wx.showToast({ title: this.translate('common', 'storage.restoreSuccess'), icon: 'success' });
              this.loadPlantData();
            } else {
              wx.showToast({ title: this.translate('common', 'storage.restoreEmpty'), icon: 'none' });
              this.finishLoad(plantList);
            }
          }).catch((err) => {
            console.warn('[index] cloud restore failed:', err);
            wx.showToast({ title: this.translate('common', 'storage.restoreFailed'), icon: 'none' });
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
    // 计算提醒状态
    this.calculateReminderStatus(plantList);
  },

  // 计算提醒状态
  calculateReminderStatus: function(plantList) {
    if (!plantList || plantList.length === 0) {
      this.setData({
        reminderStatus: 'noPlants',
        reminderText: ''
      });
      return;
    }

    // 获取提醒设置
    const settings = wx.getStorageSync('appSettings') || {};
    const reminderFrequency = settings.reminderFrequency || 'frequent';
    
    if (reminderFrequency === 'off') {
      this.setData({
        reminderStatus: 'noPlants',
        reminderText: ''
      });
      return;
    }

    // 计算提醒间隔（天数）
    let reminderDays = 0;
    switch (reminderFrequency) {
      case 'daily':
        reminderDays = 1;
        break;
      case 'frequent':
        reminderDays = 3;
        break;
      case 'occasional':
        reminderDays = 7;
        break;
      default:
        reminderDays = 3;
    }

    // 检查每株植物的最后浇水时间
    const now = new Date();
    let needsWateringCount = 0;
    let totalPlants = plantList.length;
    let needsWateringPlants = []; // 存储需要浇水的植物信息

    plantList.forEach(plant => {
      if (plant.wateringHistory && plant.wateringHistory.length > 0) {
        // 获取最后一次浇水时间
        const lastWatering = new Date(plant.wateringHistory[plant.wateringHistory.length - 1].time);
        const daysSinceWatering = Math.floor((now - lastWatering) / (1000 * 60 * 60 * 24));
        
        if (daysSinceWatering >= reminderDays) {
          needsWateringCount++;
          needsWateringPlants.push({
            id: plant.id,
            name: plant.aiResult?.name || this.translate('common', 'unknownPlant'),
            daysSinceWatering: daysSinceWatering
          });
        }
      } else {
        // 没有浇水记录，需要浇水
        needsWateringCount++;
        needsWateringPlants.push({
          id: plant.id,
          name: plant.aiResult?.name || this.translate('common', 'unknownPlant'),
          daysSinceWatering: '∞'
        });
      }
    });

    // 设置提醒状态和文本
    if (needsWateringCount > 0) {
      // 找到最近一次浇水日期
      let lastWateringDate = null;
      plantList.forEach(plant => {
        if (plant.wateringHistory && plant.wateringHistory.length > 0) {
          const lastWatering = new Date(plant.wateringHistory[plant.wateringHistory.length - 1].time);
          if (!lastWateringDate || lastWatering > lastWateringDate) {
            lastWateringDate = lastWatering;
          }
        }
      });
      
      let reminderText = this.translate('common', 'reminder.status.needsWatering');
      if (lastWateringDate && !isNaN(lastWateringDate.getTime())) {
        const dateStr = lastWateringDate.toLocaleDateString();
        reminderText += ` - ${this.translate('common', 'lastWatering')}: ${dateStr}`;
      }
      
      this.setData({
        reminderStatus: 'needsWatering',
        reminderText: reminderText,
        needsWateringPlants: needsWateringPlants // 存储需要浇水的植物列表
      });
    } else {
      // 找到最近一次浇水日期
      let lastWateringDate = null;
      plantList.forEach(plant => {
        if (plant.wateringHistory && plant.wateringHistory.length > 0) {
          const lastWatering = new Date(plant.wateringHistory[plant.wateringHistory.length - 1].time);
          if (!lastWateringDate || lastWatering > lastWateringDate) {
            lastWateringDate = lastWatering;
          }
        }
      });
      
      let reminderText = this.translate('common', 'reminder.status.wateredRecently');
      if (lastWateringDate && !isNaN(lastWateringDate.getTime())) {
        const dateStr = lastWateringDate.toLocaleDateString();
        reminderText += ` - ${this.translate('common', 'lastWatering')}: ${dateStr}`;
      }
      
      this.setData({
        reminderStatus: 'wateredRecently',
        reminderText: reminderText,
        needsWateringPlants: [] // 清空需要浇水的植物列表
      });
    }
  },

  // 显示需要浇水的植物列表
  showNeedsWateringPlants: function() {
    if (!this.data.needsWateringPlants || this.data.needsWateringPlants.length === 0) {
      wx.showToast({
        title: this.translate('common', 'reminder.noPlantsNeedWatering'),
        icon: 'none'
      });
      return;
    }

    const plantNames = this.data.needsWateringPlants.map(plant => {
      const daysText = plant.daysSinceWatering === '∞' 
        ? this.translate('common', 'reminder.neverWatered')
        : this.translate('common', 'reminder.daysAgo', { days: plant.daysSinceWatering });
      return `${plant.name} (${daysText})`;
    }).join('\n');

    wx.showModal({
      title: this.translate('common', 'reminder.needsWateringTitle'),
      content: plantNames,
      showCancel: false,
      confirmText: this.translate('common', 'ok')
    });
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
    this.updateBatchSelectionText(0);
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
    this.updateBatchSelectionText(selectedPlants.length);
  },
  
  batchWatering: function() {
    // 如果不在批量模式，先进入批量模式
    if (!this.data.batchMode) {
      this.toggleBatchMode();
      return;
    }
    
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: this.translate('index', 'batchMode.noSelection'), icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: this.translate('index', 'batchMode.confirmWateringTitle'),
      content: this.translate('index', 'batchMode.confirmWateringContent', { count: this.data.selectedPlants.length }) + '',
      success: (res) => {
        if (res.confirm) {
          this.performBatchWatering();
        }
      }
    });
  },
  
  batchFertilizing: function() {
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: this.translate('index', 'batchMode.noSelection'), icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: this.translate('index', 'batchMode.confirmFertilizingTitle'),
      content: this.translate('index', 'batchMode.confirmFertilizingContent', { count: this.data.selectedPlants.length }) + '',
      success: (res) => {
        if (res.confirm) {
          this.performBatchFertilizing();
        }
      }
    });
  },
  
  performBatchWatering: function() {
    wx.showLoading({ title: this.translate('index', 'batchMode.processingWatering') });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || this.translate('common', 'unknownPlant'));
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
        title: this.translate('index', 'batchMode.successWatering', { count: this.data.selectedPlants.length }), 
        icon: 'success',
        duration: 2000
      });
      this.exitBatchMode();
      this.loadPlantData();
    }, 1000);
  },
  
  performBatchFertilizing: function() {
    wx.showLoading({ title: this.translate('index', 'batchMode.processingFertilizing') });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || this.translate('common', 'unknownPlant'));
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
        title: this.translate('index', 'batchMode.successFertilizing', { count: this.data.selectedPlants.length }), 
        icon: 'success',
        duration: 2000
      });
      this.exitBatchMode();
      this.loadPlantData();
    }, 1000);
  },
  
  exitBatchMode: function() {
    this.setData({
      batchMode: false,
      selectedPlants: [],
      showBatchActions: false
    });
    this.updateBatchSelectionText(0);
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
      time: new Date(timestamp).toLocaleTimeString(i18n.getLocale(), { 
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
        title: this.translate('index', 'historyToastEmpty'),
        icon: 'none'
      });
      return;
    }
    
    const formattedHistory = batchHistory.map(item => {
      const typeText = item.type === 'watering' 
        ? this.translate('index', 'batchMode.watering') 
        : this.translate('index', 'batchMode.fertilizing');
      const delimiter = this.translate('common', 'listDelimiter');
      const plantList = item.plantNames.join(delimiter);
      return {
        ...item,
        typeText: typeText,
        plantList: plantList,
        plantCountLabel: this.translate('index', 'batchMode.plantCountLabel', { count: item.count })
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
