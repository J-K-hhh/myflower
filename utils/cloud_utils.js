let cloudReady = false;
let currentOpenId = '';

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
      wx.showToast({ title: '云能力不可用', icon: 'none' });
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
        wx.showToast({ title: '无法获取用户身份', icon: 'none' });
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
          wx.showToast({ title: '图片上传失败', icon: 'none' });
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

module.exports = {
  initCloud,
  isCloudAvailable,
  uploadImage,
  getTempUrls
};

// Cloud database helpers for persisting plant list
function savePlantList(plantList) {
  return new Promise((resolve, reject) => {
    if (!initCloud() || !wx.cloud.database) {
      console.warn('[cloud_utils] savePlantList: cloud database not available');
      resolve(false);
      return;
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
          resolve(true);
        }).catch((updateErr) => {
          console.error('[cloud_utils] savePlantList update failed:', updateErr);
          wx.showToast({ title: '云同步失败', icon: 'none' });
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
    if (!initCloud() || !wx.cloud.database) {
      console.warn('[cloud_utils] loadPlantList: cloud database not available');
      resolve([]);
      return;
    }
    getOpenId().then(openid => {
      if (!openid) { resolve([]); return; }
      const db = wx.cloud.database();
      db.collection('plant_lists').doc(openid).get()
        .then(res => {
          const list = (res.data && res.data.list) || [];
          console.log('[cloud_utils] loadPlantList success, count:', list.length);
          resolve(list);
        })
        .catch((err) => {
          console.warn('[cloud_utils] loadPlantList not found or error:', err);
          resolve([]);
        });
    }).catch((err) => {
      console.error('[cloud_utils] loadPlantList getOpenId error:', err);
      resolve([]);
    });
  });
}

module.exports.savePlantList = savePlantList;
module.exports.loadPlantList = loadPlantList;

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
        resolve({ deleted: cloudIds.length - failed.length, failed: failed });
      },
      fail: () => {
        resolve({ deleted: 0, failed: cloudIds.map(id => ({ fileID: id })) });
      }
    });
  });
}

module.exports.deleteCloudFiles = deleteCloudFiles;


