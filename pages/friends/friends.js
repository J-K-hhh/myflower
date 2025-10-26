const shareUtils = require('../../utils/share_utils.js');
const backend = require('../../utils/backend_service.js');

Page({
  data: {
    list: []
  },
  onLoad() {
    this.loadFriends(true);
  },
  onShow() {
    // 刷新一下，拿到最新状态
    this.loadFriends(false);
  },
  loadFriends(forceRefresh = false) {
    try {
      const list = shareUtils.getFollowList();
      if (!Array.isArray(list) || list.length === 0) {
        this.setData({ list: [] });
        return;
      }
      // 最近14天关注的前20个
      const cutoff = Date.now() - 14 * 86400000;
      const recent = list.filter(i => Number(i.followedAt || 0) >= cutoff).slice(0, 20);
      // 优先使用card.ownerNickname，避免使用可能乱码的本地映射
      const mapped = recent.map(card => {
        // 直接使用card.ownerNickname，如果为空或为"朋友"，则使用空字符串
        const ownerNickname = (card.ownerNickname && card.ownerNickname !== '朋友') ? card.ownerNickname : '';
        return { ...card, ownerNickname };
      });
      this.setData({ list: mapped });

      if (!forceRefresh) return;

      const tasks = mapped.map(card => new Promise(resolve => {
        backend.loadSharedPlantByOwner(card.ownerOpenId, card.plantId, card.ownerNickname || '').then(res => {
          const plant = res && res.plant ? res.plant : res;
          if (plant) {
            const latest = shareUtils.getLatestStatus(plant);
            // 优先使用plant.ownerNickname（来自云函数的真实昵称）
            const ownerNickname = (plant.ownerNickname && plant.ownerNickname !== '朋友') ? plant.ownerNickname : '';
            resolve({ ...card, ownerNickname, lastStatus: latest, thumb: (Array.isArray(plant.images) && plant.images[0]) || card.thumb });
          } else {
            resolve(card);
          }
        }).catch(() => resolve(card));
      }));
      Promise.all(tasks).then(updated => this.setData({ list: updated }));
    } catch (e) {
      this.setData({ list: [] });
    }
  },
  openShare(e) {
    const owner = e.currentTarget.dataset.owner;
    const pid = e.currentTarget.dataset.pid;
    const nick = e.currentTarget.dataset.ownername || '';
    wx.navigateTo({ url: `/pages/share/landing?owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(pid)}&nick=${encodeURIComponent(nick)}` });
  }
});
