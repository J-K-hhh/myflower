const modelUtils = require('../../utils/model_utils.js');
const cloudUtils = require('../../utils/cloud_utils.js');
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    plantId: null,
    plant: {},
    readonlyShareView: false,
    shareOwnerOpenId: '',
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
    editingMemo: '',
    // V0.4 分享功能
    shareImageUrl: '',
    i18n: i18n.getSection('detail'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage()
  },
  onLoad: function (options) {
    this.updateTranslations();
    // 支持两种入口：本地 id 或 分享 owner+pid
    const { id, owner, pid } = options || {};
    this.loadSettings();
    this.checkLocationPermission();
    // 启用系统分享菜单
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });

    // 预取 openid（用于分享链接 owner 参数）
    try {
      const app = getApp();
      if (app && app.ready) {
        app.ready.then((oid) => {
          if (oid) {
            this.setData({ shareOwnerOpenId: oid });
          }
        }).catch(() => {});
      } else if (app && app.openid) {
        this.setData({ shareOwnerOpenId: app.openid });
      }
    } catch (e) {}

    if (owner && pid) {
      // 通过 owner+pid 动态读取分享数据
      this.setData({ readonlyShareView: true });
      try {
      } catch (e) {}
      this.loadSharedPlantByOwner(owner, pid);
      return;
    }

    if (id) {
      this.setData({ plantId: id, readonlyShareView: false });
      this.loadPlantDetail(id);
      return;
    }

    wx.showToast({
      title: this.translate('detail', 'errors.missingId'),
      icon: 'error',
      complete: () => wx.navigateBack()
    });
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
      i18n: i18n.getSection('detail', language),
      i18nCommon: i18n.getSection('common', language),
      language: language
    });
    if (this.data.showHistoryModal) {
      let historyTitle = this.data.historyModalTitle;
      const icon = this.data.historyModalIcon;
      if (icon === '💧') {
        historyTitle = this.translate('detail', 'history.titleWatering');
      } else if (icon === '🌱') {
        historyTitle = this.translate('detail', 'history.titleFertilizing');
      } else if (icon === '🏥') {
        historyTitle = this.translate('detail', 'history.titleHealth');
      }
      this.setData({ historyModalTitle: historyTitle });
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
      }
    });
  },
  loadPlantDetail: function (plantId) {
    const plantList = wx.getStorageSync('plantList') || [];
    const plant = plantList.find(p => p.id == plantId);
    if (plant) {
      plant.createDate = new Date(plant.createTime).toLocaleDateString();
      // 回填/校正 imageInfos 与 images 对齐
      const images = Array.isArray(plant.images) ? plant.images : [];
      if (!Array.isArray(plant.imageInfos)) {
        plant.imageInfos = [];
      }
      // 如果数量不一致或缺少 path，则重建
      if (plant.imageInfos.length !== images.length || plant.imageInfos.some(info => !info || !info.path)) {
        const rebuilt = images.map((imgPath) => ({
          path: imgPath,
          timestamp: typeof plant.createTime === 'number' ? plant.createTime : Date.now(),
          date: new Date(typeof plant.createTime === 'number' ? plant.createTime : Date.now()).toISOString().split('T')[0],
          memo: ''
        }));
        plant.imageInfos = rebuilt;
        // 写回本地并尝试云端同步（吞错）
        const newList = plantList.map(p => p.id == plantId ? plant : p);
        wx.setStorageSync('plantList', newList);
        try {
          const cloudUtils = require('../../utils/cloud_utils.js');
          if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
            cloudUtils.savePlantList(newList);
          }
        } catch (e) {}
      }
      this.setData({ plant: plant });
      // 预生成分享图片
      this.generateShareImage().then(imageUrl => {
        this.setData({ shareImageUrl: imageUrl });
      }).catch(err => {
        console.error('预生成分享图片失败:', err);
        // 如果生成失败，使用原始图片
        this.setData({ shareImageUrl: plant.images && plant.images.length > 0 ? plant.images[0] : '' });
      });
      // 确保本地视图也可显示 cloud:// 图片（转换为临时URL，但不弹窗）
      this.resolveCloudImagesForReadonly(plant).then((resolved) => {
        this.setData({ plant: resolved });
        this.updatePageTitle(resolved, false);
      }).catch(() => {
        this.updatePageTitle(plant, false);
      });
    } else {
      wx.showToast({
        title: this.translate('detail', 'errors.plantNotFound'),
        icon: 'error',
        complete: () => wx.navigateBack()
      });
    }
  },

  // 更新页面标题
  updatePageTitle: function(plant, isShared) {
    if (!plant || !plant.aiResult) return;
    
    const plantName = plant.aiResult.name || this.translate('common', 'unknownPlant');
    let title = plantName;
    
    if (isShared) {
      // 分享模式：显示"来自朋友的植物名"
      title = this.translate('detail', 'status.shareFromFriend', { name: plantName });
    }
    
    wx.setNavigationBarTitle({
      title: title
    });
  },

  // (snapshot loading removed)

  loadSharedPlantByOwner: function(ownerOpenId, plantId) {
    try {
      const cloudUtils = require('../../utils/cloud_utils.js');
      if (!cloudUtils || !cloudUtils.loadSharedPlantByOwner) {
        wx.showToast({ title: this.translate('detail', 'errors.shareLoadFailed'), icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      wx.showLoading({ title: this.translate('detail', 'status.loadingShare') });
      cloudUtils.loadSharedPlantByOwner(ownerOpenId, plantId).then((sharedPlant) => {
        wx.hideLoading();
        const plant = sharedPlant && sharedPlant.plant ? sharedPlant.plant : sharedPlant;
        if (!plant) {
          wx.showToast({ title: this.translate('detail', 'errors.shareExpired'), icon: 'none' });
          setTimeout(() => wx.navigateBack(), 1500);
          return;
        }
        if (plant.createTime) {
          plant.createDate = new Date(plant.createTime).toLocaleDateString();
        }
        // 将 cloud:// 图片转换为临时URL，确保接收方可访问
        this.resolveCloudImagesForReadonly(plant).then((resolvedPlant) => {
          this.setData({ plant: resolvedPlant });
          this.updatePageTitle(resolvedPlant, true);
        }).catch(() => {
          this.setData({ plant: plant });
          this.updatePageTitle(plant, true);
        });
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: this.translate('detail', 'errors.loadFailed'), icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: this.translate('detail', 'errors.loadFailed'), icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 仅在只读共享视图下：把 cloud:// fileID 批量转换为临时 URL
  resolveCloudImagesForReadonly: function(plant) {
    return new Promise((resolve) => {
      try {
        const p = { ...plant };
        const ids = (Array.isArray(p.images) ? p.images : []).filter(path => typeof path === 'string' && path.indexOf('cloud://') === 0);
        const infoIds = Array.isArray(p.imageInfos) ? p.imageInfos.map(i => i && i.path).filter(path => typeof path === 'string' && path && path.indexOf('cloud://') === 0) : [];
        const fileList = Array.from(new Set([ ...ids, ...infoIds ]));
        if (!wx.cloud || !wx.cloud.getTempFileURL || fileList.length === 0) {
          resolve(p); return;
        }
        wx.cloud.getTempFileURL({ fileList }).then((res) => {
          const map = {};
          (res.fileList || []).forEach(i => { if (i && i.fileID && i.tempFileURL) { map[i.fileID] = i.tempFileURL; } });
          if (Array.isArray(p.images)) {
            p.images = p.images.map(path => (typeof path === 'string' && map[path]) ? map[path] : path);
          }
          if (Array.isArray(p.imageInfos)) {
            p.imageInfos = p.imageInfos.map(info => {
              if (info && typeof info.path === 'string' && map[info.path]) {
                return { ...info, path: map[info.path] };
              }
              return info;
            });
          }
          resolve(p);
        }).catch(() => resolve(p));
      } catch (e) {
        resolve(plant);
      }
    });
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
        title: this.translate('detail', 'modals.externalLinkTitle'),
        content: this.translate('detail', 'modals.externalLinkContent'),
        confirmText: this.translate('detail', 'modals.externalLinkConfirm'),
        cancelText: this.translate('common', 'cancel'),
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: url,
              success: () => wx.showToast({ title: this.translate('detail', 'toast.copied') })
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
        editingName: this.data.plant.aiResult.name || this.translate('common', 'unknownPlant')
      });
    }
  },
  onNameInput: function (e) {
    this.setData({ editingName: e.detail.value });
  },
  saveName: function () {
    const newName = this.data.editingName.trim();
    if (!newName) {
      wx.showToast({ title: this.translate('detail', 'errors.nameRequired'), icon: 'none' });
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
    wx.showToast({ title: this.translate('detail', 'toast.nameUpdated'), icon: 'success' });
  },
  updateWatering: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastWateringDate', today, 'wateringHistory', this.translate('detail', 'toast.wateringUpdated'));
  },
  updateFertilizing: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastFertilizingDate', today, 'fertilizingHistory', this.translate('detail', 'toast.fertilizingUpdated'));
  },
  takePhoto: function () {
    // 检查照片数量限制
    if (this.data.plant.images && this.data.plant.images.length >= this.data.maxPhotos) {
      wx.showToast({
        title: this.translate('detail', 'image.limitReached', { count: this.data.maxPhotos }),
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
            .catch((err) => {
              console.warn('[detail] upload failed, fallback to saveFile:', err);
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
                  if (this.data.selectedModel === 'qwen-vl') {
                    this.analyzePlantHealth(savedPath);
                  } else {
                    this.addPhotoToPlant(savedPath);
                  }
                },
                fail: (sfErr) => {
                  console.warn('[detail] saveFile failed, fallback to temp path:', sfErr);
                  if (this.data.selectedModel === 'qwen-vl') {
                    this.analyzePlantHealth(tempFilePath);
                  } else {
                    this.addPhotoToPlant(tempFilePath);
                  }
                }
              });
            });
        } else {
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
              if (this.data.selectedModel === 'qwen-vl') {
                this.analyzePlantHealth(savedPath);
              } else {
                this.addPhotoToPlant(savedPath);
              }
            },
            fail: (err) => {
              console.warn('[detail] saveFile failed, fallback to temp path:', err);
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
        console.warn('[detail] chooseMedia failed:', err);
        wx.showToast({ title: this.translate('detail', 'errors.photoCaptureFailed'), icon: 'none' });
      }
    });
  },
  analyzePlantHealth: function(filePath) {
    wx.showLoading({ title: this.translate('detail', 'status.analyzingHealth') });
    
    const location = this.data.locationEnabled ? this.data.currentLocation : null;
    modelUtils.analyzePlantHealth(filePath, location)
      .then(result => {
        wx.hideLoading();
        
        // 显示分析结果
        wx.showModal({
          title: this.translate('detail', 'modals.healthAnalysisTitle'),
          content: result.healthAnalysis,
          showCancel: true,
          cancelText: this.translate('common', 'cancel'),
          confirmText: this.translate('detail', 'modals.savePhoto'),
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
          title: this.translate('detail', 'modals.healthAnalysisFailTitle', { message: err.message }),
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
          const removedImage = plant.images.pop();
          plant.imageInfos.pop();
          // 清理被移除的旧云端文件
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (removedImage && removedImage.indexOf('cloud://') === 0 && cloudUtils.deleteCloudFiles) {
              cloudUtils.deleteCloudFiles([removedImage]);
            }
          } catch (e) {}
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
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    // Persist to cloud database (best-effort)
    if (cloudUtils && cloudUtils.isCloudAvailable) {
      try {
        cloudUtils.savePlantList(updatedList).then((ok) => {
        });
      } catch (e) {}
    }
    this.setData({
      'plant.images': updatedList.find(p => p.id == this.data.plantId).images,
      'plant.imageInfos': updatedList.find(p => p.id == this.data.plantId).imageInfos || [],
      'plant.healthAnalyses': updatedList.find(p => p.id == this.data.plantId).healthAnalyses || []
    });
    wx.showToast({ title: this.translate('detail', 'toast.photoAdded'), icon: 'success' });
  },
  setCoverImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    const imageInfos = this.data.plant.imageInfos || [];
    if (index === 0) {
      wx.showToast({ title: this.translate('detail', 'image.alreadyCover'), icon: 'none' });
      return;
    }
    const newImages = [...images];
    const newImageInfos = [...imageInfos];
    [newImages[0], newImages[index]] = [newImages[index], newImages[0]];
    [newImageInfos[0], newImageInfos[index]] = [newImageInfos[index], newImageInfos[0]];
    this.updatePlantImages(newImages, newImageInfos);
    wx.showToast({ title: this.translate('detail', 'image.setCoverSuccess'), icon: 'success' });
  },
  deleteImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    if (images.length <= 1) {
      wx.showToast({ title: this.translate('detail', 'image.keepAtLeastOne'), icon: 'none' });
      return;
    }
    wx.showModal({
      title: this.translate('detail', 'image.deleteConfirmTitle'),
      content: this.translate('detail', 'image.deleteConfirmContent'),
      confirmText: this.translate('detail', 'image.delete'),
      success: (res) => {
        if (res.confirm) {
          const removedPath = images[index];
          const newImages = images.filter((_, i) => i !== index);
          const newImageInfos = (this.data.plant.imageInfos || []).filter((_, i) => i !== index);
          this.updatePlantImages(newImages, newImageInfos);
          wx.showToast({ title: this.translate('detail', 'image.deleteSuccess'), icon: 'success' });
          // 清理云端文件（仅当是 cloud:// 开头）
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (removedPath && removedPath.indexOf('cloud://') === 0 && cloudUtils.deleteCloudFiles) {
              cloudUtils.deleteCloudFiles([removedPath]);
            }
          } catch (e) {}
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
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    // Persist to cloud database (best-effort)
    if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
      try {
        cloudUtils.savePlantList(updatedList).then((ok) => {
        });
      } catch (e) {}
    }
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
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    // Persist to cloud database (best-effort)
    if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
      try {
        cloudUtils.savePlantList(updatedList).then((ok) => {
        });
      } catch (e) {}
    }
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
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    // Persist to cloud database (best-effort)
    if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
      try {
        cloudUtils.savePlantList(updatedList).then((ok) => {
        });
      } catch (e) {}
    }
    const updateData = {};
    updateData[`plant.${field}`] = value;
    updateData[`plant.${historyField}`] = updatedList.find(p => p.id == this.data.plantId)[historyField];
    this.setData(updateData);
    wx.showToast({ title: successMsg, icon: 'success' });
  },
  viewWateringHistory: function () {
    const history = this.data.plant.wateringHistory || [];
    this.showHistoryModal(this.translate('detail', 'history.titleWatering'), history, '💧');
  },
  viewFertilizingHistory: function () {
    const history = this.data.plant.fertilizingHistory || [];
    this.showHistoryModal(this.translate('detail', 'history.titleFertilizing'), history, '🌱');
  },
  viewHealthAnalyses: function () {
    const analyses = this.data.plant.healthAnalyses || [];
    if (analyses.length === 0) {
      wx.showToast({
        title: this.translate('detail', 'modals.healthAnalysisNoRecord'),
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
      historyModalTitle: this.translate('detail', 'history.titleHealth'),
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
    wx.showToast({ title: this.translate('detail', 'image.memoSaved'), icon: 'success' });
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
      wx.showToast({ title: this.translate('detail', 'image.firstImage'), icon: 'none' });
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
    wx.showToast({ title: this.translate('detail', 'image.orderUpdated'), icon: 'success' });
  },
  
  moveImageDown: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.plant.images;
    if (index === images.length - 1) {
      wx.showToast({ title: this.translate('detail', 'image.lastImage'), icon: 'none' });
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
    wx.showToast({ title: this.translate('detail', 'image.orderUpdated'), icon: 'success' });
  },
  
  deletePlant: function () {
    wx.showModal({
      title: this.translate('detail', 'modals.deletePlantTitle'),
      content: this.translate('detail', 'modals.deletePlantContent', { name: this.data.plant.aiResult.name || this.translate('common', 'unknownPlant') }),
      confirmColor: '#e64340',
      confirmText: this.translate('detail', 'image.delete'),
      success: (res) => {
        if (res.confirm) {
          const plantList = wx.getStorageSync('plantList') || [];
          const target = plantList.find(p => p.id == this.data.plantId) || {};
          const fileIds = (target.images || []).filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
          const newList = plantList.filter(p => p.id != this.data.plantId);
          wx.setStorageSync('plantList', newList);
          // 标记首页需要刷新
          try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
          // 先尝试云端文件删除（吞错）
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (fileIds.length > 0 && cloudUtils.deleteCloudFiles) {
              cloudUtils.deleteCloudFiles(fileIds);
            }
          } catch (e) {}
          // 同步数据库（吞错）
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
              cloudUtils.savePlantList(newList);
            }
          } catch (e) {}
          wx.showToast({ title: this.translate('detail', 'modals.deletePlantSuccess'), icon: 'success', duration: 1500 });
          setTimeout(() => { wx.navigateBack(); }, 1500);
        }
      }
    });
  },


  wrapText: function(ctx, text, maxWidth) {
    const words = text.split('');
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  },

  // 分享给好友的回调：优先使用 owner+pid
  onShareAppMessage: function() {
    const plant = this.data.plant;
    const owner = this.data.shareOwnerOpenId || (getApp() && getApp().openid) || '';
    const path = owner && this.data.plantId
      ? `/pages/detail/detail?owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(this.data.plantId)}`
      : `/pages/detail/detail?id=${encodeURIComponent(this.data.plantId)}`;
    
    return {
      title: this.translate('detail', 'share.shareTitle', { name: plant.aiResult.name || this.translate('common', 'unknownPlant') }),
      path: path,
      imageUrl: this.data.shareImageUrl || (plant.images && plant.images.length > 0 ? plant.images[0] : '')
    };
  },

  // 分享到朋友圈的回调：使用 owner+pid
  onShareTimeline: function() {
    const plant = this.data.plant;
    const owner = this.data.shareOwnerOpenId || (getApp() && getApp().openid) || '';
    const query = owner && this.data.plantId
      ? `owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(this.data.plantId)}`
      : `id=${encodeURIComponent(this.data.plantId)}`;
    return {
      title: this.translate('detail', 'share.momentsTitle', { name: plant.aiResult.name || this.translate('common', 'unknownPlant') }),
      query: query,
      imageUrl: this.data.shareImageUrl || (plant.images && plant.images.length > 0 ? plant.images[0] : '')
    };
  },

  // 生成方形分享图片
  generateShareImage: function () {
    return new Promise((resolve, reject) => {
      const plant = this.data.plant;
      if (!plant || !plant.images || plant.images.length === 0) {
        reject('No plant image available');
        return;
      }

      let imageUrl = plant.images[0];
      
      // 如果是云存储图片，需要先转换为临时URL
      if (imageUrl && imageUrl.indexOf('cloud://') === 0) {
        if (wx.cloud && wx.cloud.getTempFileURL) {
          wx.cloud.getTempFileURL({
            fileList: [imageUrl]
          }).then((res) => {
            if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
              imageUrl = res.fileList[0].tempFileURL;
              this.drawShareImage(imageUrl, plant, resolve);
            } else {
              resolve(imageUrl);
            }
          }).catch((err) => {
            console.error('云存储图片转换异常:', err);
            resolve(imageUrl);
          });
        } else {
          resolve(imageUrl);
        }
      } else {
        // 直接使用本地图片
        this.drawShareImage(imageUrl, plant, resolve);
      }
    });
  },

  // 绘制分享图片
  drawShareImage: function(imageUrl, plant, resolve) {
    try {
      const ctx = wx.createCanvasContext('shareCanvas', this);
      const canvasWidth = 300;
      const canvasHeight = 300;
      const dpr = wx.getSystemInfoSync().pixelRatio || 1;

      ctx.scale(dpr, dpr);

      // 绘制背景
      ctx.setFillStyle('#4CAF50');
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 获取图片信息
      wx.getImageInfo({
        src: imageUrl,
        success: (info) => {
          const srcW = info.width;
          const srcH = info.height;

          // 计算 aspectFill 缩放
          const scale = Math.max(canvasWidth / srcW, canvasHeight / srcH);
          const drawW = srcW * scale;
          const drawH = srcH * scale;

          // 居中位置
          const x = (canvasWidth - drawW) / 2;
          const y = (canvasHeight - drawH) / 2;

          // 预加载图片
          const img = wx.createImage();
          img.onload = () => {
            // 绘制图片
            ctx.drawImage(imageUrl, x, y, drawW, drawH);

            // 绘制文字标题
            ctx.setFillStyle('#FFFFFF');
            ctx.setFontSize(16);
            ctx.setTextAlign('center');
            ctx.fillText(plant.aiResult?.name || this.translate('common', 'unknownPlant'), canvasWidth / 2, canvasHeight - 20);

            ctx.draw(false, () => {
              wx.canvasToTempFilePath({
                canvasId: 'shareCanvas',
                destWidth: canvasWidth * dpr,
                destHeight: canvasHeight * dpr,
                success: (res) => {
                  resolve(res.tempFilePath);
                },
                fail: (err) => {
                  console.error('生成分享图片失败:', err);
                  resolve(imageUrl);
                }
              }, this);
            });
          };
          
          img.onerror = () => {
            console.error('图片预加载失败');
            resolve(imageUrl);
          };
          
          img.src = imageUrl;
        },
        fail: (err) => {
          console.error('获取图片信息失败:', err);
          resolve(imageUrl);
        }
      });
    } catch (error) {
      console.error('Canvas绘制异常:', error);
      resolve(imageUrl);
    }
  }
});
