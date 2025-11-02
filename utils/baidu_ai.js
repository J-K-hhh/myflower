const i18n = require('./i18n.js');

function translate(namespace, keyPath, params = {}) {
  try {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
  } catch (e) {}
  return i18n.t(namespace, keyPath, params);
}

function recognizePlant(filePath) {
  // 压缩并限制Base64大小，避免云函数参数及百度接口限额
  const LIMIT_BYTES = 900000; // ~0.9MB payload for safety
  const QUALITIES = [80, 60, 40, 30, 20];
  function readAsBase64(fp) {
    return new Promise((resolve, reject) => {
      try {
        const fsm = wx.getFileSystemManager();
        fsm.readFile({ filePath: fp, encoding: 'base64', success: r => resolve(r.data), fail: reject });
      } catch (e) { reject(e); }
    });
  }
  function compressOnce(fp, quality) {
    return new Promise((resolve, reject) => {
      try {
        wx.compressImage({ src: fp, quality: quality, success: res => resolve(res.tempFilePath), fail: reject });
      } catch (e) { reject(e); }
    });
  }
  async function compressToLimit(fp) {
    // 尝试逐步压缩直到Base64小于限制
    let current = fp;
    let base64 = await readAsBase64(current);
    if (base64 && base64.length * 0.75 < LIMIT_BYTES) return base64;
    for (const q of QUALITIES) {
      current = await compressOnce(current, q);
      base64 = await readAsBase64(current);
      if (base64 && base64.length * 0.75 < LIMIT_BYTES) return base64;
    }
    // 最终仍超限，截断警告：再尝试最后一次强压
    return base64;
  }

  return new Promise((resolve, reject) => {
    // 若传入的是云文件ID，直接让云函数下载并识别，避免上传Base64占用参数体积
    try {
      if (typeof filePath === 'string' && filePath.indexOf('cloud://') === 0) {
        wx.cloud.callFunction({ name: 'baidu-ai-proxy', data: { action: 'recognizeByFileID', fileID: filePath, baike_num: 1 } })
          .then(cfRes => {
            const r = cfRes && cfRes.result;
            if (r && r.ok && Array.isArray(r.result) && r.result.length > 0) {
              const first = r.result[0];
              const plantInfo = { name: first.name, score: first.score, baike: first.baike_info || {}, careTips: extractCareTips(first.baike_info || {}) };
              resolve(plantInfo);
            } else {
              const rawErr = (r && r.error) ? String(r.error) : '';
              if (/exceed|too\s*large|data\s*size/i.test(rawErr)) {
                reject(new Error(translate('models', 'errors.networkFailed', { message: '图片过大，请选择清晰但体积更小的照片（建议小于1MB）' })));
                return;
              }
              reject(new Error(rawErr || translate('models', 'errors.baiduRecognitionFailed')));
            }
          })
          .catch(err => reject(new Error(translate('models', 'errors.networkFailed', { message: err.errMsg || err.message || translate('models', 'errors.unknown') }))));
        return;
      }
    } catch (e) { /* ignore and fallback */ }
    compressToLimit(filePath)
      .then((imageBase64) => {
        // 调用云函数
        wx.cloud.callFunction({ name: 'baidu-ai-proxy', data: { action: 'recognize', imageBase64, baike_num: 1 } })
          .then(cfRes => {
            const r = cfRes && cfRes.result;
            if (r && r.ok && Array.isArray(r.result) && r.result.length > 0) {
              const first = r.result[0];
              const plantInfo = { name: first.name, score: first.score, baike: first.baike_info || {}, careTips: extractCareTips(first.baike_info || {}) };
              resolve(plantInfo);
            } else {
              const rawErr = (r && r.error) ? String(r.error) : '';
              // 友好化“数据过大”提示
              if (/exceed|too\s*large|data\s*size/i.test(rawErr)) {
                reject(new Error(translate('models', 'errors.networkFailed', { message: '图片过大，请选择清晰但体积更小的照片（建议小于1MB）' })));
                return;
              }
              reject(new Error(rawErr || translate('models', 'errors.baiduRecognitionFailed')));
            }
          })
          .catch(err => {
            reject(new Error(translate('models', 'errors.networkFailed', { message: err.errMsg || err.message || translate('models', 'errors.unknown') })));
          });
      })
      .catch((fsErr) => {
        reject(new Error(translate('models', 'errors.imageReadFailed', { message: fsErr.errMsg || translate('models', 'errors.unknown') })));
      });
  });
}

function extractCareTips(baikeInfo) {
  const description = baikeInfo.description || '';
  const careTips = { watering: '', lighting: '', temperature: '', humidity: '', fertilizing: '' };
  if (description.includes('浇水') || description.includes('水分')) {
    careTips.watering = extractWateringInfo(description);
  }
  if (description.includes('光照') || description.includes('阳光') || description.includes('光线')) {
    careTips.lighting = extractLightingInfo(description);
  }
  if (description.includes('温度') || description.includes('温暖') || description.includes('寒冷')) {
    careTips.temperature = extractTemperatureInfo(description);
  }
  if (description.includes('湿度') || description.includes('湿润')) {
    careTips.humidity = extractHumidityInfo(description);
  }
  if (description.includes('施肥') || description.includes('肥料')) {
    careTips.fertilizing = extractFertilizingInfo(description);
  }
  return careTips;
}

function extractWateringInfo(description) {
  const wateringKeywords = ['浇水', '水分', '湿润', '干燥'];
  for (let keyword of wateringKeywords) {
    const index = description.indexOf(keyword);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(description.length, index + 50);
      return description.substring(start, end).trim();
    }
  }
  return translate('models', 'defaults.wateringSoil');
}

function extractLightingInfo(description) {
  const lightingKeywords = ['光照', '阳光', '光线', '明亮', '阴凉'];
  for (let keyword of lightingKeywords) {
    const index = description.indexOf(keyword);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(description.length, index + 50);
      return description.substring(start, end).trim();
    }
  }
  return translate('models', 'defaults.lightingAvoid');
}

function extractTemperatureInfo(description) {
  const tempKeywords = ['温度', '温暖', '寒冷', '适宜'];
  for (let keyword of tempKeywords) {
    const index = description.indexOf(keyword);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(description.length, index + 50);
      return description.substring(start, end).trim();
    }
  }
  return translate('models', 'defaults.temperatureRange');
}

function extractHumidityInfo(description) {
  const humidityKeywords = ['湿度', '湿润', '干燥'];
  for (let keyword of humidityKeywords) {
    const index = description.indexOf(keyword);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(description.length, index + 50);
      return description.substring(start, end).trim();
    }
  }
  return translate('models', 'defaults.humidity');
}

function extractFertilizingInfo(description) {
  const fertilizingKeywords = ['施肥', '肥料', '营养'];
  for (let keyword of fertilizingKeywords) {
    const index = description.indexOf(keyword);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(description.length, index + 50);
      return description.substring(start, end).trim();
    }
  }
  return translate('models', 'defaults.fertilizing');
}

function testApiConnection() {
  return new Promise((resolve, reject) => {
    // Cloud-side token test
    try {
      wx.cloud.callFunction({ name: 'baidu-ai-proxy', data: { action: 'token' } })
        .then(r => {
          if (r && r.result && r.result.ok) resolve(true);
          else reject(new Error('token_failed'));
        })
        .catch(err => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  recognizePlant: recognizePlant,
  testApiConnection: testApiConnection
};
