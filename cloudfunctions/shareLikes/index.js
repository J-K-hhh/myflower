const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { action, ownerOpenId, plantId, imagePath, likerOpenId, nickname, limit = 200, imageIndex = null } = event || {};
  if (!ownerOpenId || !plantId) return { ok: false, error: 'missing_params' };
  const key = `${ownerOpenId}#${plantId}`;
  const coll = db.collection('share_likes');
  const notifications = db.collection('notifications');
  // 统一的图片标识：优先使用索引，其次回落到路径
  const idx = (imageIndex === 0 || imageIndex) ? Number(imageIndex) : null;
  const hasIndex = (typeof idx === 'number' && !Number.isNaN(idx) && idx >= 0);
  const imageKey = hasIndex ? `idx#${idx}` : (imagePath ? `path#${imagePath}` : null);
  if (!imageKey) return { ok: false, error: 'missing_image_key' };
  try {
    if (action === 'add') {
      if (!likerOpenId) return { ok: false, error: 'missing_liker' };
      const existing = await coll.where({ key, imageKey, likerOpenId }).limit(1).get();
      if (!existing.data || existing.data.length === 0) {
        const rec = { key, ownerOpenId, plantId, imagePath: imagePath || null, imageIndex: hasIndex ? idx : null, imageKey, likerOpenId, nickname: nickname || '', time: Date.now() };
        await coll.add({ data: rec });
        // 同步写入一条通知给拥有者（避免自赞产生通知）
        let notifOk = false;
        try {
          if (ownerOpenId && likerOpenId && ownerOpenId !== likerOpenId) {
            await notifications.add({
              data: {
                ownerOpenId,
                type: 'like',
                plantId,
                imagePath: imagePath || null,
                imageIndex: hasIndex ? idx : null,
                actorOpenId: likerOpenId,
                actorNickname: nickname || '',
                time: Date.now(),
                read: false
              }
            });
            notifOk = true;
          }
        } catch (e) {
          // ignore notification failure to not block like
        }
      }
      // 统计数量使用 count() 防止默认20条限制
      const cntRes = await coll.where({ key, imageKey }).count();
      const count = (cntRes && typeof cntRes.total === 'number') ? cntRes.total : ((await coll.where({ key, imageKey }).get()).data || []).length;
      return { ok: true, count };
    }
    if (action === 'list') {
      const res = await coll.where({ key, imageKey }).orderBy('time', 'desc').limit(Math.min(Number(limit) || 200, 500)).get();
      const items = res.data || [];
      return { ok: true, items, count: items.length };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: 'db_error', message: e && e.message };
  }
};
