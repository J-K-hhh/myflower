const i18n = require('./i18n.js');

let cloudReady = false;
let currentOpenId = '';

// In-memory cache for temp file URLs to reduce repeated calls
// Structure: { [fileID]: { url: string, expiresAt: number } }
const _tempUrlCache = {};
const DEFAULT_TEMP_URL_TTL = 12 * 60 * 60 * 1000; // 12 hours

function translate(namespace, keyPath, params = {}) {
  try {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
  } catch (e) {}
  return i18n.t(namespace, keyPath, params);
}

function initCloud() {
  if (cloudReady) return true;
  try {
    // Assume App onLaunch already called wx.cloud.init with correct env.
    // Here we only check availability; DO NOT re-init to avoid overriding env.
    if (wx.cloud) {
      console.log('[cloud_utils] wx.cloud available, init ok');
      cloudReady = true;
    }
  } catch (e) {
    console.error('[cloud_utils] initCloud exception:', e);
    cloudReady = false;
  }
  return cloudReady;
}

function isCloudAvailable() {
  return initCloud();
}

function getOpenId() {
  return new Promise((resolve, reject) => {
    if (currentOpenId) { resolve(currentOpenId); return; }
    if (!initCloud()) {
      console.warn('[cloud_utils] Cloud not ready, cannot get openid');
      wx.showToast({ title: translate('common', 'storage.cloudUnavailable'), icon: 'none' });
      resolve('');
      return;
    }
    console.log('[cloud_utils] Fetching openid via cloud function: login');
    wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        currentOpenId = (res && res.result && res.result.openid) || '';
        console.log('[cloud_utils] openid result:', currentOpenId ? 'OK' : 'EMPTY');
        resolve(currentOpenId);
      })
      .catch((err) => {
        console.error('[cloud_utils] getOpenId failed:', err);
        wx.showToast({ title: translate('common', 'storage.identityFailed'), icon: 'none' });
        resolve('');
      });
  });
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      reject(new Error('Cloud not initialized'));
      return;
    }
    getOpenId().then(openid => {
      if (!openid) { reject(new Error('Missing openid')); return; }
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
      const cloudPath = `data/plants/${openid}/${fileName}`;
      console.log('[cloud_utils] Uploading image to:', cloudPath);
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          console.log('[cloud_utils] Upload success, fileID:', res && res.fileID);
          resolve(res.fileID);
        },
        fail: (err) => {
          console.error('[cloud_utils] Upload failed:', err);
          wx.showToast({ title: translate('common', 'storage.uploadFailed'), icon: 'none' });
          reject(err);
        }
      });
    }).catch(reject);
  });
}

function getTempUrls(fileIdList) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      resolve([]);
      return;
    }
    if (!fileIdList || fileIdList.length === 0) {
      resolve([]);
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: fileIdList,
      success: (res) => {
        const urls = (res.fileList || []).map(i => i.tempFileURL).filter(Boolean);
        console.log('[cloud_utils] getTempUrls success, count:', urls.length);
        resolve(urls);
      },
      fail: (err) => {
        console.error('[cloud_utils] getTempUrls failed:', err);
        reject(err);
      }
    });
  });
}

// Cached version returning a map from fileID => tempURL
function getTempUrlsCached(fileIdList) {
  return new Promise((resolve) => {
    try {
      if (!Array.isArray(fileIdList) || fileIdList.length === 0) {
        resolve({});
        return;
      }
      if (!initCloud() || !wx.cloud.getTempFileURL) {
        resolve({});
        return;
      }

      const now = Date.now();
      const ids = Array.from(new Set(
        fileIdList.filter(id => typeof id === 'string' && id.indexOf('cloud://') === 0)
      ));

      const hitMap = {};
      const misses = [];
      ids.forEach(id => {
        const rec = _tempUrlCache[id];
        if (rec && rec.url && typeof rec.expiresAt === 'number' && rec.expiresAt > now) {
          hitMap[id] = rec.url;
        } else {
          misses.push(id);
        }
      });

      if (misses.length === 0) {
        resolve(hitMap);
        return;
      }

      wx.cloud.getTempFileURL({ fileList: misses })
        .then(res => {
          const outMap = { ...hitMap };
          const list = (res && res.fileList) || [];
          list.forEach(item => {
            if (item && item.fileID && item.tempFileURL) {
              outMap[item.fileID] = item.tempFileURL;
              _tempUrlCache[item.fileID] = {
                url: item.tempFileURL,
                // Heuristic TTL; WeChat returns valid temp URLs typically within a day
                expiresAt: now + DEFAULT_TEMP_URL_TTL
              };
            }
          });
          resolve(outMap);
        })
        .catch(() => resolve(hitMap));
    } catch (e) {
      resolve({});
    }
  });
}

module.exports = {
  initCloud,
  isCloudAvailable,
  uploadImage,
  getTempUrls,
  getTempUrlsCached
};

