const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { action, ownerOpenId, plantId, imagePath, imageIndex = null, nickname, content, limit = 50, commenterOpenId = null } = event || {};
  if (!ownerOpenId || !plantId) return { ok: false, error: 'missing_params' };
  const key = `${ownerOpenId}#${plantId}`;
  const coll = db.collection('share_comments');
  const notifications = db.collection('notifications');
  // 统一图片键：优先使用索引
  const idx = (imageIndex === 0 || imageIndex) ? Number(imageIndex) : null;
  const hasIndex = (typeof idx === 'number' && !Number.isNaN(idx) && idx >= 0);
  const imageKey = hasIndex ? `idx#${idx}` : (imagePath ? `path#${imagePath}` : null);
  try {
    if (action === 'add') {
      if (!content || !imageKey) return { ok: false, error: 'missing_content_or_image' };
      let nick = nickname || '';
      // 若未提供昵称，尝试从用户资料集合获取
      try {
        if ((!nick || nick === '游客') && commenterOpenId) {
          const user = await db.collection('user_profiles').doc(commenterOpenId).get();
          if (user && user.data && user.data.nickname) {
            nick = user.data.nickname;
          }
        }
      } catch (e) { /* ignore */ }
      const rec = {
        key,
        ownerOpenId,
        plantId,
        imagePath: imagePath || null,
        imageIndex: hasIndex ? idx : null,
        imageKey,
        nickname: nick || '朋友',
        commenterOpenId: commenterOpenId || null,
        content: String(content || '').slice(0, 500),
        time: Date.now()
      };
      await coll.add({ data: rec });
      // 写入一条评论通知给拥有者（避免自己评论自己产生冗余）
      let notifOk = false;
      try {
        if (ownerOpenId && commenterOpenId && ownerOpenId !== commenterOpenId) {
          await notifications.add({
            data: {
              ownerOpenId,
              type: 'comment',
              plantId,
              imagePath: imagePath || null,
              imageIndex: hasIndex ? idx : null,
              actorOpenId: commenterOpenId,
              actorNickname: nick || '朋友',
              time: Date.now(),
              read: false,
              content: String(content || '').slice(0, 120)
            }
          });
          notifOk = true;
        }
      } catch (e) { /* ignore */ }
      return { ok: true, item: rec, notified: notifOk };
    }
    if (action === 'list') {
      const q = coll.where({ key, imageKey }).orderBy('time', 'desc').limit(Math.min(Number(limit) || 50, 100));
      const res = await q.get();
      return { ok: true, items: res.data || [] };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: 'db_error', message: e && e.message };
  }
};
