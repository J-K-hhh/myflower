const i18n = require('../../utils/i18n.js');

Page({
  data: {
    plantList: [],
    friendShares: [],
    friendSharesLoading: false,
    reorderMode: false,
    // 拖拽排序相关
    draggingIndex: -1,
    hoverIndex: -1,
    dragY: 0,
    itemHeights: [],
    itemPositions: [], // 预览位置
    basePositions: [], // 基线位置
    reorderAreaHeight: 0,
    fallbackItemHeightPx: 360,
    batchMode: false,
    selectedPlants: [],
    showBatchActions: false,
    // V0.3 批量操作历史
    showBatchHistoryModal: false,
    batchHistoryData: [],
    // V0.4 提醒功能
    reminderStatus: 'noPlants', // noPlants, needsWatering, wateredRecently
    reminderText: '',
    needsWateringPlants: [], // 需要浇水的植物列表
    i18n: i18n.getSection('index'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage(),
    batchSelectionText: i18n.t('index', 'batchMode.selectedCount', { count: 0 }),
    unreadCount: 0
  },
  onLoad: function () {
    this.updateTranslations();
    this.loadUserProfile();
    // 主动加载一次我的植物列表，避免某些跳转路径仅触发onLoad
    this.loadPlantData();
    this.loadFriendShares(true);
    // 冷启动时也尝试拉取未读计数，保证红点尽早出现
    try { this.updateUnreadCount(); } catch (e) {}
  },
  onShow: function () {
    // 仅在需要时刷新，减少从详情返回时的全量刷新闪烁
    this.updateTranslations();
    try {
      const shouldRefresh = wx.getStorageSync('shouldRefreshPlantList');
      const hasLocal = Array.isArray(this.data.plantList) && this.data.plantList.length > 0;
      if (!shouldRefresh && hasLocal) {
        // 检查本地存储与当前列表是否不一致（例如删除了植物但未刷新）
        const latest = wx.getStorageSync('plantList') || [];
        const currentIds = (this.data.plantList || []).map(p => Number(p.id));
        const latestIds = (latest || []).map(p => Number(p.id));
        const sameLength = currentIds.length === latestIds.length;
        const sameSet = sameLength && currentIds.every(id => latestIds.indexOf(id) >= 0);
        if (!sameSet) {
          this.loadPlantData();
        } else {
          // 即使不刷新数据，也要重新计算提醒状态（语言可能已切换）
          this.calculateReminderStatus(this.data.plantList);
          this.setRandomTitle();
          // 即使走快速返回分支，也要刷新通知红点与提示
          try { this.updateUnreadCount(); } catch (e) {}
          try { this.checkNotifications(); } catch (e) {}
        }
        return;
      }
    } catch (e) {}
    // 清除刷新标记并加载
    try { wx.removeStorageSync('shouldRefreshPlantList'); } catch (e) {}
    this.loadPlantData();
    // 刷新朋友分享区
    try {
      const refreshFriend = wx.getStorageSync('shouldRefreshFriendShares');
      if (refreshFriend) {
        wx.removeStorageSync('shouldRefreshFriendShares');
        this.loadFriendShares(true);
      } else {
        this.loadFriendShares(false);
      }
    } catch (e) {
      this.loadFriendShares(false);
    }
    this.setRandomTitle();
    this.updateNavigationTitle();
    // 先拉取未读统计，保证红点有保底值
    this.updateUnreadCount();
    // 再检查最新未读并进行提示，同时用更大的值更新红点
    this.checkNotifications();
    // 兜底：稍后再刷新一次，避免冷启动早期环境/网络抖动
    try { clearTimeout(this._notifTid); } catch (e) {}
    this._notifTid = setTimeout(() => this.updateUnreadCount(), 1000);
    // 启动前台轮询，保证停留在首页时红点持续更新
    this.startNotificationPolling();
  },
  onHide: function() {
    this.stopNotificationPolling();
  },
  onUnload: function() {
    this.stopNotificationPolling();
  },
  updateTranslations: function() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    this.setData({
      i18n: i18n.getSection('index', language),
      i18nCommon: i18n.getSection('common', language),
      language: language
    });
    this.updateBatchSelectionText(this.data.selectedPlants.length || 0);
    if (Array.isArray(this.data.batchHistoryData) && this.data.batchHistoryData.length > 0) {
      const delimiter = this.translate('common', 'listDelimiter');
      const updatedHistory = this.data.batchHistoryData.map(item => {
        const plantList = Array.isArray(item.plantNames) ? item.plantNames.join(delimiter) : item.plantList;
        const typeText = item.type === 'watering'
          ? this.translate('index', 'batchMode.watering')
          : this.translate('index', 'batchMode.fertilizing');
        return {
          ...item,
          plantList,
          typeText,
          plantCountLabel: this.translate('index', 'batchMode.plantCountLabel', { count: item.count })
        };
      });
      this.setData({ batchHistoryData: updatedHistory });
    }
  },
  // 加载朋友关注的分享（本地存储 + 云端刷新最新状态）
  loadFriendShares: function(forceRefresh = false) {
    try {
      const shareUtils = require('../../utils/share_utils.js');
      const backend = require('../../utils/backend_service.js');
      const list = shareUtils.getFollowList();
      if (!Array.isArray(list) || list.length === 0) {
        this.setData({ friendShares: [] });
        return;
      }
      // 仅展示最近14天关注的前10个
      const cutoff = Date.now() - 14 * 86400000;
      const recent = list.filter(i => Number(i.followedAt || 0) >= cutoff).slice(0, 10);
      // 先渲染本地，再尝试刷新状态
      this.setData({ friendShares: recent, friendSharesLoading: true });
      if (!forceRefresh) { this.setData({ friendSharesLoading: false }); return; }

      const shareLoader = require('../../utils/share_loader.js');
      const tasks = recent.map(card => new Promise(resolve => {
        shareLoader.ensureCloudReady()
          .then(() => shareLoader.loadSharedPlant({ ownerOpenId: card.ownerOpenId, plantId: card.plantId }))
          .then(({ plant }) => {
            if (plant) {
              const latest = shareUtils.getLatestStatus(plant);
              resolve({ ...card, lastStatus: latest, thumb: (Array.isArray(plant.images) && plant.images[0]) || card.thumb });
            } else { resolve(card); }
          })
          .catch(() => resolve(card));
      }));

      Promise.all(tasks).then(updated => {
        this.setData({ friendShares: updated, friendSharesLoading: false });
      });
    } catch (e) {
      console.warn('[index] loadFriendShares error:', e);
      this.setData({ friendSharesLoading: false });
    }
  },
  // 朋友卡片上的留言入口
  tapFriendComment: function(e) {
    const { owner, pid } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/share/landing?owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(pid)}` });
  },
  translate: function(namespace, keyPath, params = {}) {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
    const language = this.data.language || i18n.getLanguage();
    return i18n.t(namespace, keyPath, params, language);
  },

  updateBatchSelectionText: function(count) {
    const text = this.translate('index', 'batchMode.selectedCount', { count });
    this.setData({ batchSelectionText: text });
  },
  
  setRandomTitle: function() {
    const app = getApp();
    app.setRandomTitle();
  },
  goHome: function() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
  goToFriends: function() {
    wx.navigateTo({ url: '/pages/friends/friends' });
  },

  // 更新导航栏标题，显示用户昵称
  updateNavigationTitle: function() {
    const app = getApp();
    if (app && app.globalData && app.globalData.userProfile && app.globalData.userProfile.nickname) {
      const nickname = app.globalData.userProfile.nickname;
      const emoji = app.globalData.currentEmoji || '🌱';
      const title = `${emoji} ${nickname}的阳台花园`;
      wx.setNavigationBarTitle({
        title: title
      });
    } else {
      // 如果没有用户资料，使用默认标题
      this.setRandomTitle();
    }
  },

  // 加载用户资料
  loadUserProfile: function() {
    const app = getApp();
    if (app && typeof app.loadUserProfile === 'function') {
      app.loadUserProfile().then(profile => {
        if (profile) {
          this.updateNavigationTitle();
        }
      }).catch(err => {
        console.error('加载用户资料失败:', err);
      });
    }
  },
  loadPlantData: function () {
    const localList = wx.getStorageSync('plantList') || [];
    let plantList = (localList).map(p => ({
      ...p,
      id: Number(p.id),
      selected: Array.isArray(this.data.selectedPlants) ? this.data.selectedPlants.indexOf(Number(p.id)) > -1 : false
    }));
    // 如果本地没有数据，尝试从云端加载（loadPlantList已经处理了本地优先逻辑）
    if (plantList.length === 0) {
      try {
        const backend = require('../../utils/backend_service.js');
        if (backend && backend.loadPlantList) {
          backend.loadPlantList().then(cloudList => {
            if (cloudList.length > 0) {
              wx.showToast({ title: this.translate('common', 'storage.restoreSuccess'), icon: 'success' });
              this.loadPlantData(); // 重新加载，此时本地已有数据
            } else {
              wx.showToast({ title: this.translate('common', 'storage.restoreEmpty'), icon: 'none' });
              this.finishLoad(plantList);
            }
          }).catch((err) => {
            console.warn('[index] cloud restore failed:', err);
            wx.showToast({ title: this.translate('common', 'storage.restoreFailed'), icon: 'none' });
            this.finishLoad(plantList);
          });
          return;
        }
      } catch (e) {
        console.error('[index] restore try-catch error:', e);
      }
      this.finishLoad(plantList);
      return;
    }
    plantList.forEach(plant => {
      if (plant.createTime) {
        plant.createDate = new Date(plant.createTime).toLocaleDateString();
      }
    });
    // Resolve cloud fileIDs to temp URLs for display (if any)
    const firstImages = plantList.map(p => p.images && p.images[0] ? p.images[0] : null);
    const cloudIds = firstImages.filter(path => path && path.indexOf('cloud://') === 0);
    if (cloudIds.length > 0) {
      try {
        const backend = require('../../utils/backend_service.js');
        backend.getTempUrlsCached(cloudIds).then((map) => {
          plantList.forEach(p => {
            if (p.images && p.images[0] && map[p.images[0]]) {
              p.images[0] = map[p.images[0]];
            }
          });
          this.finishLoad(plantList);
        }).catch((err) => {
          console.warn('[index] getTempUrlsCached failed:', err);
          this.finishLoad(plantList);
        });
        return;
      } catch (e) {
        console.warn('[index] temp url cache not available:', e);
      }
    }
    this.finishLoad(plantList);
  },

  finishLoad: function(plantList) {
    // 按照用户保存的顺序排序
    try {
      const savedOrder = wx.getStorageSync('plantOrder') || [];
      if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        const orderMap = new Map();
        savedOrder.forEach((id, idx) => orderMap.set(Number(id), idx));
        plantList.sort((a, b) => {
          const ia = orderMap.has(Number(a.id)) ? orderMap.get(Number(a.id)) : Number.MAX_SAFE_INTEGER;
          const ib = orderMap.has(Number(b.id)) ? orderMap.get(Number(b.id)) : Number.MAX_SAFE_INTEGER;
          if (ia === ib) return 0;
          return ia - ib;
        });
      }
    } catch (e) {}
    this.setData({ plantList: plantList });
    // 计算提醒状态
    this.calculateReminderStatus(plantList);
  },
  updateUnreadCount: function() {
    try {
      const backend = require('../../utils/backend_service.js');
      backend.getNotificationStats && backend.getNotificationStats().then(stats => {
        const n = (stats && typeof stats.unread === 'number') ? stats.unread : 0;
        this.setData({ unreadCount: n });
      }).catch(() => this.setData({ unreadCount: 0 }));
    } catch (e) {}
  },
  openNotifications: function() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },
  // 前台轮询：在首页可见时每隔一段时间刷新未读数量
  startNotificationPolling: function() {
    try { this.stopNotificationPolling(); } catch (e) {}
    // 轮询间隔（秒）可按需调整：15~30s 较合适
    const intervalMs = 20000;
    this._notifPoll = setInterval(() => {
      this.updateUnreadCount();
    }, intervalMs);
  },
  stopNotificationPolling: function() {
    if (this._notifPoll) {
      clearInterval(this._notifPoll);
      this._notifPoll = null;
    }
  },
  // 检查来自朋友的互动通知（如点赞）
  checkNotifications: function() {
    try {
      const backend = require('../../utils/backend_service.js');
      backend.listNotifications({ status: 'unread', limit: 20 }).then(items => {
        const list = Array.isArray(items) ? items : [];
        if (list.length > 0) {
          const first = list[0];
          const name = (first && (first.actorNickname || '朋友'));
          const count = list.length;
          const anyComment = list.some(i => i && i.type === 'comment');
          const verb = anyComment ? '有新的评论' : '赞了你的图片';
          const msg = count === 1 ? `${name} ${verb}` : `${name} 等 ${count} 人有新的互动`;
          wx.showToast({ title: msg, icon: 'none' });
          // 立即在本地更新未读红点，取更大值，避免随后 stats(延迟)覆盖为更小值
          const current = Number(this.data.unreadCount || 0);
          const next = Math.max(current, count);
          this.setData({ unreadCount: next });
          // 不自动标记已读，保留给通知中心处理
        }
      }).catch(() => {});
    } catch (e) {}
  },
  // 进入排序模式（长按卡片）
  enterReorderMode: function() {
    if (this.data.batchMode) return;
    try {
      const sys = wx.getSystemInfoSync();
      const pxPerRpx = sys && sys.windowWidth ? sys.windowWidth / 750 : 1;
      const fallbackH = Math.max(200, Math.round(420 * pxPerRpx));
      const n = (this.data.plantList || []).length;
      const heights = Array(n).fill(fallbackH);
      const gap = 12;
      const positions = [];
      let y = 0;
      for (let i = 0; i < n; i++) { positions.push(y); y += heights[i] + gap; }
      const areaHeight = Math.max(y - gap, 0);
      this.setData({
        reorderMode: true,
        draggingIndex: -1,
        hoverIndex: -1,
        itemHeights: heights,
        basePositions: positions,
        itemPositions: positions.slice(),
        reorderAreaHeight: areaHeight,
        fallbackItemHeightPx: fallbackH,
        dragY: 0
      });
      setTimeout(() => { this.refreshReorderLayout(); }, 60);
    } catch (e) {
      this.setData({ reorderMode: true });
      setTimeout(() => { this.refreshReorderLayout(); }, 60);
    }
    wx.showToast({ title: this.translate('common', 'reorderStart') || '进入排序', icon: 'none' });
  },
  // 精确测量并刷新拖拽布局
  refreshReorderLayout: function() {
    try {
      const query = this.createSelectorQuery();
      query.selectAll('.reorder-card').boundingClientRect(rects => {
        if (!Array.isArray(rects) || rects.length === 0) return;
        const heights = rects.map(r => Math.max(1, Math.round(r.height)));
        const gap = 12;
        const positions = [];
        let y = 0;
        for (let i = 0; i < heights.length; i++) { positions.push(y); y += heights[i] + gap; }
        const areaHeight = Math.max(y - gap, 0);
        this.setData({
          itemHeights: heights,
          basePositions: positions,
          itemPositions: positions.slice(),
          reorderAreaHeight: areaHeight
        });
      }).exec();
    } catch (e) {}
  },
  // 完成排序，保存顺序
  finishReorder: function() {
    const order = (this.data.plantList || []).map(p => Number(p.id));
    try { wx.setStorageSync('plantOrder', order); } catch (e) {}
    this.setData({ reorderMode: false });
    wx.showToast({ title: this.translate('common', 'saved') || '已保存', icon: 'success' });
  },
  // 拖拽开始
  onDragTouchStart: function(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (isNaN(idx)) return;
    const startY = (this.data.itemPositions || [])[idx] || 0;
    this.setData({ draggingIndex: idx, hoverIndex: idx, dragY: startY });
  },
  // 拖拽移动
  onDragChange: function(e) {
    if (!e || !e.detail || e.detail.source !== 'touch') return;
    let idx = this.data.draggingIndex;
    if (isNaN(idx) || idx < 0) {
      const dsIdx = Number(e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.index : NaN);
      if (!isNaN(dsIdx)) {
        idx = dsIdx;
        this.setData({ draggingIndex: dsIdx, hoverIndex: dsIdx });
      }
    }
    if (isNaN(idx) || idx < 0) return;
    const currentY = e.detail.y;
    const heights = (this.data.itemHeights || []).slice();
    const base = (this.data.basePositions || []).slice();
    if (idx >= base.length) return;
    this.setData({ dragY: currentY });
    // 找到最近插入位置
    const centerY = currentY + (heights[idx] || 0) / 2;
    let nearestIndex = 0;
    let minDist = Infinity;
    for (let i = 0; i < base.length; i++) {
      const c = (base[i] || 0) + (heights[i] || 0) / 2;
      const d = Math.abs(centerY - c);
      if (d < minDist) { minDist = d; nearestIndex = i; }
    }
    if (nearestIndex === this.data.hoverIndex) return;
    // 预览：根据拖拽项插入到 nearestIndex 后的位置，计算每个原索引的y
    const n = heights.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    const [moved] = order.splice(idx, 1);
    order.splice(nearestIndex, 0, moved);
    const pos = new Array(n);
    const gap = 12;
    let y = 0;
    for (let k = 0; k < n; k++) {
      const originalIndex = order[k];
      pos[originalIndex] = y;
      y += heights[originalIndex] + gap;
    }
    this.setData({ itemPositions: pos, hoverIndex: nearestIndex, reorderAreaHeight: Math.max(y - gap, 0) });
  },
  // 拖拽结束，提交顺序
  onDragTouchEnd: function(e) {
    const from = this.data.draggingIndex;
    const to = this.data.hoverIndex;
    if (isNaN(from) || from < 0) return;
    const list = (this.data.plantList || []).slice();
    if (!isNaN(to) && to >= 0 && to < list.length && to !== from) {
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
    }
    // 依据最终顺序重建位置
    const h = (this.data.itemHeights || []).slice();
    const gap = 12;
    const base = [];
    let y0 = 0;
    for (let i = 0; i < h.length; i++) { base.push(y0); y0 += h[i] + gap; }
    const areaHeight = Math.max(y0 - gap, 0);
    this.setData({
      plantList: list,
      basePositions: base,
      itemPositions: base.slice(),
      reorderAreaHeight: areaHeight,
      draggingIndex: -1,
      hoverIndex: -1,
      dragY: 0
    });
    // 保存顺序
    try {
      const orderIds = (list || []).map(p => Number(p.id));
      wx.setStorageSync('plantOrder', orderIds);
    } catch (e2) {}
  },
  // 移动植物位置
  moveItem: function(e) {
    if (!this.data.reorderMode) return;
    
    const currentIndex = Number(e.currentTarget.dataset.index);
    const direction = e.currentTarget.dataset.direction;
    
    if (isNaN(currentIndex)) return;
    
    let newIndex;
    if (direction === 'up') {
      newIndex = currentIndex - 1;
    } else if (direction === 'down') {
      newIndex = currentIndex + 1;
    } else {
      return;
    }
    
    // 检查边界
    if (newIndex < 0 || newIndex >= this.data.plantList.length) {
      wx.showToast({ 
        title: direction === 'up' ? '已经是第一个' : '已经是最后一个', 
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    // 交换位置
    const list = [...this.data.plantList];
    const [movedItem] = list.splice(currentIndex, 1);
    list.splice(newIndex, 0, movedItem);
    
    this.setData({ plantList: list });
    
    // 保存顺序
    try {
      const order = list.map(p => Number(p.id));
      wx.setStorageSync('plantOrder', order);
      console.log('顺序已保存');
    } catch (e) {
      console.error('保存顺序失败:', e);
    }
  },
  // 卡片点击：根据模式决定行为
  onCardTap: function(e) {
    if (this.data.reorderMode) return; // 排序模式下不跳转
    const id = Number(e.currentTarget.dataset.id);
    if (this.data.batchMode) {
      this.togglePlantSelection({ currentTarget: { dataset: { id } } });
    } else {
      this.goToDetail({ currentTarget: { dataset: { id } } });
    }
  },
  noop: function() {},

  // 计算提醒状态
  calculateReminderStatus: function(plantList) {
    if (!plantList || plantList.length === 0) {
      this.setData({
        reminderStatus: 'noPlants',
        reminderText: ''
      });
      return;
    }

    // 获取提醒设置
    const settings = wx.getStorageSync('appSettings') || {};
    const reminderFrequency = settings.reminderFrequency || 'frequent';
    
    if (reminderFrequency === 'off') {
      this.setData({
        reminderStatus: 'noPlants',
        reminderText: ''
      });
      return;
    }

    // 计算提醒间隔（天数）
    let reminderDays = 0;
    switch (reminderFrequency) {
      case 'daily':
        reminderDays = 1;
        break;
      case 'frequent':
        reminderDays = 3;
        break;
      case 'occasional':
        reminderDays = 7;
        break;
      default:
        reminderDays = 3;
    }

    // 工具：获取植物最近一次浇水的时间戳（毫秒）
    const getLastWateringTs = (plant) => {
      const wh = Array.isArray(plant.wateringHistory) ? plant.wateringHistory : [];
      if (wh.length > 0) {
        // 历史按 unshift 插入，索引0为最新
        const entry = wh[0];
        const ts = entry && (entry.timestamp || entry.time || (entry.date ? new Date(entry.date).getTime() : null));
        if (ts && !isNaN(ts)) return Number(ts);
      }
      if (plant.lastWateringDate) {
        const ts = new Date(plant.lastWateringDate).getTime();
        if (!isNaN(ts)) return ts;
      }
      return null;
    };

    const now = Date.now();
    let needsWateringCount = 0;
    const needsWateringPlants = [];

    plantList.forEach(plant => {
      const lastTs = getLastWateringTs(plant);
      if (lastTs == null) {
        // 没有任何浇水记录，视为需要浇水
        needsWateringCount++;
        needsWateringPlants.push({
          id: plant.id,
          name: plant.aiResult?.name || this.translate('common', 'unknownPlant'),
          daysSinceWatering: '∞'
        });
        return;
      }
      const daysSince = Math.floor((now - lastTs) / (1000 * 60 * 60 * 24));
      if (daysSince >= reminderDays) {
        needsWateringCount++;
        needsWateringPlants.push({
          id: plant.id,
          name: plant.aiResult?.name || this.translate('common', 'unknownPlant'),
          daysSinceWatering: daysSince
        });
      }
    });

    // 设置提醒状态和文本
    if (needsWateringCount > 0) {
      // 找到最近一次浇水日期（全局最大）
      let lastWateringTs = null;
      plantList.forEach(plant => {
        const t = getLastWateringTs(plant);
        if (t != null) {
          if (lastWateringTs == null || t > lastWateringTs) lastWateringTs = t;
        }
      });
      
      let reminderText = this.translate('common', 'reminder.status.needsWatering');
      
      this.setData({
        reminderStatus: 'needsWatering',
        reminderText: reminderText,
        needsWateringPlants: needsWateringPlants // 存储需要浇水的植物列表
      });
    } else {
      // 找到最近一次浇水日期（全局最大）
      let lastWateringTs = null;
      plantList.forEach(plant => {
        const t = getLastWateringTs(plant);
        if (t != null) {
          if (lastWateringTs == null || t > lastWateringTs) lastWateringTs = t;
        }
      });
      
      let reminderText = this.translate('common', 'reminder.status.wateredRecently');
      if (lastWateringTs != null) {
        const dateStr = new Date(lastWateringTs).toLocaleDateString();
        reminderText += ` - ${this.translate('common', 'lastWatering')}: ${dateStr}`;
      }
      
      this.setData({
        reminderStatus: 'wateredRecently',
        reminderText: reminderText,
        needsWateringPlants: [] // 清空需要浇水的植物列表
      });
    }
  },

  // 显示需要浇水的植物列表
  showNeedsWateringPlants: function() {
    if (!this.data.needsWateringPlants || this.data.needsWateringPlants.length === 0) {
      wx.showToast({
        title: this.translate('common', 'reminder.noPlantsNeedWatering'),
        icon: 'none'
      });
      return;
    }

    const plantNames = this.data.needsWateringPlants.map(plant => {
      let daysText = '';
      if (plant.daysSinceWatering === '∞') {
        daysText = this.translate('common', 'reminder.neverWateredCute');
      } else {
        const d = Number(plant.daysSinceWatering);
        daysText = isNaN(d)
          ? ''
          : this.translate('common', 'reminder.daysAgo', { days: d });
      }
      return `${plant.name}（${daysText}）`;
    }).join('\n');

    wx.showModal({
      title: this.translate('common', 'reminder.needsWateringTitle'),
      content: plantNames,
      showCancel: false,
      confirmText: this.translate('common', 'ok')
    });
  },

  goToAdd: function () {
    wx.navigateTo({
      url: '/pages/add/add',
    });
  },
  goToDetail: function (e) {
    const plantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${plantId}`,
    });
  },
  goToSettings: function () {
    wx.navigateTo({
      url: '/pages/settings/settings',
    });
  },
  
  // V0.3 批量操作功能
  toggleBatchMode: function() {
    const newBatchMode = !this.data.batchMode;
    this.setData({
      batchMode: newBatchMode,
      selectedPlants: newBatchMode ? [] : [],
      showBatchActions: false
    });
    this.updateBatchSelectionText(0);
  },
  
  togglePlantSelection: function(e) {
    if (!this.data.batchMode) return;
    
    const plantId = Number(e.currentTarget.dataset.id);
    const selectedPlants = [...this.data.selectedPlants];
    const index = selectedPlants.indexOf(plantId);
    
    if (index > -1) {
      selectedPlants.splice(index, 1);
    } else {
      selectedPlants.push(plantId);
    }
    
    const plantList = this.data.plantList.map(item => ({
      ...item,
      selected: selectedPlants.indexOf(item.id) > -1
    }));
    
    this.setData({
      selectedPlants: selectedPlants,
      plantList: plantList,
      showBatchActions: selectedPlants.length > 0
    });
    this.updateBatchSelectionText(selectedPlants.length);
  },
  
  batchWatering: function() {
    // 如果不在批量模式，先进入批量模式
    if (!this.data.batchMode) {
      this.toggleBatchMode();
      return;
    }
    
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: this.translate('index', 'batchMode.noSelection'), icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: this.translate('index', 'batchMode.confirmWateringTitle'),
      content: this.translate('index', 'batchMode.confirmWateringContent', { count: this.data.selectedPlants.length }) + '',
      success: (res) => {
        if (res.confirm) {
          this.performBatchWatering();
        }
      }
    });
  },
  
  batchFertilizing: function() {
    if (this.data.selectedPlants.length === 0) {
      wx.showToast({ title: this.translate('index', 'batchMode.noSelection'), icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: this.translate('index', 'batchMode.confirmFertilizingTitle'),
      content: this.translate('index', 'batchMode.confirmFertilizingContent', { count: this.data.selectedPlants.length }) + '',
      success: (res) => {
        if (res.confirm) {
          this.performBatchFertilizing();
        }
      }
    });
  },
  
  performBatchWatering: function() {
    wx.showLoading({ title: this.translate('index', 'batchMode.processingWatering') });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || this.translate('common', 'unknownPlant'));
        plant.lastWateringDate = today;
        if (!plant.wateringHistory) {
          plant.wateringHistory = [];
        }
        plant.wateringHistory.unshift({
          date: today,
          timestamp: timestamp
        });
      }
      return plant;
    });
    
    // 记录批量操作历史
    this.recordBatchOperation('watering', selectedPlantNames, timestamp);
    
    // 先更新本地存储
    wx.setStorageSync('plantList', updatedList);
    
    // 异步同步到云端（不阻塞本地操作）
    try {
      const backend = require('../../utils/backend_service.js');
      if (backend && backend.savePlantList) {
        setTimeout(() => {
          backend.savePlantList(updatedList).then((success) => {
            if (success) {
              console.log('批量浇水云端同步成功');
            } else {
              console.warn('批量浇水云端同步失败');
            }
          }).catch((err) => {
            console.error('批量浇水云端同步错误:', err);
          });
        }, 100);
      }
    } catch (e) {
      console.error('批量浇水云端同步异常:', e);
    }
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ 
        title: this.translate('index', 'batchMode.successWatering', { count: this.data.selectedPlants.length }), 
        icon: 'success',
        duration: 2000
      });
      this.exitBatchMode();
      this.loadPlantData();
    }, 1000);
  },
  
  performBatchFertilizing: function() {
    wx.showLoading({ title: this.translate('index', 'batchMode.processingFertilizing') });
    
    const plantList = wx.getStorageSync('plantList') || [];
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const selectedPlantNames = [];
    
    const updatedList = plantList.map(plant => {
      if (this.data.selectedPlants.includes(plant.id)) {
        selectedPlantNames.push(plant.aiResult.name || this.translate('common', 'unknownPlant'));
        plant.lastFertilizingDate = today;
        if (!plant.fertilizingHistory) {
          plant.fertilizingHistory = [];
        }
        plant.fertilizingHistory.unshift({
          date: today,
          timestamp: timestamp
        });
      }
      return plant;
    });
    
    // 记录批量操作历史
    this.recordBatchOperation('fertilizing', selectedPlantNames, timestamp);
    
    // 先更新本地存储
    wx.setStorageSync('plantList', updatedList);
    
    // 异步同步到云端（不阻塞本地操作）
    try {
      const backend = require('../../utils/backend_service.js');
      if (backend && backend.savePlantList) {
        setTimeout(() => {
          backend.savePlantList(updatedList).then((success) => {
            if (success) {
              console.log('批量施肥云端同步成功');
            } else {
              console.warn('批量施肥云端同步失败');
            }
          }).catch((err) => {
            console.error('批量施肥云端同步错误:', err);
          });
        }, 100);
      }
    } catch (e) {
      console.error('批量施肥云端同步异常:', e);
    }
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ 
        title: this.translate('index', 'batchMode.successFertilizing', { count: this.data.selectedPlants.length }), 
        icon: 'success',
        duration: 2000
      });
      this.exitBatchMode();
      this.loadPlantData();
    }, 1000);
  },
  
  exitBatchMode: function() {
    this.setData({
      batchMode: false,
      selectedPlants: [],
      showBatchActions: false
    });
    this.updateBatchSelectionText(0);
  },
  
  // V0.3 批量操作历史记录
  recordBatchOperation: function(type, plantNames, timestamp) {
    const batchHistory = wx.getStorageSync('batchOperationHistory') || [];
    const operation = {
      type: type,
      plantNames: plantNames,
      count: plantNames.length,
      timestamp: timestamp,
      date: new Date(timestamp).toISOString().split('T')[0],
      time: new Date(timestamp).toLocaleTimeString(i18n.getLocale(), { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
    
    batchHistory.unshift(operation);
    
    // 限制历史记录数量
    if (batchHistory.length > 50) {
      batchHistory.splice(50);
    }
    
    wx.setStorageSync('batchOperationHistory', batchHistory);
  },
  
  viewBatchHistory: function() {
    const batchHistory = wx.getStorageSync('batchOperationHistory') || [];
    if (batchHistory.length === 0) {
      wx.showToast({
        title: this.translate('index', 'historyToastEmpty'),
        icon: 'none'
      });
      return;
    }
    
    const formattedHistory = batchHistory.map(item => {
      const typeText = item.type === 'watering' 
        ? this.translate('index', 'batchMode.watering') 
        : this.translate('index', 'batchMode.fertilizing');
      const delimiter = this.translate('common', 'listDelimiter');
      const plantList = item.plantNames.join(delimiter);
      return {
        ...item,
        typeText: typeText,
        plantList: plantList,
        plantCountLabel: this.translate('index', 'batchMode.plantCountLabel', { count: item.count })
      };
    });
    
    this.setData({
      showBatchHistoryModal: true,
      batchHistoryData: formattedHistory
    });
  },
  
  closeBatchHistoryModal: function() {
    this.setData({
      showBatchHistoryModal: false,
      batchHistoryData: []
    });
  }
});