// Cloud database helpers for persisting plant list
function savePlantList(plantList) {
  return new Promise((resolve, reject) => {
    if (!initCloud() || !wx.cloud.database) {
      console.warn('[cloud_utils] savePlantList: cloud database not available');
      resolve(false);
      return;
    }
    
    // 先确保本地有副本
    try {
      wx.setStorageSync('plantList', plantList);
      console.log('[cloud_utils] 本地副本已更新');
    } catch (e) {
      console.error('[cloud_utils] 本地副本更新失败:', e);
    }
    
    getOpenId().then(openid => {
      if (!openid) { resolve(false); return; }
      const db = wx.cloud.database();
      const collection = db.collection('plant_lists');
      console.log('[cloud_utils] Saving plant list, count:', Array.isArray(plantList) ? plantList.length : 'n/a');
      collection.doc(openid).set({
        data: {
          ownerOpenId: openid,
          list: plantList,
          updatedAt: Date.now()
        }
      }).then(() => {
        console.log('[cloud_utils] savePlantList set success');
        updateSyncTime(); // 记录同步时间
        resolve(true);
      }).catch((err) => {
        console.warn('[cloud_utils] set failed, try update:', err);
        collection.doc(openid).update({
          data: {
            list: plantList,
            updatedAt: Date.now()
          }
        }).then(() => {
          console.log('[cloud_utils] savePlantList update success');
          updateSyncTime(); // 记录同步时间
          resolve(true);
        }).catch((updateErr) => {
          console.error('[cloud_utils] savePlantList update failed:', updateErr);
          // 即使云端同步失败，本地数据仍然可用
          console.log('[cloud_utils] 云端同步失败，但本地数据已保存');
          // 显示错误弹窗
          wx.showModal({
            title: '云端同步失败',
            content: `无法同步数据到云端，错误信息：${updateErr.errMsg || updateErr.message || '未知错误'}`,
            showCancel: false,
            confirmText: '确定'
          });
          resolve(false);
        });
      });
    }).catch((err) => {
      console.error('[cloud_utils] savePlantList getOpenId error:', err);
      resolve(false);
    });
  });
}

function loadPlantList() {
  return new Promise((resolve, reject) => {
    // 优先从本地加载
    try {
      const localList = wx.getStorageSync('plantList') || [];
      if (localList.length > 0) {
        console.log('[cloud_utils] 从本地加载数据，数量:', localList.length);
        resolve(localList);
        return;
      }
    } catch (e) {
      console.warn('[cloud_utils] 本地数据加载失败:', e);
    }
    
    // 本地没有数据，尝试从云端加载
    if (!initCloud() || !wx.cloud.database) {
      console.warn('[cloud_utils] loadPlantList: cloud database not available');
      resolve([]);
      return;
    }
    
    console.log('[cloud_utils] 本地无数据，从云端加载');
    getOpenId().then(openid => {
      if (!openid) { resolve([]); return; }
      const db = wx.cloud.database();
      db.collection('plant_lists').doc(openid).get()
        .then(res => {
          const list = (res.data && res.data.list) || [];
          console.log('[cloud_utils] 云端数据加载成功，数量:', list.length);
          // 将云端数据保存到本地
          try {
            wx.setStorageSync('plantList', list);
            console.log('[cloud_utils] 云端数据已保存到本地');
          } catch (e) {
            console.error('[cloud_utils] 云端数据保存到本地失败:', e);
          }
          resolve(list);
        })
        .catch((err) => {
          console.warn('[cloud_utils] 云端数据加载失败:', err);
          // 显示错误弹窗
          wx.showModal({
            title: '云端数据加载失败',
            content: `无法从云端加载数据，错误信息：${err.errMsg || err.message || '未知错误'}`,
            showCancel: false,
            confirmText: '确定'
          });
          resolve([]);
        });
    }).catch((err) => {
      console.error('[cloud_utils] loadPlantList getOpenId error:', err);
      resolve([]);
    });
  });
}

// 数据同步状态监控
function getSyncStatus() {
  try {
    const localList = wx.getStorageSync('plantList') || [];
    const lastSyncTime = wx.getStorageSync('lastSyncTime') || 0;
    return {
      hasLocalData: localList.length > 0,
      localCount: localList.length,
      lastSyncTime: lastSyncTime,
      timeSinceLastSync: Date.now() - lastSyncTime
    };
  } catch (e) {
    return {
      hasLocalData: false,
      localCount: 0,
      lastSyncTime: 0,
      timeSinceLastSync: Infinity
    };
  }
}

// 更新同步时间戳
function updateSyncTime() {
  try {
    wx.setStorageSync('lastSyncTime', Date.now());
  } catch (e) {
    console.error('更新同步时间戳失败:', e);
  }
}

module.exports.savePlantList = savePlantList;
module.exports.loadPlantList = loadPlantList;
module.exports.getSyncStatus = getSyncStatus;
module.exports.updateSyncTime = updateSyncTime;

