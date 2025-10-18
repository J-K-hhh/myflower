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
    memoCharCount: 0,
    // V0.4 分享功能
    shareImageUrl: '',
    i18n: i18n.getSection('detail'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage(),
    // 键盘与自动保存
    keyboardHeight: 0
  },

  onLoad: function (options) {
    this.updateTranslations();
    const { id, owner, pid } = options || {};
    this.loadSettings();
    this.checkLocationPermission();
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });

    // 预取 openid（用于分享链接 owner 参数）
    try {
      const app = getApp();
      if (app && app.ready) {
        app.ready.then((oid) => {
          if (oid) this.setData({ shareOwnerOpenId: oid });
        }).catch(() => {});
      } else if (app && app.openid) {
        this.setData({ shareOwnerOpenId: app.openid });
      }
    } catch (e) {}

    // 监听键盘高度变化，避免遮挡编辑面板
    try {
      wx.onKeyboardHeightChange && wx.onKeyboardHeightChange((res) => {
        const h = res && res.height ? res.height : 0;
        if (this.data.editingMemoIndex >= 0) {
          this.setData({ keyboardHeight: h });
        }
      });
    } catch (e) {}

    if (owner && pid) {
      // 分享模式：从云端读取
      this.setData({ readonlyShareView: true });
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
    this.updateTranslations();
    this.loadSettings();
    this.checkLocationPermission();
    this.setRandomTitle();
  },

  onUnload: function() {
    try { wx.offKeyboardHeightChange && wx.offKeyboardHeightChange(); } catch (e) {}
    clearTimeout(this._memoAutoSaveTid);
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
      selectedModel: settings.selectedModel || 'baidu',
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
      fail: (err) => {}
    });
  },

  // 核心功能：加载植物详情（本地优先，云端备用）
  loadPlantDetail: function (plantId) {
    const plantList = wx.getStorageSync('plantList') || [];
    let plant = plantList.find(p => p.id == plantId);
    
    if (plant) {
      // 本地有数据，直接使用
      this.processPlantData(plant);
    } else {
      // 本地无数据，尝试从云端加载
      this.loadFromCloud(plantId);
    }
  },

  // 处理植物数据（统一处理逻辑）
  processPlantData: function(plant) {
    plant.createDate = new Date(plant.createTime).toLocaleDateString();
    
    // 确保图片信息数组存在且与图片数组对齐
    this.ensureImageInfosAlignment(plant);
    
    // 设置页面数据
    this.setData({ plant: plant });
    
    // 如果有 cloud:// 图片，转换为临时URL用于显示
    this.convertCloudImagesForDisplay(plant);
    
    // 更新页面标题
    this.updatePageTitle(plant, false);
    
    // 预生成分享图片
    this.generateShareImage();
  },

  // 确保图片信息与图片数组对齐
  ensureImageInfosAlignment: function(plant) {
    const images = Array.isArray(plant.images) ? plant.images : [];
    if (!Array.isArray(plant.imageInfos)) {
      plant.imageInfos = [];
    }
    
    if (plant.imageInfos.length !== images.length || plant.imageInfos.some(info => !info || !info.path)) {
      plant.imageInfos = images.map((imgPath, index) => {
        const existingInfo = plant.imageInfos.find(info => info && info.path === imgPath) || plant.imageInfos[index];
        return {
          path: imgPath,
          timestamp: existingInfo?.timestamp || (typeof plant.createTime === 'number' ? plant.createTime : Date.now()),
          date: existingInfo?.date || new Date(typeof plant.createTime === 'number' ? plant.createTime : Date.now()).toISOString().split('T')[0],
          memo: existingInfo?.memo || ''
        };
      });
      
      // 保存到本地
      this.savePlantToLocal(plant);
    }
  },

  // 从云端加载数据
  loadFromCloud: function(plantId) {
    wx.showLoading({ title: this.translate('detail', 'status.loading') });
    
    if (cloudUtils && cloudUtils.loadPlantList) {
      cloudUtils.loadPlantList().then(cloudList => {
        wx.hideLoading();
        const plant = cloudList.find(p => p.id == plantId);
        if (plant) {
          this.processPlantData(plant);
        } else {
          this.showPlantNotFound();
        }
      }).catch(() => {
        wx.hideLoading();
        this.showPlantNotFound();
      });
    } else {
      wx.hideLoading();
      this.showPlantNotFound();
    }
  },

  showPlantNotFound: function() {
    wx.showToast({
      title: this.translate('detail', 'errors.plantNotFound'),
      icon: 'error',
      complete: () => wx.navigateBack()
    });
  },

  // 转换 cloud:// 图片为临时URL用于显示
  convertCloudImagesForDisplay: function(plant) {
    const hasCloudImages = Array.isArray(plant.images) && plant.images.some(img =>
      typeof img === 'string' && img.indexOf('cloud://') === 0
    );

    if (hasCloudImages) {
      try {
        const cloudUtils = require('../../utils/cloud_utils.js');
        const cloudIds = plant.images.filter(img => typeof img === 'string' && img.indexOf('cloud://') === 0);
        const infoIds = (plant.imageInfos || []).map(i => i && i.path).filter(path =>
          typeof path === 'string' && path.indexOf('cloud://') === 0
        );
        const fileList = Array.from(new Set([...cloudIds, ...infoIds]));

        cloudUtils.getTempUrlsCached(fileList).then((map) => {
          // 建立反向映射：tempURL -> fileID，供后续保存时还原
          this._tempUrlReverseMap = this._tempUrlReverseMap || {};
          Object.keys(map).forEach(fid => {
            const url = map[fid];
            this._tempUrlReverseMap[url] = fid;
          });

          // 创建显示用的数据副本
          const displayPlant = { ...plant };
          if (Array.isArray(displayPlant.images)) {
            displayPlant.images = displayPlant.images.map(path =>
              (typeof path === 'string' && map[path]) ? map[path] : path
            );
          }
          if (Array.isArray(displayPlant.imageInfos)) {
            displayPlant.imageInfos = displayPlant.imageInfos.map(info => {
              if (info && typeof info.path === 'string' && map[info.path]) {
                return { ...info, path: map[info.path] };
              }
              return info;
            });
          }

          this.setData({ plant: displayPlant });
        }).catch((err) => {
          console.error('云存储访问失败:', err);
        });
      } catch (e) {
        // ignore
      }
    }
  },

  // 将展示用的 https 图片还原为 cloud 文件ID（若可）
  _toCanonicalPath: function(path) {
    if (!path || typeof path !== 'string') return path;
    if (path.indexOf('cloud://') === 0) return path;
    if (this._tempUrlReverseMap && this._tempUrlReverseMap[path]) {
      return this._tempUrlReverseMap[path];
    }
    return path;
  },

  // 加载分享的植物数据
  loadSharedPlantByOwner: function(ownerOpenId, plantId) {
    wx.showLoading({ title: this.translate('detail', 'status.loadingShare') });
    
    if (cloudUtils && cloudUtils.loadSharedPlantByOwner) {
      cloudUtils.loadSharedPlantByOwner(ownerOpenId, plantId).then((result) => {
        wx.hideLoading();
        const plant = result && result.plant ? result.plant : result;
        if (plant) {
          plant.createDate = new Date(plant.createTime).toLocaleDateString();
          this.setData({ plant: plant });
          this.updatePageTitle(plant, true);
        } else {
          this.showPlantNotFound();
        }
      }).catch(() => {
        wx.hideLoading();
        this.showPlantNotFound();
      });
    } else {
      wx.hideLoading();
      this.showPlantNotFound();
    }
  },

  // 更新页面标题
  updatePageTitle: function(plant, isShared) {
    if (!plant || !plant.aiResult) return;
    
    const plantName = plant.aiResult.name || this.translate('common', 'unknownPlant');
    let title = plantName;
    
    if (isShared) {
      title = this.translate('detail', 'status.shareFromFriend', { name: plantName });
    }
    
    wx.setNavigationBarTitle({ title: title });
  },

  // 保存植物数据到本地
  savePlantToLocal: function(plant) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(p => p.id == plant.id ? plant : p);
    wx.setStorageSync('plantList', updatedList);
    return updatedList;
  },

  // 同步到云端
  syncToCloud: function(plantList) {
    if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
      setTimeout(() => {
        cloudUtils.savePlantList(plantList).catch(err => {
          console.error('云端同步失败:', err);
        });
      }, 100);
    }
  },

  // 预览图片
  previewImage: function (e) {
    const currentSrc = e.currentTarget.dataset.src;
    wx.previewImage({
      current: currentSrc,
      urls: this.data.plant.images
    });
  },

  // 跳转到百科
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

  // 编辑植物名称
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
    // 确保不会把展示用的 https 临时URL 写回存储
    const canonicalImages = (this.data.plant.images || []).map(p => this._toCanonicalPath(p));
    const canonicalInfos = (this.data.plant.imageInfos || []).map(info => ({
      ...info,
      path: this._toCanonicalPath(info && info.path)
    }));
    const plantList = this.savePlantToLocal({
      ...this.data.plant,
      images: canonicalImages,
      imageInfos: canonicalInfos,
      aiResult: { ...this.data.plant.aiResult, name: newName }
    });
    
    this.setData({
      'plant.aiResult.name': newName,
      isEditingName: false
    });
    
    this.syncToCloud(plantList);
    wx.showToast({ title: this.translate('detail', 'toast.nameUpdated'), icon: 'success' });
  },

  // 浇水记录
  updateWatering: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastWateringDate', today, 'wateringHistory', this.translate('detail', 'toast.wateringUpdated'));
  },

  // 施肥记录
  updateFertilizing: function () {
    const today = new Date().toISOString().split('T')[0];
    this.updatePlantDataWithHistory('lastFertilizingDate', today, 'fertilizingHistory', this.translate('detail', 'toast.fertilizingUpdated'));
  },

  // 拍照功能
  takePhoto: function () {
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
        
        if (cloudUtils.isCloudAvailable()) {
          cloudUtils.uploadImage(tempFilePath)
            .then(fileID => {
              if (this.data.selectedModel === 'qwen-vl') {
                this.analyzePlantHealth(tempFilePath);
              } else {
                this.addPhotoToPlant(fileID);
              }
            })
            .catch(() => {
              this.fallbackToLocalSave(tempFilePath);
            });
        } else {
          this.fallbackToLocalSave(tempFilePath);
        }
      },
      fail: () => {
        wx.showToast({ title: this.translate('detail', 'errors.photoCaptureFailed'), icon: 'none' });
      }
    });
  },

  fallbackToLocalSave: function(tempFilePath) {
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
  },

  // 植物健康分析
  analyzePlantHealth: function(filePath) {
    wx.showLoading({ title: this.translate('detail', 'status.analyzingHealth') });
    
    const location = this.data.locationEnabled ? this.data.currentLocation : null;
    modelUtils.analyzePlantHealth(filePath, location)
      .then(result => {
        wx.hideLoading();
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
        this.addPhotoToPlant(filePath);
      });
  },

  // 添加照片到植物
  addPhotoToPlant: function(filePath, healthAnalysis = null) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        const updatedPlant = { ...plant };
        
        if (!updatedPlant.imageInfos) {
          updatedPlant.imageInfos = [];
        }
        
        // 如果达到照片数量限制，删除最旧的照片
        if (updatedPlant.images && updatedPlant.images.length >= this.data.maxPhotos) {
          const removedImage = updatedPlant.images.pop();
          updatedPlant.imageInfos.pop();
          
          // 清理被移除的云端文件
          if (removedImage && removedImage.indexOf('cloud://') === 0 && cloudUtils.deleteCloudFiles) {
            cloudUtils.deleteCloudFiles([removedImage]);
          }
        }
        
        // 添加新图片和图片信息
        const currentTime = Date.now();
        const imageInfo = {
          path: filePath,
          timestamp: currentTime,
          date: new Date(currentTime).toISOString().split('T')[0],
          memo: ''
        };
        
        updatedPlant.images = [filePath, ...(updatedPlant.images || [])];
        updatedPlant.imageInfos = [imageInfo, ...updatedPlant.imageInfos];
        
        // 保存健康分析结果
        if (healthAnalysis) {
          if (!updatedPlant.healthAnalyses) {
            updatedPlant.healthAnalyses = [];
          }
          updatedPlant.healthAnalyses.unshift({
            ...healthAnalysis,
            imagePath: filePath,
            timestamp: currentTime
          });
          
          if (updatedPlant.healthAnalyses.length > this.data.maxRecords) {
            updatedPlant.healthAnalyses = updatedPlant.healthAnalyses.slice(0, this.data.maxRecords);
          }
        }
        
        return updatedPlant;
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    const updatedPlant = updatedList.find(p => p.id == this.data.plantId);
    this.setData({
      'plant.images': updatedPlant.images,
      'plant.imageInfos': updatedPlant.imageInfos || [],
      'plant.healthAnalyses': updatedPlant.healthAnalyses || []
    });
    
    wx.showToast({ title: this.translate('detail', 'toast.photoAdded'), icon: 'success' });

    // 刷新展示用临时URL
    if (updatedPlant) {
      this.convertCloudImagesForDisplay(updatedPlant);
    }
  },

  // 设置封面图片
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
    
    // 规范化路径（将展示用的 https 转回 cloudID）
    const canonicalImages = newImages.map(p => this._toCanonicalPath(p));
    const canonicalInfos = newImageInfos.map(info => ({
      ...info,
      path: this._toCanonicalPath(info && info.path)
    }));
    this.updatePlantImages(canonicalImages, canonicalInfos);
    wx.showToast({ title: this.translate('detail', 'image.setCoverSuccess'), icon: 'success' });
  },

  // 删除图片
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
          const removedPath = this._toCanonicalPath(images[index]);
          const removedImageInfo = (this.data.plant.imageInfos || [])[index];
          const removedInfoPath = this._toCanonicalPath(removedImageInfo && removedImageInfo.path);
          const newImages = images.filter((_, i) => i !== index);
          const newImageInfos = (this.data.plant.imageInfos || []).filter((_, i) => i !== index);
          
          // 规范化路径再写入
          const canonicalImages = newImages.map(p => this._toCanonicalPath(p));
          const canonicalInfos = newImageInfos.map(info => ({ ...info, path: this._toCanonicalPath(info && info.path) }));
          this.updatePlantImages(canonicalImages, canonicalInfos);
          wx.showToast({ title: this.translate('detail', 'image.deleteSuccess'), icon: 'success' });
          
          // 清理云端文件
          const filesToDelete = [];
          if (removedPath && removedPath.indexOf('cloud://') === 0) {
            filesToDelete.push(removedPath);
          }
          if (removedInfoPath && removedInfoPath.indexOf('cloud://') === 0) {
            filesToDelete.push(removedInfoPath);
          }
          
          if (filesToDelete.length > 0 && cloudUtils.deleteCloudFiles) {
            cloudUtils.deleteCloudFiles(filesToDelete);
          }
        }
      }
    });
  },

  // 更新植物图片
  updatePlantImages: function (newImages, newImageInfos = null) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        return {
          ...plant,
          images: newImages,
          imageInfos: newImageInfos || plant.imageInfos
        };
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    this.setData({
      'plant.images': newImages,
      'plant.imageInfos': newImageInfos || this.data.plant.imageInfos
    });

    // 刷新展示用临时URL，避免把 cloud:// 直接渲染
    const updatedPlant = updatedList.find(p => p.id == this.data.plantId);
    if (updatedPlant) {
      this.convertCloudImagesForDisplay(updatedPlant);
    }
  },

  // 更新植物数据
  updatePlantData: function (field, value, successMsg) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        return { ...plant, [field]: value };
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    this.setData({ [`plant.${field}`]: value });
    wx.showToast({ title: successMsg, icon: 'success' });
  },

  // 更新植物数据（带历史记录）
  updatePlantDataWithHistory: function (field, value, historyField, successMsg) {
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        const updatedPlant = { ...plant, [field]: value };
        
        if (!updatedPlant[historyField]) {
          updatedPlant[historyField] = [];
        }
        
        updatedPlant[historyField].unshift({
          date: value,
          timestamp: Date.now()
        });
        
        if (updatedPlant[historyField].length > this.data.maxRecords) {
          updatedPlant[historyField] = updatedPlant[historyField].slice(0, this.data.maxRecords);
        }
        
        return updatedPlant;
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    const updatedPlant = updatedList.find(p => p.id == this.data.plantId);
    this.setData({
      [`plant.${field}`]: value,
      [`plant.${historyField}`]: updatedPlant[historyField]
    });
    
    wx.showToast({ title: successMsg, icon: 'success' });
  },

  // 查看浇水历史
  viewWateringHistory: function () {
    const history = this.data.plant.wateringHistory || [];
    this.showHistoryModal(this.translate('detail', 'history.titleWatering'), history, '💧');
  },

  // 查看施肥历史
  viewFertilizingHistory: function () {
    const history = this.data.plant.fertilizingHistory || [];
    this.showHistoryModal(this.translate('detail', 'history.titleFertilizing'), history, '🌱');
  },

  // 查看健康分析
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

  // 图片备忘功能
  editImageMemo: function(e) {
    const index = e.currentTarget.dataset.index;
    const currentMemo = this.data.plant.imageInfos && this.data.plant.imageInfos[index] ? 
                       this.data.plant.imageInfos[index].memo : '';
    this.setData({
      editingMemoIndex: index,
      editingMemo: currentMemo,
      memoCharCount: (currentMemo || '').length
    });
  },
  
  onMemoInput: function(e) {
    const val = e.detail.value || '';
    this.setData({ editingMemo: val, memoCharCount: val.length });
    // 自动保存（防抖）
    clearTimeout(this._memoAutoSaveTid);
    this._memoAutoSaveTid = setTimeout(() => {
      this.backgroundSaveMemo(true); // 静默后台保存，不关闭面板
    }, 800);
  },
  
  saveImageMemo: function() {
    const index = this.data.editingMemoIndex;
    const memo = this.data.editingMemo.trim();
    
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        const updatedPlant = { ...plant };
        if (!updatedPlant.imageInfos) {
          updatedPlant.imageInfos = [];
        }
        if (updatedPlant.imageInfos[index]) {
          updatedPlant.imageInfos[index] = { ...updatedPlant.imageInfos[index], memo: memo };
        }
        return updatedPlant;
      }
      return plant;
    });
    
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    
    const currentPlant = updatedList.find(p => p.id == this.data.plantId);
    this.setData({
      'plant.imageInfos': currentPlant.imageInfos,
      editingMemoIndex: -1,
      editingMemo: '',
      memoCharCount: 0
    });
    
    wx.showToast({ title: this.translate('detail', 'image.memoSaved'), icon: 'success' });
  },
  
  // 取消也自动保存（更稳妥）
  cancelMemoEdit: function() {
    this.autoSaveAndClose(false);
  },

  // 自动保存并关闭（silent 控制是否静默不提示）
  autoSaveAndClose: function(silent = true) {
    const index = this.data.editingMemoIndex;
    if (index < 0) return;
    const memo = (this.data.editingMemo || '').trim();
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        const updatedPlant = { ...plant };
        if (!updatedPlant.imageInfos) updatedPlant.imageInfos = [];
        if (updatedPlant.imageInfos[index]) {
          updatedPlant.imageInfos[index] = { ...updatedPlant.imageInfos[index], memo: memo };
        }
        return updatedPlant;
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    this.syncToCloud(updatedList);
    const currentPlant = updatedList.find(p => p.id == this.data.plantId) || {};
    this.setData({
      'plant.imageInfos': currentPlant.imageInfos || [],
      editingMemoIndex: -1,
      editingMemo: '',
      memoCharCount: 0,
      keyboardHeight: 0
    });
    if (!silent) {
      wx.showToast({ title: this.translate('detail', 'image.memoSaved') || '已保存', icon: 'success' });
    }
  },

  // 后台保存：仅更新本地，不关闭编辑面板，不提示
  backgroundSaveMemo: function(silent = true) {
    const index = this.data.editingMemoIndex;
    if (index < 0) return;
    const memo = (this.data.editingMemo || '').trim();
    const plantList = wx.getStorageSync('plantList') || [];
    const updatedList = plantList.map(plant => {
      if (plant.id == this.data.plantId) {
        const updatedPlant = { ...plant };
        if (!updatedPlant.imageInfos) updatedPlant.imageInfos = [];
        if (updatedPlant.imageInfos[index]) {
          updatedPlant.imageInfos[index] = { ...updatedPlant.imageInfos[index], memo: memo };
        }
        return updatedPlant;
      }
      return plant;
    });
    wx.setStorageSync('plantList', updatedList);
    const currentPlant = updatedList.find(p => p.id == this.data.plantId) || {};
    this.setData({ 'plant.imageInfos': currentPlant.imageInfos || [] });
  },

  // 图片顺序管理
  moveImageUp: function(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) {
      wx.showToast({ title: this.translate('detail', 'image.firstImage'), icon: 'none' });
      return;
    }
    
    const images = [...this.data.plant.images];
    const imageInfos = [...(this.data.plant.imageInfos || [])];
    
    [images[index], images[index - 1]] = [images[index - 1], images[index]];
    if (imageInfos.length > index) {
      [imageInfos[index], imageInfos[index - 1]] = [imageInfos[index - 1], imageInfos[index]];
    }
    
    // 规范化路径，避免把展示用 https 存回数据库
    const canonicalImages = images.map(p => this._toCanonicalPath(p));
    const canonicalInfos = imageInfos.map(info => ({
      ...info,
      path: this._toCanonicalPath(info && info.path)
    }));
    this.updatePlantImages(canonicalImages, canonicalInfos);
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
    
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    if (newImageInfos.length > index + 1) {
      [newImageInfos[index], newImageInfos[index + 1]] = [newImageInfos[index + 1], newImageInfos[index]];
    }
    
    // 规范化路径，避免把展示用 https 存回数据库
    const canonicalImages = newImages.map(p => this._toCanonicalPath(p));
    const canonicalInfos = newImageInfos.map(info => ({
      ...info,
      path: this._toCanonicalPath(info && info.path)
    }));
    this.updatePlantImages(canonicalImages, canonicalInfos);
    wx.showToast({ title: this.translate('detail', 'image.orderUpdated'), icon: 'success' });
  },
  
  // 删除植物
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
          
          // 收集需要删除的云端文件
          const imageFileIds = (target.images || []).filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
          const infoFileIds = (target.imageInfos || [])
            .map(info => info && info.path)
            .filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
          const allFileIds = [...imageFileIds, ...infoFileIds];
          
          const newList = plantList.filter(p => p.id != this.data.plantId);
          wx.setStorageSync('plantList', newList);
          this.syncToCloud(newList);
          
          // 清理云端文件
          if (allFileIds.length > 0 && cloudUtils.deleteCloudFiles) {
            cloudUtils.deleteCloudFiles(allFileIds);
          }
          
          wx.showToast({ title: this.translate('detail', 'modals.deletePlantSuccess'), icon: 'success', duration: 1500 });
          setTimeout(() => { wx.navigateBack(); }, 1500);
        }
      }
    });
  },

  // 分享功能
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

  // 生成分享图片
  generateShareImage: function () {
    return new Promise((resolve, reject) => {
      const plant = this.data.plant;
      if (!plant || !plant.images || plant.images.length === 0) {
        reject('No plant image available');
        return;
      }

      let imageUrl = plant.images[0];
      
      // 如果是云存储图片，需要先转换为临时URL（使用缓存）
      if (imageUrl && imageUrl.indexOf('cloud://') === 0) {
        try {
          const cloudUtils = require('../../utils/cloud_utils.js');
          cloudUtils.getTempUrlsCached([imageUrl]).then((map) => {
            const url = map[imageUrl] || imageUrl;
            this.drawShareImage(url, plant, resolve);
          }).catch(() => resolve(imageUrl));
        } catch (e) {
          resolve(imageUrl);
        }
      } else {
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
    // 监听键盘高度，避免编辑面板被遮挡
    try {
      wx.onKeyboardHeightChange && wx.onKeyboardHeightChange((res) => {
        const h = res && res.height ? res.height : 0;
        if (this.data.editingMemoIndex >= 0) {
          this.setData({ keyboardHeight: h });
        }
      });
    } catch (e) {}
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
                fail: () => {
                  resolve(imageUrl);
                }
              }, this);
            });
          };
          
          img.onerror = () => {
            resolve(imageUrl);
          };
          
          img.src = imageUrl;
        },
        fail: () => {
          resolve(imageUrl);
        }
      });
    } catch (error) {
      resolve(imageUrl);
    }
  }
});
