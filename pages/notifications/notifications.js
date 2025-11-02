const backend = require('../../utils/backend_service.js');
const shareUtils = require('../../utils/share_utils.js');

Page({
  data: {
    tab: 'unread',
    items: [],
    offset: 0,
    limit: 20,
    hasMore: true,
    plantsById: null
  },
  onLoad() {
    this.loadList(true);
  },
  onShow() {
    // 刷新未读计数（交给首页显示角标）
  },
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab || 'unread';
    if (tab === this.data.tab) return;
    this.setData({ tab }, () => this.loadList(true));
  },
  loadList(reset = false) {
    const status = this.data.tab === 'all' ? 'all' : 'unread';
    const offset = reset ? 0 : this.data.offset;
    backend.listNotifications({ status, limit: this.data.limit, offset })
      .then(list => this.ensurePlantMap().then(map => ({ list: list || [], map: map || {} })))
      .then(({ list, map }) => {
        const mapped = list.map(n => ({
          ...n,
          timeText: shareUtils.timeAgo(n.time),
          plantName: map && n && (n.plantId != null) ? (map[String(n.plantId)] || map[Number(n.plantId)] || '') : ''
        }));
        if (reset) {
          this.setData({ items: mapped, offset: mapped.length, hasMore: mapped.length >= this.data.limit });
        } else {
          const next = (this.data.items || []).concat(mapped);
          this.setData({ items: next, offset: next.length, hasMore: mapped.length >= this.data.limit });
        }
      })
      .catch(() => {
        if (reset) this.setData({ items: [], offset: 0, hasMore: false });
      });
  },
  ensurePlantMap() {
    return new Promise((resolve) => {
      if (this.data.plantsById && typeof this.data.plantsById === 'object') { resolve(this.data.plantsById); return; }
      try {
        const localList = wx.getStorageSync('plantList') || [];
        if (Array.isArray(localList) && localList.length > 0) {
          const map = {};
          localList.forEach(p => {
            const idStr = String(p && p.id);
            const idNum = Number(p && p.id);
            const name = p && p.aiResult && p.aiResult.name ? p.aiResult.name : '';
            if (idStr) map[idStr] = name;
            if (!Number.isNaN(idNum)) map[idNum] = name;
          });
          this.setData({ plantsById: map });
          resolve(map);
          return;
        }
      } catch (e) {}
      // 本地没有数据，尝试从云端加载
      try {
        backend.loadPlantList().then(list => {
          const map = {};
          (list || []).forEach(p => {
            const idStr = String(p && p.id);
            const idNum = Number(p && p.id);
            const name = p && p.aiResult && p.aiResult.name ? p.aiResult.name : '';
            if (idStr) map[idStr] = name;
            if (!Number.isNaN(idNum)) map[idNum] = name;
          });
          this.setData({ plantsById: map });
          resolve(map);
        }).catch(() => resolve({}));
      } catch (e) { resolve({}); }
    });
  },
  loadMore() {
    if (!this.data.hasMore) return;
    this.loadList(false);
  },
  markAllRead() {
    backend.markAllNotificationsRead().then(() => {
      wx.showToast({ title: '已全部标记已读', icon: 'none' });
      this.loadList(true);
      // 同步更新上一页（首页）的未读红点为0
      try {
        const pages = getCurrentPages();
        if (Array.isArray(pages) && pages.length >= 2) {
          const prev = pages[pages.length - 2];
          if (prev && typeof prev.setData === 'function') {
            prev.setData({ unreadCount: 0 });
          }
        }
      } catch (e) {}
    });
  },
  openItem(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.items || []).find(i => i._id === id);
    if (!item) return;
    // 跳转到植物详情（当前用户自己的列表中）
    const pid = item.plantId;
    if (pid != null) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(pid)}` });
    }
  }
});