// Delete cloud storage files by fileIDs; ignores non-cloud paths
function deleteCloudFiles(fileIdList) {
  return new Promise((resolve) => {
    if (!initCloud() || !wx.cloud.deleteFile) {
      resolve({ deleted: 0, failed: [] });
      return;
    }
    const cloudIds = (fileIdList || []).filter(id => typeof id === 'string' && id.indexOf('cloud://') === 0);
    if (cloudIds.length === 0) {
      resolve({ deleted: 0, failed: [] });
      return;
    }
    wx.cloud.deleteFile({
      fileList: cloudIds,
      success: (res) => {
        // res.fileList: [{ fileID, status, errMsg }]
        const failed = (res.fileList || []).filter(i => i.status !== 0);
        if (failed.length > 0) {
          console.warn('[cloud_utils] 部分文件删除失败:', failed);
          wx.showModal({
            title: '文件删除失败',
            content: `部分云端文件删除失败，失败数量：${failed.length}`,
            showCancel: false,
            confirmText: '确定'
          });
        }
        resolve({ deleted: cloudIds.length - failed.length, failed: failed });
      },
      fail: (err) => {
        console.error('[cloud_utils] 文件删除失败:', err);
        wx.showModal({
          title: '文件删除失败',
          content: `无法删除云端文件，错误信息：${err.errMsg || err.message || '未知错误'}`,
          showCancel: false,
          confirmText: '确定'
        });
        resolve({ deleted: 0, failed: cloudIds.map(id => ({ fileID: id })) });
      }
    });
  });
}

module.exports.deleteCloudFiles = deleteCloudFiles;

// (Snapshot helpers removed)

// Dynamic shared read: fetch a single plant by owner+id
function loadSharedPlantByOwner(ownerOpenId, plantId) {
  return new Promise((resolve) => {
    if (!initCloud()) { resolve(null); return; }
    if (!ownerOpenId || !plantId) { resolve(null); return; }
    wx.cloud.callFunction({
      name: 'getSharedPlant',
      data: { ownerOpenId, plantId }
    }).then(res => {
      const result = (res && res.result) || {};
      resolve(result); // 直接返回（云端已尽力把图片转成URL）
    }).catch(() => resolve(null));
  });
}

module.exports.loadSharedPlantByOwner = loadSharedPlantByOwner;

// User profile management functions
function getUserProfile() {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      console.warn('[cloud_utils] getUserProfile: cloud not available');
      resolve(null);
      return;
    }
    
    wx.cloud.callFunction({ 
      name: 'userProfile', 
      data: { action: 'get' } 
    }).then(res => {
      if (res && res.result && res.result.success) {
        resolve(res.result.data);
      } else {
        console.warn('[cloud_utils] getUserProfile failed:', res.result?.error);
        resolve(null);
      }
    }).catch(err => {
      console.error('[cloud_utils] getUserProfile error:', err);
      resolve(null);
    });
  });
}

function saveUserProfile(nickname, avatarUrl = null) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      console.warn('[cloud_utils] saveUserProfile: cloud not available');
      resolve(false);
      return;
    }
    
    if (!nickname || nickname.trim() === '') {
      console.warn('[cloud_utils] saveUserProfile: nickname required');
      resolve(false);
      return;
    }
    
    wx.cloud.callFunction({ 
      name: 'userProfile', 
      data: { 
        action: 'create', 
        nickname: nickname.trim(),
        avatarUrl: avatarUrl
      } 
    }).then(res => {
      if (res && res.result && res.result.success) {
        console.log('[cloud_utils] saveUserProfile success:', res.result.message);
        resolve(true);
      } else {
        console.warn('[cloud_utils] saveUserProfile failed:', res.result?.error);
        resolve(false);
      }
    }).catch(err => {
      console.error('[cloud_utils] saveUserProfile error:', err);
      resolve(false);
    });
  });
}

function updateUserProfile(nickname, avatarUrl = null) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      console.warn('[cloud_utils] updateUserProfile: cloud not available');
      resolve(false);
      return;
    }
    
    if (!nickname || nickname.trim() === '') {
      console.warn('[cloud_utils] updateUserProfile: nickname required');
      resolve(false);
      return;
    }
    
    wx.cloud.callFunction({ 
      name: 'userProfile', 
      data: { 
        action: 'update', 
        nickname: nickname.trim(),
        avatarUrl: avatarUrl
      } 
    }).then(res => {
      if (res && res.result && res.result.success) {
        console.log('[cloud_utils] updateUserProfile success:', res.result.message);
        resolve(true);
      } else {
        console.warn('[cloud_utils] updateUserProfile failed:', res.result?.error);
        resolve(false);
      }
    }).catch(err => {
      console.error('[cloud_utils] updateUserProfile error:', err);
      resolve(false);
    });
  });
}

module.exports.getUserProfile = getUserProfile;
module.exports.saveUserProfile = saveUserProfile;
module.exports.updateUserProfile = updateUserProfile;
