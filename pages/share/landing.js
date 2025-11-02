const backend = require('../../utils/backend_service.js');
const i18n = require('../../utils/i18n.js');
const shareUtils = require('../../utils/share_utils.js');

Page({
  data: {
    owner: '',
    pid: '',
    plant: {},
    galleryImages: [],
    ownerName: '',
    currentIndex: 0,
    currentMemo: '',
    latestStatusText: '',
    memoSummary: '',
    historyItems: [],
    createdAtText: '',
    allowComment: true,
    comments: [],
    commentDraft: '',
    likeCount: 0,
    isFollowed: false,
    notifyOnUpdate: false,
    i18n: {
      follow: {
        followToHome: '关注到我的首页',
        followed: '已关注',
        notifyOn: '有更新时提醒我',
        notifyOff: '开启更新提醒'
      },
      memo: { title: '备忘摘要' },
      comment: { placeholder: '我来留言…', send: '发送' },
      enterDetail: '进入完整详情',
    },
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage(),
    currentHeight: 420,
    galleryHeights: []
  },
  onLoad(options) {
    const { owner, pid, share_id, nick } = options || {};
    if (owner && pid) {
      if (nick) {
        try { shareUtils.setOwnerNick(owner, nick); } catch (e) {}
      }
      this.setData({ owner, pid, ownerName: nick || '' });
      this.loadShare();
    } else if (share_id) {
      wx.showToast({ title: '暂未接入share_id', icon: 'none' });
    } else {
      wx.showToast({ title: '参数缺失', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    // 确保加载访问者用户资料（用于点赞/评论昵称）
    try {
      const app = getApp();
      const backend = require('../../utils/backend_service.js');
      if (!app.globalData.userProfile && backend && backend.getUserProfile) {
        backend.getUserProfile().then(profile => {
          if (profile && typeof app.updateUserProfile === 'function') {
            app.updateUserProfile(profile);
          }
        }).catch(() => {});
      }
    } catch (e) {}
  },
  translate(ns, key, params = {}) {
    const app = getApp();
    if (app && app.t) return app.t(ns, key, params);
    return i18n.t(ns, key, params, this.data.language);
  },
  loadShare() {
    const { owner, pid, ownerName } = this.data;
    wx.showLoading({ title: '加载中' });
    backend.loadSharedPlantByOwner(owner, pid, ownerName).then(res => {
      wx.hideLoading();
      const plant = res && res.plant ? res.plant : res;
      if (!plant) {
        wx.showToast({ title: '未找到分享内容', icon: 'none' });
        return;
      }
      // 展示用图集
      const images = Array.isArray(plant.images) ? plant.images : [];
      const infoPaths = Array.isArray(plant.imageInfos) ? plant.imageInfos.map(i => i && i.path).filter(Boolean) : [];
      const gallery = images.length > 0 ? images : infoPaths;
      // 最新状态
      const latest = shareUtils.getLatestStatus(plant);
      // 备忘摘要（来自 imageInfos.memo 中最新的一条）
      const memo = shareUtils.getLatestMemo(plant);
      // 历史条
      const history = shareUtils.getHistoryStrip(plant).slice(0, 12);
      const createdAtText = plant.createTime ? new Date(plant.createTime).toLocaleDateString() : '';
      const allowComment = true; // M1 默认允许
      // 优先使用从URL参数获取的昵称，然后是云函数返回的昵称
      const urlNickname = this.data.ownerName; // 从URL参数获取的昵称
      const cloudNickname = (plant.ownerNickname && plant.ownerNickname !== '朋友') ? plant.ownerNickname : '';
      const ownerName = urlNickname || cloudNickname || '';
      this.setData({
        plant,
        galleryImages: gallery,
        ownerName,
        latestStatusText: latest,
        memoSummary: memo,
        historyItems: history,
        createdAtText,
        allowComment
      });
      try { wx.setNavigationBarTitle({ title: `${ownerName || '微信好友'}的分享` }); } catch (e) {}
      // 初始化当前图对应的备忘与评论
      this.updateCurrentContext(0);
      const key = shareUtils.shareKey(owner, pid);
      const firstPath = (gallery && gallery[0]) || '';
      backend.listShareLikes(owner, pid, firstPath, 200, 0).then(r => {
        if (r && typeof r.count === 'number') this.setData({ likeCount: r.count });
      });
      const followInfo = shareUtils.getFollow(key);
      // 优先从云端读取评论（按图片索引）
      backend.listShareComments(owner, pid, firstPath, 50, 0).then(items => {
        const list = (items || []).map(c => ({ ...c, timeText: shareUtils.timeAgo(c.time) }));
        const localFallback = shareUtils.getCommentsByImage(key, firstPath).map(c => ({ ...c, timeText: shareUtils.timeAgo(c.time) }));
        const comments = list.length > 0 ? list : localFallback;
        const commentsToShow = comments.slice(0, 3);
        this.setData({ comments, commentsToShow });
      });
      this.setData({
        isFollowed: !!(followInfo && followInfo.key),
        notifyOnUpdate: !!(followInfo && followInfo.notifyOnUpdate)
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },
  like() {
    const owner = this.data.owner;
    const pid = this.data.pid;
    const img = (this.data.galleryImages || [])[this.data.currentIndex] || '';
    const app = getApp();
    const likerOpenId = (app && app.openid) ? app.openid : '';
    let nickname = (app && app.globalData && app.globalData.userProfile && app.globalData.userProfile.nickname) || '';
    // 本地加1（即时反馈）
    const key = shareUtils.shareKey(owner, pid);
    const localCount = shareUtils.addLikeByImage(key, img);
    this.setData({ likeCount: localCount });
    // 云端持久化并同步实际总数
    const ensureOpenId = new Promise((resolve) => {
      if (likerOpenId) { resolve(likerOpenId); return; }
      try {
        wx.cloud.callFunction({ name: 'login' }).then(r => resolve((r && r.result && r.result.openid) || '')).catch(() => resolve(''));
      } catch (e) { resolve(''); }
    });
    ensureOpenId.then(oid => {
      if (!oid) return; // 无法存储点赞人
      backend.saveShareLike(owner, pid, img, oid, nickname, this.data.currentIndex).then(() => {
        backend.listShareLikes(owner, pid, img, 200, this.data.currentIndex).then(r => {
          if (r && typeof r.count === 'number') this.setData({ likeCount: r.count });
        });
      });
    });
  },
  onGalleryChange(e) {
    const idx = (e && e.detail && typeof e.detail.current === 'number') ? e.detail.current : 0;
    this.updateCurrentContext(idx);
    const key = shareUtils.shareKey(this.data.owner, this.data.pid);
    const img = (this.data.galleryImages || [])[idx] || '';
    // 云端评论优先，失败则本地
    backend.listShareComments(this.data.owner, this.data.pid, img, 50, idx).then(items => {
      const list = (items || []).map(c => ({ ...c, timeText: shareUtils.timeAgo(c.time) }));
      const localFallback = shareUtils.getCommentsByImage(key, img).map(c => ({ ...c, timeText: shareUtils.timeAgo(c.time) }));
      const comments = list.length > 0 ? list : localFallback;
      const commentsToShow = comments.slice(0, 3);
      this.setData({ comments, commentsToShow });
    });
    const h = (this.data.galleryHeights || [])[idx] || this.data.currentHeight || 420;
    backend.listShareLikes(this.data.owner, this.data.pid, img, 200, idx).then(r => {
      if (r && typeof r.count === 'number') this.setData({ likeCount: r.count });
    });
    this.setData({ currentIndex: idx, currentHeight: h });
  },
  updateCurrentContext(idx) {
    const images = this.data.galleryImages || [];
    const imagePath = images[idx] || '';
    const infos = Array.isArray(this.data.plant.imageInfos) ? this.data.plant.imageInfos : [];
    let memo = '';
    // 直接路径匹配
    const hit = infos.find(i => i && i.path === imagePath);
    if (hit && hit.memo) memo = hit.memo;
    // 按索引对齐（当gallery等于images时）
    if (!memo && Array.isArray(this.data.plant.images) && this.data.plant.images.length === images.length) {
      const infoAt = infos[idx];
      if (infoAt && infoAt.memo) memo = infoAt.memo;
    }
    // 预先计算顶部展示的评论子集
    try {
      const key = shareUtils.shareKey(this.data.owner, this.data.pid);
      const comments = shareUtils.getCommentsByImage(key, imagePath).map(c => ({ ...c, timeText: shareUtils.timeAgo(c.time) }));
      const commentsToShow = comments.slice(0, 3);
      this.setData({ currentIndex: idx, currentMemo: memo, comments, commentsToShow });
    } catch (e) {
      this.setData({ currentIndex: idx, currentMemo: memo });
    }
  },
  onCommentInput(e) {
    this.setData({ commentDraft: e.detail.value });
  },
  onImageLoad(e) {
    try {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const w = Number(e.detail && e.detail.width) || 0;
      const h = Number(e.detail && e.detail.height) || 0;
      if (!w || !h) return;
      const sys = wx.getSystemInfoSync();
      const screenW = sys && sys.windowWidth ? sys.windowWidth : 375;
      const ratio = h / w;
      // Compute height based on orientation; clamp between 0.7x ~ 1.5x of screen width
      let height = screenW * ratio;
      const minH = screenW * 0.7;
      const maxH = screenW * 1.5;
      if (height < minH) height = minH;
      if (height > maxH) height = maxH;
      const arr = (this.data.galleryHeights || []).slice();
      arr[idx] = height;
      const next = { galleryHeights: arr };
      if (idx === this.data.currentIndex) next.currentHeight = height;
      this.setData(next);
    } catch (err) {}
  },
  submitComment() {
    const content = (this.data.commentDraft || '').trim();
    if (!content) return;
    // 轻登录提示：M1 仅本地
    const key = shareUtils.shareKey(this.data.owner, this.data.pid);
    const app = getApp();
    let nickname = (app && app.globalData && app.globalData.userProfile && app.globalData.userProfile.nickname) || '';
    const imagePath = (this.data.galleryImages || [])[this.data.currentIndex] || '';
    const record = shareUtils.addComment(key, { nickname, content, imagePath });
    const item = { ...record, timeText: shareUtils.timeAgo(record.time) };
    this.setData({ comments: [item, ...this.data.comments], commentDraft: '' });
    // 云端保存（尽力）
    const ensureOpenId = new Promise((resolve) => {
      if (app && app.openid) { resolve(app.openid); return; }
      try { wx.cloud.callFunction({ name: 'login' }).then(r => resolve((r && r.result && r.result.openid) || '')).catch(() => resolve('')); } catch (e) { resolve(''); }
    });
    ensureOpenId.then((commenterOpenId) => {
      const nickToUse = nickname || '朋友';
      backend.saveShareComment(this.data.owner, this.data.pid, imagePath, nickToUse, content, this.data.currentIndex, commenterOpenId);
    });
  },
  toggleFollow() {
    const key = shareUtils.shareKey(this.data.owner, this.data.pid);
    if (this.data.isFollowed) {
      shareUtils.unfollow(key);
      this.setData({ isFollowed: false });
      wx.showToast({ title: '已取消关注', icon: 'none' });
      return;
    }
    const card = shareUtils.toFollowCard(this.data.owner, this.data.pid, this.data.plant);
    shareUtils.follow(card);
    this.setData({ isFollowed: true });
    wx.showToast({ title: '已关注到首页', icon: 'success' });
    try { wx.setStorageSync('shouldRefreshFriendShares', true); } catch (e) {}
  },
  toggleNotify() {
    const key = shareUtils.shareKey(this.data.owner, this.data.pid);
    const next = !this.data.notifyOnUpdate;
    shareUtils.setNotify(key, next);
    this.setData({ notifyOnUpdate: next });
  },
  goToDetail() {
    const { owner, pid } = this.data;
    // 保持共享只读视图：携带 owner+pid 参数
    wx.navigateTo({ url: `/pages/detail/detail?owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(pid)}` });
  },
  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
  onShareAppMessage() {
    const { owner, pid, plant, ownerName } = this.data;
    const title = `${ownerName || plant.ownerNickname || '微信好友'}的${plant.aiResult?.name || '植物'}`;
    const nickParam = this.data.ownerName || plant.ownerNickname || '';
    return {
      title,
      path: `/pages/share/landing?owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(pid)}&from=wxcard&scene=forward&nick=${encodeURIComponent(nickParam)}`,
      imageUrl: (this.data.galleryImages && this.data.galleryImages[0]) || ''
    };
  },
  onShareTimeline() {
    const { owner, pid, plant, ownerName } = this.data;
    const title = `${ownerName || plant.ownerNickname || '微信好友'}的${plant.aiResult?.name || '植物'}`;
    return {
      title,
      query: `owner=${encodeURIComponent(owner)}&pid=${encodeURIComponent(pid)}`,
      imageUrl: (this.data.galleryImages && this.data.galleryImages[0]) || ''
    };
  }
});
