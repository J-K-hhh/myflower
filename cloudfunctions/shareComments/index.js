const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { action, ownerOpenId, plantId, imagePath, nickname, content, limit = 50 } = event || {};
  if (!ownerOpenId || !plantId) return { ok: false, error: 'missing_params' };
  const key = `${ownerOpenId}#${plantId}`;
  const coll = db.collection('share_comments');
  try {
    if (action === 'add') {
      if (!content || !imagePath) return { ok: false, error: 'missing_content_or_image' };
      const rec = {
        key,
        ownerOpenId,
        plantId,
        imagePath,
        nickname: nickname || '游客',
        content: String(content || '').slice(0, 500),
        time: Date.now()
      };
      await coll.add({ data: rec });
      return { ok: true, item: rec };
    }
    if (action === 'list') {
      const q = coll.where({ key, imagePath }).orderBy('time', 'desc').limit(Math.min(Number(limit) || 50, 100));
      const res = await q.get();
      return { ok: true, items: res.data || [] };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: 'db_error', message: e && e.message };
  }
};

