// Local helpers for Share Landing & Friends section (M1, no backend)

function safeGet(key, fallback) {
  try { return wx.getStorageSync(key) || fallback; } catch (e) { return fallback; }
}
function safeSet(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) {}
}

function shareKey(ownerOpenId, plantId) {
  return `${ownerOpenId || ''}#${plantId || ''}`;
}

// Owner nickname mapping
function getOwnerNick(ownerOpenId) {
  const map = safeGet('shareOwnerNickMap', {});
  return (map && map[ownerOpenId]) || '';
}
function setOwnerNick(ownerOpenId, nickname) {
  const map = safeGet('shareOwnerNickMap', {});
  map[ownerOpenId] = nickname || '';
  safeSet('shareOwnerNickMap', map);
}

// Comments
function getComments(key) {
  const map = safeGet('shareComments', {});
  const list = map[key] || [];
  return Array.isArray(list) ? list : [];
}
function addComment(key, { nickname = '游客', content, imagePath = null }) {
  const map = safeGet('shareComments', {});
  const rec = { id: Date.now(), nickname, content, time: Date.now(), imagePath: imagePath || null };
  const list = map[key] || [];
  map[key] = [rec, ...list].slice(0, 100);
  safeSet('shareComments', map);
  return rec;
}

// Filtered comments for a specific image
function getCommentsByImage(key, imagePath) {
  const all = getComments(key);
  if (!imagePath) return [];
  return all.filter(c => (c && c.imagePath) ? c.imagePath === imagePath : false);
}

// Likes
function getLikes(key) {
  const map = safeGet('shareLikes', {});
  const n = map[key] || 0;
  return Number(n) || 0;
}
function addLike(key) {
  const map = safeGet('shareLikes', {});
  const next = (Number(map[key] || 0) || 0) + 1;
  map[key] = next;
  safeSet('shareLikes', map);
  return next;
}

// Likes per image
function getLikesByImage(key, imagePath) {
  const map = safeGet('shareLikesByImage', {});
  const group = map[key] || {};
  return Number(group[imagePath] || 0) || 0;
}
function addLikeByImage(key, imagePath) {
  const map = safeGet('shareLikesByImage', {});
  const group = map[key] || {};
  const next = (Number(group[imagePath] || 0) || 0) + 1;
  group[imagePath] = next;
  map[key] = group;
  safeSet('shareLikesByImage', map);
  return next;
}

// Follow list shown on index page (friends section)
function getFollowList() {
  return safeGet('friendFollows', []);
}
function getFollow(key) {
  const list = getFollowList();
  return list.find(i => i.key === key) || null;
}
function follow(card) {
  const list = getFollowList();
  const exists = list.find(i => i.key === card.key);
  if (exists) return exists;
  const next = [card, ...list].slice(0, 50);
  safeSet('friendFollows', next);
  return card;
}
function unfollow(key) {
  const list = getFollowList();
  const next = list.filter(i => i.key !== key);
  safeSet('friendFollows', next);
}
function setNotify(key, on) {
  const list = getFollowList().map(i => i.key === key ? { ...i, notifyOnUpdate: !!on } : i);
  safeSet('friendFollows', list);
}

// Helpers for building UI texts
function timeAgo(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function getLatestStatus(plant) {
  if (!plant) return '';
  const w = plant.lastWateringDate || '';
  const f = plant.lastFertilizingDate || '';
  if (w) return `${w} 浇水`;
  if (f) return `${f} 施肥`;
  const ha = Array.isArray(plant.healthAnalyses) ? plant.healthAnalyses[0] : null;
  if (ha && ha.timestamp) return `${new Date(ha.timestamp).toLocaleDateString()} 体检`;
  if (plant.createTime) return `${new Date(plant.createTime).toLocaleDateString()} 创建`;
  return '';
}

function getLatestMemo(plant) {
  const infos = Array.isArray(plant && plant.imageInfos) ? plant.imageInfos : [];
  const withMemo = infos.filter(i => i && i.memo && String(i.memo).trim() !== '');
  if (withMemo.length === 0) return '';
  const latest = withMemo.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  return latest.memo || '';
}

function getHistoryStrip(plant) {
  const list = [];
  const add = (t, text) => { if (t) list.push({ time: t, text }); };
  if (!plant) return list;
  if (Array.isArray(plant.wateringHistory)) {
    plant.wateringHistory.forEach(i => add(i.timestamp || 0, `${i.date || ''} 浇水`));
  }
  if (Array.isArray(plant.fertilizingHistory)) {
    plant.fertilizingHistory.forEach(i => add(i.timestamp || 0, `${i.date || ''} 施肥`));
  }
  return list.sort((a, b) => (b.time || 0) - (a.time || 0));
}

function toFollowCard(ownerOpenId, plantId, plant) {
  // 优先使用plant.ownerNickname（来自云函数的真实昵称）
  const ownerNickname = (plant && plant.ownerNickname && plant.ownerNickname !== '朋友') ? plant.ownerNickname : '';
  return {
    key: shareKey(ownerOpenId, plantId),
    ownerOpenId,
    plantId,
    name: (plant && plant.aiResult && plant.aiResult.name) || '植物',
    ownerNickname,
    thumb: (Array.isArray(plant && plant.images) && plant.images[0]) || '',
    lastStatus: getLatestStatus(plant),
    followedAt: Date.now(),
    notifyOnUpdate: false
  };
}

module.exports = {
  shareKey,
  getComments,
  addComment,
  getCommentsByImage,
  getLikes,
  addLike,
  getLikesByImage,
  addLikeByImage,
  follow,
  unfollow,
  getFollowList,
  getFollow,
  toFollowCard,
  setNotify,
  getOwnerNick,
  setOwnerNick,
  timeAgo,
  getLatestStatus,
  getLatestMemo,
  getHistoryStrip
};
