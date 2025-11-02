const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const ctx = cloud.getWXContext();
  const { ownerOpenId, plantId, shareNickname } = event || {};
  if (!plantId) {
    return { ok: false, error: 'missing_params', debug: { ctxENV: ctx.ENV, ctxAPPID: ctx.APPID } };
  }
  try {
    const coll = db.collection('plant_lists');
    let list = [];
    let method = 'doc';
    let ownerIdToUse = ownerOpenId || '';
    // 1) 确定owner：若未提供ownerOpenId，则尝试通过plantId反查
    if (!ownerIdToUse) {
      method = 'reverseLookup';
      const _ = db.command;
      let found = null;
      try {
        // 优先按数字匹配
        const pidNum = Number(plantId);
        if (!Number.isNaN(pidNum)) {
          const r1 = await coll.where({ list: _.elemMatch({ id: pidNum }) }).limit(1).get();
          found = (r1 && r1.data && r1.data[0]) || null;
        }
        if (!found) {
          const pidStr = String(plantId);
          const r2 = await coll.where({ list: _.elemMatch({ id: pidStr }) }).limit(1).get();
          found = (r2 && r2.data && r2.data[0]) || null;
        }
      } catch (e) {
        // ignore
      }
      if (found) {
        ownerIdToUse = (found.ownerOpenId) || (found._id) || '';
        list = Array.isArray(found.list) ? found.list : [];
      } else {
        return { ok: false, error: 'not_found', debug: { method, ownerOpenId, plantId, ctxENV: ctx.ENV, ctxAPPID: ctx.APPID } };
      }
    }
    // 2) 读取该owner的列表
    if (!list || list.length === 0) {
      try {
        const doc = await coll.doc(ownerIdToUse).get();
        list = (doc && doc.data && Array.isArray(doc.data.list)) ? doc.data.list : [];
        method = (method === 'reverseLookup') ? method : 'doc';
      } catch (e) {
        method = 'where';
        const res = await coll.where({ ownerOpenId: ownerIdToUse }).limit(1).get();
        const row = (res && res.data && res.data[0]) || null;
        list = (row && Array.isArray(row.list)) ? row.list : [];
      }
    }
    // 2) 容错匹配 id（字符串/数字）
    const pidStr = String(plantId);
    const plant = list.find(p => String(p && p.id) === pidStr) || null;
    if (!plant) {
      return { ok: false, error: 'not_found', debug: { method, listSize: list.length, sampleIds: (list || []).slice(0,5).map(i=>i && i.id), ownerOpenId: ownerIdToUse, plantId, ctxENV: ctx.ENV, ctxAPPID: ctx.APPID } };
    }
    
    // 3) 获取用户真实昵称
    let ownerNickname = '朋友'; // 默认昵称
    
    // 优先使用分享时传递的昵称
    if (shareNickname && shareNickname.trim() !== '') {
      ownerNickname = shareNickname.trim();
    } else {
      // 尝试从用户资料集合获取
      try {
        const userProfileDoc = await db.collection('user_profiles').doc(ownerIdToUse).get();
        if (userProfileDoc.data && userProfileDoc.data.nickname) {
          ownerNickname = userProfileDoc.data.nickname;
        }
      } catch (e) {
        console.warn('Failed to get user profile:', e);
        // 使用默认昵称
      }
    }
    
    // Sanitize: only return fields needed for display
    const safe = {
      id: plant.id || null,
      aiResult: plant.aiResult || {},
      images: Array.isArray(plant.images) ? plant.images : [],
      imageInfos: Array.isArray(plant.imageInfos) ? plant.imageInfos : [],
      createTime: plant.createTime || null,
      wateringHistory: Array.isArray(plant.wateringHistory) ? plant.wateringHistory : [],
      fertilizingHistory: Array.isArray(plant.fertilizingHistory) ? plant.fertilizingHistory : [],
      healthAnalyses: Array.isArray(plant.healthAnalyses) ? plant.healthAnalyses : [],
      lastWateringDate: plant.lastWateringDate || '',
      lastFertilizingDate: plant.lastFertilizingDate || '',
      ownerNickname: ownerNickname
    };
    // Resolve cloud fileIDs to temp URLs server-side (best-effort)
    try {
      const ids = (safe.images || []).filter(p => typeof p === 'string' && p.indexOf('cloud://') === 0);
      const infoIds = (safe.imageInfos || []).map(i => i && i.path).filter(p => typeof p === 'string' && p && p.indexOf('cloud://') === 0);
      const fileList = Array.from(new Set([ ...ids, ...infoIds ]));
      if (fileList.length > 0) {
        const r = await cloud.getTempFileURL({ fileList });
        const map = {};
        (r && r.fileList || []).forEach(i => { if (i && i.fileID && i.tempFileURL) map[i.fileID] = i.tempFileURL; });
        if (Array.isArray(safe.images)) {
          safe.images = safe.images.map(pth => (typeof pth === 'string' && map[pth]) ? map[pth] : pth);
        }
        if (Array.isArray(safe.imageInfos)) {
          safe.imageInfos = safe.imageInfos.map(info => {
            if (info && typeof info.path === 'string' && map[info.path]) {
              return { ...info, path: map[info.path] };
            }
            return info;
          });
        }
      }
    } catch (e) {
      // ignore
    }
    return { ok: true, plant: safe, debug: { method, listSize: list.length, ownerOpenId: ownerIdToUse, plantId, ctxENV: ctx.ENV, ctxAPPID: ctx.APPID } };
  } catch (e) {
    return { ok: false, error: 'db_error', debug: { ownerOpenId, plantId, ctxENV: ctx.ENV, ctxAPPID: ctx.APPID, message: e && e.message } };
  }
};
