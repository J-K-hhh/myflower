let API_KEY = '';
let SECRET_KEY = '';
const i18n = require('./i18n.js');
const systemConfig = require('./system_config.js');

function translate(namespace, keyPath, params = {}) {
  try {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
  } catch (e) {}
  return i18n.t(namespace, keyPath, params);
}

function getConfig() {
  try {
    const ai = systemConfig.getAi();
    const cfg = ai && ai.models && ai.models['baidu'];
    if (cfg) {
      API_KEY = cfg.apiKey || API_KEY;
      SECRET_KEY = cfg.secretKey || SECRET_KEY;
    }
  } catch (e) {}
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    getConfig();
    // no reliable global cache here across sessions; rely on short-lived calls
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`;
    wx.request({
      url: tokenUrl,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.access_token) {
          app.globalData.baiduAi.accessToken = res.data.access_token;
          resolve(res.data.access_token);
        } else {
          const unknown = translate('models', 'errors.unknown');
          const errorMsg = res.data ? (res.data.error_description || res.data.error || unknown) : translate('models', 'errors.responseEmpty');
          reject(new Error(translate('models', 'errors.accessTokenFailed', { message: errorMsg })));
        }
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('域名不在白名单')) {
          reject(new Error(translate('models', 'errors.whitelistRequired')));
        } else {
          reject(new Error(translate('models', 'errors.networkFailed', { message: err.errMsg || translate('models', 'errors.unknown') })));
        }
      }
    });
  });
}

function recognizePlant(filePath) {
  return new Promise((resolve, reject) => {
    getAccessToken().then(accessToken => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          const imageBase64 = res.data;
          const plantUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/plant?access_token=${accessToken}`;
          wx.request({
            url: plantUrl,
            method: 'POST',
            header: { 'content-type': 'application/x-www-form-urlencoded' },
            data: { image: imageBase64, baike_num: 1 },
            success: (apiRes) => {
              if (apiRes.statusCode === 200) {
                if (apiRes.data && apiRes.data.result && apiRes.data.result.length > 0) {
                  const result = apiRes.data.result[0];
                  const plantInfo = {
                    name: result.name,
                    score: result.score,
                    baike: result.baike_info || {},
                    careTips: extractCareTips(result.baike_info || {})
                  };
                  resolve(plantInfo);
                } else {
                  reject(new Error(translate('models', 'errors.baiduRecognitionFailed')));
                }
              } else {
                const unknown = translate('models', 'errors.unknown');
                const errorMsg = apiRes.data ? (apiRes.data.error_msg || apiRes.data.error || unknown) : translate('models', 'errors.responseEmpty');
                reject(new Error(`${translate('models', 'errors.baiduRecognitionFailed')} (${errorMsg})`));
              }
            },
            fail: (apiErr) => {
              if (apiErr.errMsg && apiErr.errMsg.includes('域名不在白名单')) {
                reject(new Error(translate('models', 'errors.whitelistRequired')));
              } else {
                reject(new Error(translate('models', 'errors.networkFailed', { message: apiErr.errMsg || translate('models', 'errors.unknown') })));
              }
            }
          });
        },
        fail: (fsErr) => {
          reject(new Error(translate('models', 'errors.imageReadFailed', { message: fsErr.errMsg || translate('models', 'errors.unknown') })));
        }
      });
    }).catch(tokenErr => {
      reject(tokenErr);
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
    getConfig();
    if (!API_KEY || !SECRET_KEY) {
      reject(new Error(translate('models', 'errors.apiKeyMisconfigured')));
      return;
    }
    getAccessToken()
      .then(token => {
        resolve(true);
      })
      .catch(err => {
        reject(err);
      });
  });
}

module.exports = {
  recognizePlant: recognizePlant,
  testApiConnection: testApiConnection
};
