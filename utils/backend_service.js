// Backend service abstraction to support multiple backends
// Adapters must implement a common subset of methods used by pages.

const systemConfig = require('./system_config.js');

// Tencent Cloud adapter (wrap existing cloud_utils)
const tencentAdapter = (() => {
  const cloud = require('./cloud_utils.js');
  return {
    type: 'tencent',
    isAvailable: () => cloud.isCloudAvailable && cloud.isCloudAvailable(),
    init: () => cloud.initCloud && cloud.initCloud(),
    uploadImage: cloud.uploadImage,
    getTempUrlsCached: cloud.getTempUrlsCached,
    savePlantList: cloud.savePlantList,
    loadPlantList: cloud.loadPlantList,
    deleteFiles: cloud.deleteCloudFiles,
    loadSharedPlantByOwner: cloud.loadSharedPlantByOwner,
    loadSharedPlantById: cloud.loadSharedPlantById,
    saveShareComment: cloud.saveShareComment,
    listShareComments: cloud.listShareComments,
    saveShareLike: cloud.saveShareLike,
    listShareLikes: cloud.listShareLikes,
    getUserProfile: cloud.getUserProfile,
    saveUserProfile: cloud.saveUserProfile,
    updateUserProfile: cloud.updateUserProfile,
    listNotifications: cloud.listNotifications,
    markAllNotificationsRead: cloud.markAllNotificationsRead,
    getNotificationStats: cloud.getNotificationStats
  };
})();

// Local adapter (no cloud). Uses only local storage and file paths.
const localAdapter = (() => {
  function isAvailable() { return true; }
  function init() { return true; }
  function uploadImage(filePath) { return Promise.resolve(filePath); }
  function getTempUrlsCached(map) { return Promise.resolve({}); }
  function savePlantList(list) { try { wx.setStorageSync('plantList', list); return Promise.resolve(true); } catch (e) { return Promise.resolve(false); } }
  function loadPlantList() { try { return Promise.resolve(wx.getStorageSync('plantList') || []); } catch (e) { return Promise.resolve([]); } }
  function deleteFiles(fileIds) { return Promise.resolve({ deleted: 0, failed: [] }); }
  function loadSharedPlantByOwner() { return Promise.resolve(null); }
  function loadSharedPlantById() { return Promise.resolve(null); }
  function saveShareComment() { return Promise.resolve({ ok: false }); }
  function listShareComments() { return Promise.resolve([]); }
  function saveShareLike() { return Promise.resolve({ ok: false }); }
  function listShareLikes() { return Promise.resolve({ items: [], count: 0 }); }
  function getUserProfile() { return Promise.resolve(null); }
  function saveUserProfile() { return Promise.resolve(false); }
  function updateUserProfile() { return Promise.resolve(false); }
  function listNotifications() { return Promise.resolve([]); }
  function markAllNotificationsRead() { return Promise.resolve(false); }
  function getNotificationStats() { return Promise.resolve({ unread: 0 }); }
  return {
    type: 'local',
    isAvailable, init, uploadImage, getTempUrlsCached,
    savePlantList, loadPlantList, deleteFiles,
    loadSharedPlantByOwner, loadSharedPlantById, saveShareComment, listShareComments,
    saveShareLike, listShareLikes,
    getUserProfile, saveUserProfile, updateUserProfile,
    listNotifications, markAllNotificationsRead,
    getNotificationStats
  };
})();

// Custom HTTP adapter (placeholder). Integrate with your own backend.
const httpAdapter = (() => {
  function getBase() { return (systemConfig.getBackend().options || {}).baseUrl || ''; }
  function isAvailable() { return !!getBase(); }
  function init() { return true; }
  function uploadImage(filePath) {
    // Not implemented: You can implement uploading via wx.uploadFile to your REST endpoint.
    return Promise.reject(new Error('HTTP adapter uploadImage not implemented'));
  }
  function getTempUrlsCached() { return Promise.resolve({}); }
  function savePlantList(list) {
    // Example POST: wx.request({ url: base + '/plant-list', method: 'PUT', data: list, ... })
    return Promise.reject(new Error('HTTP adapter savePlantList not implemented'));
  }
  function loadPlantList() { return Promise.resolve([]); }
  function deleteFiles() { return Promise.resolve({ deleted: 0, failed: [] }); }
  function loadSharedPlantByOwner() { return Promise.resolve(null); }
  function loadSharedPlantById() { return Promise.resolve(null); }
  function saveShareComment() { return Promise.resolve({ ok: false }); }
  function listShareComments() { return Promise.resolve([]); }
  function saveShareLike() { return Promise.resolve({ ok: false }); }
  function listShareLikes() { return Promise.resolve({ items: [], count: 0 }); }
  function getUserProfile() { return Promise.resolve(null); }
  function saveUserProfile() { return Promise.resolve(false); }
  function updateUserProfile() { return Promise.resolve(false); }
  function listNotifications() { return Promise.resolve([]); }
  function markAllNotificationsRead() { return Promise.resolve(false); }
  function getNotificationStats() { return Promise.resolve({ unread: 0 }); }
  return {
    type: 'custom-http',
    isAvailable, init, uploadImage, getTempUrlsCached,
    savePlantList, loadPlantList, deleteFiles,
    loadSharedPlantByOwner, loadSharedPlantById, saveShareComment, listShareComments,
    saveShareLike, listShareLikes,
    getUserProfile, saveUserProfile, updateUserProfile,
    listNotifications, markAllNotificationsRead,
    getNotificationStats
  };
})();

function getAdapter() {
  const backend = systemConfig.getBackend();
  if (!backend || !backend.type) return tencentAdapter;
  if (backend.type === 'tencent') return tencentAdapter;
  if (backend.type === 'local') return localAdapter;
  if (backend.type === 'custom-http') return httpAdapter;
  return tencentAdapter;
}

// Facade exports
module.exports = {
  get type() { return getAdapter().type; },
  isAvailable: () => getAdapter().isAvailable(),
  init: () => getAdapter().init(),
  uploadImage: (...args) => getAdapter().uploadImage(...args),
  getTempUrlsCached: (...args) => getAdapter().getTempUrlsCached(...args),
  savePlantList: (...args) => getAdapter().savePlantList(...args),
  loadPlantList: (...args) => getAdapter().loadPlantList(...args),
  deleteFiles: (...args) => getAdapter().deleteFiles(...args),
  loadSharedPlantByOwner: (...args) => getAdapter().loadSharedPlantByOwner(...args),
  loadSharedPlantById: (...args) => getAdapter().loadSharedPlantById(...args),
  saveShareComment: (...args) => getAdapter().saveShareComment(...args),
  listShareComments: (...args) => getAdapter().listShareComments(...args),
  saveShareLike: (...args) => getAdapter().saveShareLike(...args),
  listShareLikes: (...args) => getAdapter().listShareLikes(...args),
  getUserProfile: (...args) => getAdapter().getUserProfile(...args),
  saveUserProfile: (...args) => getAdapter().saveUserProfile(...args),
  updateUserProfile: (...args) => getAdapter().updateUserProfile(...args),
  listNotifications: (...args) => getAdapter().listNotifications(...args),
  markAllNotificationsRead: (...args) => getAdapter().markAllNotificationsRead(...args),
  getNotificationStats: (...args) => getAdapter().getNotificationStats(...args)
};
