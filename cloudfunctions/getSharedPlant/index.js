const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const { ownerOpenId, plantId } = event || {};
  console.log('[getSharedPlant] params', { ownerOpenId, plantId });
  if (!ownerOpenId || !plantId) {
    return { ok: false, error: 'missing_params' };
  }
  try {
    const coll = db.collection('plant_lists');
    let list = [];
    let method = 'doc';
    // 1) 优先按 docId 读取
    try {
      const doc = await coll.doc(ownerOpenId).get();
      list = (doc && doc.data && Array.isArray(doc.data.list)) ? doc.data.list : [];
      console.log('[getSharedPlant] doc-read list size:', list.length);
    } catch (e) {
      console.log('[getSharedPlant] doc-read failed, try where');
      method = 'where';
      const res = await coll.where({ ownerOpenId }).limit(1).get();
      const row = (res && res.data && res.data[0]) || null;
      list = (row && Array.isArray(row.list)) ? row.list : [];
      console.log('[getSharedPlant] where-read list size:', list.length);
    }
    // 2) 容错匹配 id（字符串/数字）
    const pidStr = String(plantId);
    const plant = list.find(p => String(p && p.id) === pidStr) || null;
    if (!plant) {
      return { ok: false, error: 'not_found', debug: { method, listSize: list.length, sampleIds: (list || []).slice(0,5).map(i=>i && i.id), ownerOpenId, plantId } };
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
      lastFertilizingDate: plant.lastFertilizingDate || ''
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
    console.log('[getSharedPlant] found plant id:', safe.id);
    return { ok: true, plant: safe, debug: { method, listSize: list.length, ownerOpenId, plantId } };
  } catch (e) {
    return { ok: false, error: 'db_error', debug: { ownerOpenId, plantId } };
  }
};


