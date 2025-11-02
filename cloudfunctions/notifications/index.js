const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const { action, limit = 20, offset = 0, ids = [], status = 'unread', ownerOpenId = null } = event || {};
  const userOpenId = ownerOpenId || OPENID || '';
  if (!userOpenId && action !== 'debugAdd') return { ok: false, error: 'no_openid' };
  const coll = db.collection('notifications');
  try {
    if (action === 'list') {
      const q = status === 'all'
        ? coll.where({ ownerOpenId: userOpenId })
        : coll.where({ ownerOpenId: userOpenId, read: false });
      const res = await q.orderBy('time', 'desc')
        .skip(Math.max(Number(offset) || 0, 0))
        .limit(Math.min(Number(limit) || 20, 50))
        .get();
      return { ok: true, items: res.data || [] };
    }
    if (action === 'stats') {
      const cnt = await coll.where({ ownerOpenId: userOpenId, read: false }).count();
      return { ok: true, unread: (cnt && typeof cnt.total === 'number') ? cnt.total : 0 };
    }
    if (action === 'debugAdd') {
      // 仅用于开发者工具验证集合写入权限
      try {
        if (!userOpenId) return { ok: false, error: 'no_openid_for_debug' };
        await coll.add({ data: { ownerOpenId: userOpenId, type: 'like', plantId: 0, imageIndex: 0, actorOpenId: userOpenId, actorNickname: '我', time: Date.now(), read: false, content: '测试' } });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'add_failed', message: e && e.message };
      }
    }
    if (action === 'markAllRead') {
      await coll.where({ ownerOpenId: userOpenId, read: false }).update({ data: { read: true } });
      return { ok: true };
    }
    if (action === 'markReadByIds') {
      const _ = db.command;
      const idList = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if (idList.length === 0) return { ok: true };
      await coll.where({ ownerOpenId: userOpenId, _id: _.in(idList) }).update({ data: { read: true } });
      return { ok: true };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: 'db_error', message: e && e.message };
  }
};
