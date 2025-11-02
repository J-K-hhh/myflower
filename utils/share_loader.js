const systemConfig = require('./system_config.js');
const backend = require('./backend_service.js');

function ensureCloudReady() {
  return new Promise((resolve) => {
    try {
      const app = getApp();
      const backendType = (systemConfig.getBackend() || {}).type || 'tencent';
      const wait = (app && app.ready && typeof app.ready.then === 'function')
        ? app.ready.catch(() => null)
        : Promise.resolve(null);
      Promise.resolve(wait).then(() => {
        try { backend.init && backend.init(); } catch (e) {}
        resolve(true);
      });
    } catch (e) {
      resolve(true);
    }
  });
}

function loadSharedPlant({ ownerOpenId, plantId, nick = '' }) {
  return new Promise((resolve, reject) => {
    ensureCloudReady().then(() => {
      backend.loadSharedPlantByOwner(ownerOpenId, plantId, nick)
        .then((res) => {
          const plant = res && res.plant ? res.plant : null;
          if (plant) { resolve({ plant }); return; }
          const errMsg = (res && (res.errMsg || res.error)) || 'not_found';
          reject({ errMsg });
        })
        .catch((err) => reject({ errMsg: (err && (err.errMsg || err.message)) || 'unknown' }));
    }).catch(() => reject({ errMsg: 'init_failed' }));
  });
}

function formatShareError(errMsg = '') {
  let content = '找不到该植物信息';
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const env = info && info.miniProgram && info.miniProgram.envVersion ? info.miniProgram.envVersion : 'release';
    const isPerm = /PERMISSION_DENIED|permission denied/i.test(errMsg || '');
    if (env === 'develop' || isPerm) {
      content = '当前版本或权限不允许查看分享内容，请从体验版/正式版打开，或确认已被加入为体验者。';
    }
  } catch (e) {}
  return content;
}

function showShareError(errMsg = '', navigateBack = true) {
  const content = formatShareError(errMsg);
  wx.showModal({ title: '找不到该植物信息', content, showCancel: false, success: () => { if (navigateBack) wx.navigateBack(); } });
}

module.exports = {
  ensureCloudReady,
  loadSharedPlant,
  formatShareError,
  showShareError
};

