let cloudReady = false;
let currentOpenId = '';

function initCloud() {
  if (cloudReady) return true;
  try {
    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        // Use default env if not configured; user can set in console
        traceUser: false
      });
      cloudReady = true;
    }
  } catch (e) {
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
    if (!initCloud()) { resolve(''); return; }
    wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        currentOpenId = (res && res.result && res.result.openid) || '';
        resolve(currentOpenId);
      })
      .catch(() => resolve(''));
  });
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      reject(new Error('Cloud not initialized'));
      return;
    }
    getOpenId().then(openid => {
      const safeOpenId = openid || 'anonymous';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
      const cloudPath = `data/plants/${safeOpenId}/${fileName}`;
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => { resolve(res.fileID); },
        fail: (err) => reject(err)
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
        resolve(urls);
      },
      fail: (err) => reject(err)
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
      resolve(false);
      return;
    }
    getOpenId().then(openid => {
      const db = wx.cloud.database();
      const collection = db.collection('plant_lists');
      collection.doc(openid || 'anonymous').set({
        data: {
          ownerOpenId: openid || 'anonymous',
          list: plantList,
          updatedAt: Date.now()
        }
      }).then(() => resolve(true)).catch(() => {
        collection.doc(openid || 'anonymous').update({
          data: {
            list: plantList,
            updatedAt: Date.now()
          }
        }).then(() => resolve(true)).catch(() => resolve(false));
      });
    }).catch(() => resolve(false));
  });
}

function loadPlantList() {
  return new Promise((resolve, reject) => {
    if (!initCloud() || !wx.cloud.database) {
      resolve([]);
      return;
    }
    getOpenId().then(openid => {
      const db = wx.cloud.database();
      db.collection('plant_lists').doc(openid || 'anonymous').get()
        .then(res => { resolve((res.data && res.data.list) || []); })
        .catch(() => resolve([]));
    }).catch(() => resolve([]));
  });
}

module.exports.savePlantList = savePlantList;
module.exports.loadPlantList = loadPlantList;


