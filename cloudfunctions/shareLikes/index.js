const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { action, ownerOpenId, plantId, imagePath, likerOpenId, nickname, limit = 200 } = event || {};
  if (!ownerOpenId || !plantId || !imagePath) return { ok: false, error: 'missing_params' };
  const key = `${ownerOpenId}#${plantId}`;
  const coll = db.collection('share_likes');
  try {
    if (action === 'add') {
      if (!likerOpenId) return { ok: false, error: 'missing_liker' };
      const existing = await coll.where({ key, imagePath, likerOpenId }).limit(1).get();
      if (!existing.data || existing.data.length === 0) {
        const rec = { key, ownerOpenId, plantId, imagePath, likerOpenId, nickname: nickname || '', time: Date.now() };
        await coll.add({ data: rec });
      }
      const res = await coll.where({ key, imagePath }).get();
      return { ok: true, count: (res.data || []).length };
    }
    if (action === 'list') {
      const res = await coll.where({ key, imagePath }).orderBy('time', 'desc').limit(Math.min(Number(limit) || 200, 500)).get();
      const items = res.data || [];
      return { ok: true, items, count: items.length };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: 'db_error', message: e && e.message };
  }
};

