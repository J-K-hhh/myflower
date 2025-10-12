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
        console.log('重建图片信息:', {
          imagesLength: images.length,
          imageInfosLength: plant.imageInfos.length,
          images: images,
          imageInfos: plant.imageInfos
        });
        
        const rebuilt = images.map((imgPath, index) => {
          // 尝试通过路径匹配找到现有的图片信息
          const existingInfo = plant.imageInfos.find(info => info && info.path === imgPath) || plant.imageInfos[index];
          const newInfo = {
            path: imgPath,
            timestamp: existingInfo?.timestamp || (typeof plant.createTime === 'number' ? plant.createTime : Date.now()),
            date: existingInfo?.date || new Date(typeof plant.createTime === 'number' ? plant.createTime : Date.now()).toISOString().split('T')[0],
            memo: existingInfo?.memo || '' // 保留现有备忘
          };
          console.log(`图片 ${index}:`, { imgPath, existingInfo, newInfo });
          return newInfo;
        });
        plant.imageInfos = rebuilt;
        // 写回本地（不同步到云端，避免覆盖原始cloud://数据）
        const newList = plantList.map(p => p.id == plantId ? plant : p);
        wx.setStorageSync('plantList', newList);
      }
      // 先设置原始数据
      console.log('设置原始植物数据:', {
        plantId: plant.id,
        images: plant.images,
        imageInfos: plant.imageInfos
      });
      this.setData({ plant: plant });
      
      // 检查是否有cloud://图片需要转换
      const hasCloudImages = Array.isArray(plant.images) && plant.images.some(img => 
        typeof img === 'string' && img.indexOf('cloud://') === 0
      );
      
      console.log('图片类型检查:', {
        hasCloudImages,
        images: plant.images,
        cloudImages: plant.images?.filter(img => typeof img === 'string' && img.indexOf('cloud://') === 0)
      });
      
      if (hasCloudImages) {
        // 如果有cloud://图片，转换为临时URL（仅用于显示，不保存到本地存储）
        console.log('开始转换cloud://图片');
        this.resolveCloudImagesForReadonly(plant).then((resolved) => {
          console.log('cloud://图片转换完成');
          this.setData({ plant: resolved });
          this.updatePageTitle(resolved, false);
        }).catch((err) => {
          console.error('cloud://图片转换失败:', err);
          this.updatePageTitle(plant, false);
        });
      } else {
        // 如果没有cloud://图片，直接更新标题
        console.log('没有cloud://图片，直接显示本地图片');
        this.updatePageTitle(plant, false);
      }
      
      // 预生成分享图片
      this.generateShareImage().then(imageUrl => {
        this.setData({ shareImageUrl: imageUrl });
      }).catch(err => {
        console.error('预生成分享图片失败:', err);
        // 如果生成失败，使用原始图片
        this.setData({ shareImageUrl: plant.images && plant.images.length > 0 ? plant.images[0] : '' });
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
          (res.fileList || []).forEach(i => { 
            if (i && i.fileID && i.tempFileURL) { 
              map[i.fileID] = i.tempFileURL;
            }
          });
          
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
        }).catch((err) => {
          console.error('云存储访问失败:', err);
          wx.showModal({
            title: '云存储访问失败',
            content: `无法访问云存储中的图片，错误信息：${err.errMsg || err.message || '未知错误'}`,
            showCancel: false,
            confirmText: '确定'
          });
          resolve(p);
        });
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
    // 先更新本地存储
    wx.setStorageSync('plantList', updatedList);
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    // 异步同步到云端（不阻塞本地操作）
    if (cloudUtils && cloudUtils.isCloudAvailable) {
      // 使用setTimeout确保本地操作完成后再同步
      setTimeout(() => {
        try {
          cloudUtils.savePlantList(updatedList).then((success) => {
            if (success) {
              console.log('添加图片云端同步成功');
            } else {
              console.warn('添加图片云端同步失败');
            }
          }).catch((err) => {
            console.error('添加图片云端同步错误:', err);
          });
        } catch (e) {
          console.error('添加图片云端同步异常:', e);
        }
      }, 100);
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
          const removedImageInfo = (this.data.plant.imageInfos || [])[index];
          const newImages = images.filter((_, i) => i !== index);
          const newImageInfos = (this.data.plant.imageInfos || []).filter((_, i) => i !== index);
          this.updatePlantImages(newImages, newImageInfos);
          wx.showToast({ title: this.translate('detail', 'image.deleteSuccess'), icon: 'success' });
          
          // 清理云端文件（收集所有需要删除的cloud://文件）
          const filesToDelete = [];
          if (removedPath && removedPath.indexOf('cloud://') === 0) {
            filesToDelete.push(removedPath);
          }
          if (removedImageInfo && removedImageInfo.path && removedImageInfo.path.indexOf('cloud://') === 0) {
            filesToDelete.push(removedImageInfo.path);
          }
          
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (filesToDelete.length > 0 && cloudUtils.deleteCloudFiles) {
              console.log('删除图片时清理云端文件:', filesToDelete);
              cloudUtils.deleteCloudFiles(filesToDelete);
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
    // 先更新本地存储
    wx.setStorageSync('plantList', updatedList);
    // 标记首页需要刷新
    try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
    
    // 异步同步到云端（不阻塞本地操作）
    if (cloudUtils && cloudUtils.isCloudAvailable && cloudUtils.savePlantList) {
      setTimeout(() => {
        try {
          cloudUtils.savePlantList(updatedList).then((success) => {
            if (success) {
              console.log('更新图片云端同步成功');
            } else {
              console.warn('更新图片云端同步失败');
            }
          }).catch((err) => {
            console.error('更新图片云端同步错误:', err);
          });
        } catch (e) {
          console.error('更新图片云端同步异常:', e);
        }
      }, 100);
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
    
    // 创建备份数据
    const currentPlant = updatedList.find(p => p.id == this.data.plantId);
    if (currentPlant && currentPlant.imageInfos) {
      const backupKey = `plant_backup_${this.data.plantId}`;
      wx.setStorageSync(backupKey, {
        imageInfos: currentPlant.imageInfos,
        timestamp: Date.now()
      });
      console.log('已创建图片数据备份:', backupKey);
    }
    
    this.setData({
      'plant.imageInfos': currentPlant.imageInfos,
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

  // 数据恢复功能 - 如果图片信息丢失，尝试从本地存储恢复
  recoverImageData: function() {
    const plantList = wx.getStorageSync('plantList') || [];
    const plant = plantList.find(p => p.id == this.data.plantId);
    if (!plant) return;

    console.log('尝试恢复图片数据:', plant);
    
    // 检查是否有备份数据
    const backupKey = `plant_backup_${this.data.plantId}`;
    const backupData = wx.getStorageSync(backupKey);
    
    if (backupData && backupData.imageInfos) {
      console.log('找到备份数据，尝试恢复:', backupData.imageInfos);
      plant.imageInfos = backupData.imageInfos;
      
      // 更新植物列表
      const updatedList = plantList.map(p => p.id == this.data.plantId ? plant : p);
      wx.setStorageSync('plantList', updatedList);
      
      // 更新页面数据
      this.setData({ plant: plant });
      
      wx.showToast({
        title: '图片数据已恢复',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '未找到备份数据',
        icon: 'none'
      });
    }
  },

  // 强制刷新本地数据 - 从云端重新加载并保存到本地
  forceRefreshLocalData: function() {
    wx.showLoading({ title: '正在刷新数据...' });
    
    try {
      const cloudUtils = require('../../utils/cloud_utils.js');
      if (cloudUtils && cloudUtils.loadPlantList) {
        cloudUtils.loadPlantList().then(cloudList => {
          wx.hideLoading();
          if (cloudList.length > 0) {
            console.log('从云端加载的数据:', cloudList);
            
            // 直接更新本地存储
            wx.setStorageSync('plantList', cloudList);
            
            // 重新加载当前植物数据
            this.loadPlantDetail(this.data.plantId);
            
            // 延迟一点时间让数据完全加载后再显示成功消息
            setTimeout(() => {
              wx.showToast({
                title: '本地数据已刷新',
                icon: 'success'
              });
              
              // 自动执行诊断
              setTimeout(() => {
                this.diagnoseImageData();
              }, 1000);
            }, 500);
          } else {
            wx.showToast({
              title: '云端无数据',
              icon: 'none'
            });
          }
        }).catch((err) => {
          wx.hideLoading();
          console.error('强制刷新失败:', err);
          wx.showToast({
            title: '刷新失败',
            icon: 'error'
          });
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '云端服务不可用',
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('强制刷新异常:', e);
      wx.showToast({
        title: '刷新异常',
        icon: 'error'
      });
    }
  },

  // 数据诊断功能 - 检查图片数据状态
  diagnoseImageData: function() {
    // 强制重新读取本地存储数据
    const plantList = wx.getStorageSync('plantList') || [];
    const plant = plantList.find(p => p.id == this.data.plantId);
    
    console.log('诊断时读取的本地数据:', {
      plantListLength: plantList.length,
      currentPlantId: this.data.plantId,
      foundPlant: !!plant,
      plantImages: plant?.images,
      plantImageInfos: plant?.imageInfos
    });
    
    if (!plant) {
      wx.showModal({
        title: '诊断结果',
        content: '未找到植物数据',
        showCancel: false
      });
      return;
    }

    const diagnosis = {
      plantId: plant.id,
      imagesCount: Array.isArray(plant.images) ? plant.images.length : 0,
      imageInfosCount: Array.isArray(plant.imageInfos) ? plant.imageInfos.length : 0,
      images: plant.images || [],
      imageInfos: plant.imageInfos || [],
      cloudImages: [],
      localImages: [],
      invalidImages: []
    };

    // 分析图片类型 - 简化判断逻辑
    if (Array.isArray(plant.images)) {
      plant.images.forEach((img, index) => {
        if (typeof img === 'string' && img.length > 0) {
          if (img.indexOf('cloud://') === 0) {
            // 云端图片
            diagnosis.cloudImages.push({ index, path: img, type: 'cloud' });
          } else {
            // 所有非cloud://的字符串都视为本地图片
            let type = 'local';
            if (img.indexOf('http') === 0 || img.indexOf('https') === 0) {
              type = 'network';
            } else if (img.indexOf('file://') === 0 || img.indexOf('wxfile://') === 0) {
              type = 'system';
            } else if (img.indexOf('tmp/') === 0 || img.indexOf('temp/') === 0) {
              type = 'temp';
            }
            diagnosis.localImages.push({ index, path: img, type: type });
          }
        } else {
          // 非字符串或空字符串
          diagnosis.invalidImages.push({ 
            index, 
            path: img, 
            type: typeof img,
            reason: img === '' ? 'empty' : 'not_string'
          });
        }
      });
    }

    // 按类型统计本地图片
    const localImageTypes = {};
    diagnosis.localImages.forEach(img => {
      const type = img.type || 'unknown';
      localImageTypes[type] = (localImageTypes[type] || 0) + 1;
    });
    
    const localTypeText = Object.keys(localImageTypes).length > 0 
      ? Object.entries(localImageTypes).map(([type, count]) => `${type}: ${count}`).join(', ')
      : '无';

    const content = `植物ID: ${diagnosis.plantId}
图片总数: ${diagnosis.imagesCount}
图片信息数: ${diagnosis.imageInfosCount}
云端图片: ${diagnosis.cloudImages.length}
本地图片: ${diagnosis.localImages.length} (${localTypeText})
无效图片: ${diagnosis.invalidImages.length}

${diagnosis.invalidImages.length > 0 ? '⚠️ 发现无效图片数据' : '✅ 图片数据正常'}`;

    wx.showModal({
      title: '图片数据诊断',
      content: content,
      showCancel: false,
      success: () => {
        console.log('详细诊断数据:', diagnosis);
        // 显示具体的图片路径信息
        if (diagnosis.images.length > 0) {
          console.log('图片路径详情:');
          diagnosis.images.forEach((img, index) => {
            console.log(`图片 ${index}:`, img);
          });
        }
        if (diagnosis.localImages.length > 0) {
          console.log('本地图片详情:');
          diagnosis.localImages.forEach(img => {
            console.log(`本地图片 ${img.index}:`, img.path, `(${img.type})`);
          });
        }
        if (diagnosis.cloudImages.length > 0) {
          console.log('云端图片详情:');
          diagnosis.cloudImages.forEach(img => {
            console.log(`云端图片 ${img.index}:`, img.path);
          });
        }
      }
    });
  },

  // 显示原始数据 - 用于调试
  showRawData: function() {
    // 直接检查本地存储
    const plantList = wx.getStorageSync('plantList') || [];
    const plant = plantList.find(p => p.id == this.data.plantId);
    
    console.log('本地存储检查:', {
      plantListExists: !!plantList,
      plantListLength: plantList.length,
      currentPlantId: this.data.plantId,
      plantFound: !!plant,
      allPlantIds: plantList.map(p => p.id)
    });
    
    if (!plant) {
      wx.showModal({
        title: '原始数据',
        content: `未找到植物数据
植物列表长度: ${plantList.length}
当前植物ID: ${this.data.plantId}
所有植物ID: ${plantList.map(p => p.id).join(', ')}`,
        showCancel: false
      });
      return;
    }
    
    const rawData = {
      plantId: plant.id,
      images: plant.images,
      imageInfos: plant.imageInfos,
      imagesLength: Array.isArray(plant.images) ? plant.images.length : 0,
      imageInfosLength: Array.isArray(plant.imageInfos) ? plant.imageInfos.length : 0
    };
    
    console.log('原始植物数据:', rawData);
    
    // 简化的显示内容
    const content = `植物ID: ${rawData.plantId}
图片数组长度: ${rawData.imagesLength}
图片信息数组长度: ${rawData.imageInfosLength}

图片路径 (前3个):
${Array.isArray(plant.images) && plant.images.length > 0 
  ? plant.images.slice(0, 3).map((img, i) => `${i}: ${img}`).join('\n')
  : '无图片'}

${Array.isArray(plant.images) && plant.images.length > 3 
  ? `... 还有 ${plant.images.length - 3} 个图片` 
  : ''}`;

    wx.showModal({
      title: '原始数据',
      content: content,
      showCancel: false,
      success: () => {
        console.log('完整原始数据:', plant);
        console.log('所有图片路径:', plant.images);
      }
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
          
          // 收集所有需要删除的cloud://文件
          const imageFileIds = (target.images || []).filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
          const infoFileIds = (target.imageInfos || [])
            .map(info => info && info.path)
            .filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
          const allFileIds = [...imageFileIds, ...infoFileIds];
          
          const newList = plantList.filter(p => p.id != this.data.plantId);
          wx.setStorageSync('plantList', newList);
          // 标记首页需要刷新
          try { wx.setStorageSync('shouldRefreshPlantList', true); } catch (e) {}
          // 先尝试云端文件删除（吞错）
          try {
            const cloudUtils = require('../../utils/cloud_utils.js');
            if (allFileIds.length > 0 && cloudUtils.deleteCloudFiles) {
              console.log('删除植物时清理云端文件:', allFileIds);
              cloudUtils.deleteCloudFiles(allFileIds);
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
