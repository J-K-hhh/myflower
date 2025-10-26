const baiduAi = require('./baidu_ai.js');
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

// Minimal fallback model configs (system_config should supply actual keys/values)
const FALLBACK_MODEL_CONFIGS = {
  'qwen-vl-max-2025-08-13': {
    name: 'qwen-vl-max-2025-08-13',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    timeout: 60000,
    maxImageSize: 300000
  },
  'gemini-pro-vision': {
    name: 'gemini-pro-vision',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent',
    timeout: 60000,
    maxImageSize: 120000
  }
};

/**
 * 获取当前选择的模型
 */
function getCurrentModel() {
  // System-level model takes precedence
  try {
    const ai = systemConfig.getAi();
    if (ai && ai.selectedModel) return ai.selectedModel;
  } catch (e) {}
  const settings = wx.getStorageSync('appSettings') || {};
  return settings.selectedModel || 'baidu';
}

/**
 * 获取模型配置
 */
function getModelConfig(modelName = null) {
  const model = modelName || getCurrentModel();
  try {
    const cfg = systemConfig.getModelConfig(model);
    if (cfg) return cfg;
  } catch (e) {}
  return FALLBACK_MODEL_CONFIGS[model] || FALLBACK_MODEL_CONFIGS['qwen-vl-max-2025-08-13'];
}

/**
 * 压缩图片
 */
function compressImage(filePath, quality = 0.8) {
  return new Promise((resolve, reject) => {
    console.log('开始压缩图片:', filePath);
    
    wx.compressImage({
      src: filePath,
      quality: quality,
      compressedHeight: 800,  // 提高分辨率
      compressedWidth: 800,   // 提高分辨率
      success: (res) => {
        console.log('图片压缩成功:', res.tempFilePath);
        
        // 获取压缩后的文件信息
        wx.getFileInfo({
          filePath: res.tempFilePath,
          success: (fileInfo) => {
            console.log('压缩后文件大小:', fileInfo.size, '字节');
            console.log('压缩后文件大小:', (fileInfo.size / 1024).toFixed(2), 'KB');
            resolve(res.tempFilePath);
          },
          fail: () => {
            resolve(res.tempFilePath);
          }
        });
      },
      fail: (err) => {
        console.log('图片压缩失败，使用原图片:', err);
        resolve(filePath);
      }
    });
  });
}

/**
 * 处理图片数据
 */
function processImageData(imageBase64, maxSize) {
  console.log('原始图片Base64长度:', imageBase64.length);
  
  // 验证Base64格式
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(imageBase64)) {
    console.log('Base64格式验证失败，尝试修复...');
    // 移除可能的非法字符
    imageBase64 = imageBase64.replace(/[^A-Za-z0-9+/=]/g, '');
  }
  
  if (imageBase64.length > maxSize) {
    console.log('图片过大，进行截取压缩');
    // 确保截取后的Base64是完整的（以=或==结尾）
    let truncatedBase64 = imageBase64.substring(0, maxSize);
    
    // 检查Base64是否完整，如果不完整则调整截取位置
    while (truncatedBase64.length > 0 && !truncatedBase64.endsWith('=') && !truncatedBase64.endsWith('==')) {
      truncatedBase64 = truncatedBase64.substring(0, truncatedBase64.length - 1);
    }
    
    // 如果截取后太小，至少保留一个完整的Base64块（4的倍数）
    if (truncatedBase64.length < 2000) {
      truncatedBase64 = imageBase64.substring(0, Math.min(2000, imageBase64.length));
      // 确保是4的倍数
      const remainder = truncatedBase64.length % 4;
      if (remainder !== 0) {
        truncatedBase64 = truncatedBase64.substring(0, truncatedBase64.length - remainder);
      }
    }
    
    imageBase64 = truncatedBase64;
    console.log('压缩后长度:', imageBase64.length);
    console.log('Base64是否完整:', imageBase64.endsWith('=') || imageBase64.endsWith('=='));
  }
  
  // 最终验证
  const isValidBase64 = base64Regex.test(imageBase64);
  console.log('Base64格式是否有效:', isValidBase64);
  console.log('最终图片Base64长度:', imageBase64.length);
  console.log('Base64前50字符:', imageBase64.substring(0, 50));
  console.log('Base64后50字符:', imageBase64.substring(imageBase64.length - 50));
  
  if (!isValidBase64) {
    console.log('警告：Base64格式可能有问题');
  }
  
  return imageBase64;
}

/**
 * 构建千问VL请求数据
 */
function buildQwenVLRequest(prompt, imageBase64) {
  return {
    model: getModelConfig().name,
            input: {
              messages: [
                {
                  role: 'user',
          content: `${prompt}<img>data:image/jpeg;base64,${imageBase64}</img>`
                }
              ]
            },
            parameters: {
              result_format: 'message'
            }
  };
}

/**
 * 构建Gemini请求数据
 */
function buildGeminiRequest(prompt, imageBase64) {
  return {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 4096,
    }
  };
}

/**
 * 解析千问VL响应
 */
function parseQwenVLResponse(apiRes) {
  console.log('=== 解析千问VL响应 ===');
  console.log('完整API响应:', apiRes);
  console.log('响应状态码:', apiRes.statusCode);
  console.log('响应数据结构:', JSON.stringify(apiRes.data, null, 2));
  
  let content = '';
  
  // 尝试多种响应格式
  if (apiRes.data.output && apiRes.data.output.choices && apiRes.data.output.choices[0] && apiRes.data.output.choices[0].message) {
    content = apiRes.data.output.choices[0].message.content;
    console.log('从choices[0].message.content提取内容:', content);
  } else if (apiRes.data.output && apiRes.data.output.text) {
    content = apiRes.data.output.text;
    console.log('从output.text提取内容:', content);
  } else if (apiRes.data.content) {
    content = apiRes.data.content;
    console.log('从data.content提取内容:', content);
  } else if (typeof apiRes.data === 'string') {
    content = apiRes.data;
    console.log('从data字符串提取内容:', content);
  } else if (apiRes.data.choices && apiRes.data.choices[0] && apiRes.data.choices[0].message) {
    content = apiRes.data.choices[0].message.content;
    console.log('从data.choices[0].message.content提取内容:', content);
  } else {
    console.log('无法找到内容，尝试其他路径...');
    // 尝试其他可能的路径
    if (apiRes.data.result && apiRes.data.result.output) {
      content = apiRes.data.result.output.text || apiRes.data.result.output.content;
      console.log('从result.output提取内容:', content);
    }
  }
  
  // 处理数组格式
  if (Array.isArray(content)) {
    console.log('内容是数组，长度:', content.length);
    if (content.length > 0 && content[0].text) {
      content = content[0].text;
      console.log('从数组[0].text提取内容:', content);
    } else if (content.length > 0 && typeof content[0] === 'string') {
      content = content[0];
      console.log('从数组[0]字符串提取内容:', content);
    }
  } else if (content && content.text) {
    content = content.text;
    console.log('从content.text提取内容:', content);
  }
  
  console.log('最终提取的内容:', content);
  console.log('内容类型:', typeof content);
  console.log('内容长度:', content ? content.length : 0);
  
  return content;
}

/**
 * 解析Gemini响应
 */
function parseGeminiResponse(apiRes) {
  if (apiRes.data.candidates && apiRes.data.candidates[0] && apiRes.data.candidates[0].content) {
    return apiRes.data.candidates[0].content.parts[0].text;
  }
  return '';
}

/**
 * 解析AI回复，提取结构化信息
 */
function parseAIResponse(content) {
  const result = {
    name: '',
    scientificName: '',
    wateringTips: '',
    lightingTips: '',
    healthInfo: '',
    careTips: '',
    funFacts: ''
  };
  
  if (!content) return result;
  
  console.log('=== 开始解析AI回复 ===');
  console.log('原始内容:', content);
  
  // 提取植物名称（匹配 **向日葵（Sunflower）** 格式）
  const nameMatch = content.match(/\*\*([^*（]+)（[^）]+）\*\*/);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    console.log('提取到植物名称:', result.name);
  } else {
    // 尝试其他格式
    const nameMatch2 = content.match(/植物名称[：:]\s*该图片中的植物是\*\*([^*]+)\*\*/);
    if (nameMatch2) {
      result.name = nameMatch2[1].trim();
      console.log('提取到植物名称（格式2）:', result.name);
    }
  }
  
  // 提取学名（匹配 **Helianthus annuus** 格式）
  const scientificMatch = content.match(/学名为\s*\*\*([^*]+)\*\*/);
  if (scientificMatch) {
    result.scientificName = scientificMatch[1].trim();
    console.log('提取到学名:', result.scientificName);
  }
  
  // 提取浇水信息（匹配 - **浇水**：... 格式）
  const wateringMatch = content.match(/- \*\*浇水\*\*[：:]\s*([^。\n]+)/);
  if (wateringMatch) {
    result.wateringTips = wateringMatch[1].trim();
    console.log('提取到浇水信息:', result.wateringTips);
  }
  
  // 提取光照信息（匹配 - **光照**：... 格式）
  const lightingMatch = content.match(/- \*\*光照\*\*[：:]\s*([^。\n]+)/);
  if (lightingMatch) {
    result.lightingTips = lightingMatch[1].trim();
    console.log('提取到光照信息:', result.lightingTips);
  }
  
  // 提取土壤信息
  const soilMatch = content.match(/- \*\*土壤\*\*[：:]\s*([^。\n]+)/);
  if (soilMatch) {
    result.healthInfo = `土壤要求：${soilMatch[1].trim()}`;
    console.log('提取到土壤信息:', result.healthInfo);
  }
  
  // 提取施肥信息（匹配 - **施肥**：... 格式）
  const fertilizingMatch = content.match(/- \*\*施肥\*\*[：:]\s*([^。\n]+)/);
  if (fertilizingMatch) {
    result.careTips = `施肥建议：${fertilizingMatch[1].trim()}`;
    console.log('提取到施肥信息:', result.careTips);
  }
  
  // 提取支撑信息
  const supportMatch = content.match(/- \*\*支撑\*\*[：:]\s*([^。\n]+)/);
  if (supportMatch) {
    result.funFacts = `支撑要求：${supportMatch[1].trim()}`;
    console.log('提取到支撑信息:', result.funFacts);
  }
  
  // 提取病虫害防治信息
  const pestMatch = content.match(/- \*\*病虫害防治\*\*[：:]\s*([^。\n]+)/);
  if (pestMatch) {
    if (result.funFacts) {
      result.funFacts += `；病虫害防治：${pestMatch[1].trim()}`;
    } else {
      result.funFacts = `病虫害防治：${pestMatch[1].trim()}`;
    }
    console.log('提取到病虫害防治信息:', pestMatch[1].trim());
  }
  
  // 如果没有提取到具体信息，使用默认值
  if (!result.name) {
    result.name = translate('common', 'unknownPlant');
    console.log('使用默认植物名称');
  }
  if (!result.scientificName) {
    result.scientificName = '';
    console.log('使用默认学名');
  }
  if (!result.wateringTips) {
    result.wateringTips = translate('models', 'defaults.watering');
    console.log('使用默认浇水信息');
  }
  if (!result.lightingTips) {
    result.lightingTips = translate('models', 'defaults.lighting');
    console.log('使用默认光照信息');
  }
  if (!result.healthInfo) {
    result.healthInfo = translate('models', 'defaults.health');
    console.log('使用默认健康信息');
  }
  if (!result.careTips) {
    result.careTips = translate('models', 'defaults.care');
    console.log('使用默认养护信息');
  }
  if (!result.funFacts) {
    result.funFacts = '';
    console.log('使用默认有趣信息');
  }
  
  console.log('=== 解析完成 ===');
  console.log('最终结果:', result);
  
  return result;
}

/**
 * 发送API请求
 */
function sendApiRequest(config, requestData) {
  return new Promise((resolve, reject) => {
    console.log('=== 发送API请求 ===');
    console.log('请求URL:', config.baseUrl);
    console.log('请求模型:', requestData.model);
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    console.log('API Key:', config.apiKey ? config.apiKey.substring(0, 10) + '...' : '未设置');
    
    wx.request({
      url: config.baseUrl,
      method: 'POST',
      timeout: config.timeout,
      header: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
          success: (res) => {
        console.log('=== API请求成功 ===');
            console.log('响应状态码:', res.statusCode);
            console.log('响应数据:', res.data);
            
        if (res.statusCode === 200 && res.data) {
          resolve(res);
            } else {
          console.log('API请求失败，状态码:', res.statusCode);
          console.log('响应数据:', res.data);
          reject(new Error(translate('models', 'errors.apiRequestFailed', { code: res.statusCode })));
            }
          },
          fail: (err) => {
        console.log('=== API请求失败 ===');
        console.log('错误信息:', err);
        reject(new Error(translate('models', 'errors.networkFailed', { message: err.errMsg })));
          }
    });
  });
}

/**
 * 识别植物（根据当前选择的模型）
 */
function recognizePlant(filePath, location = null, onProgress = null) {
  const model = getCurrentModel();
  
  if (model === 'baidu') {
    return baiduAi.recognizePlant(filePath).then(res => ({
      ...res,
      model: 'baidu'
    }));
  } else if (model.startsWith('qwen-vl')) {
    return recognizePlantWithQwenVL(filePath, location, onProgress);
  } else if (model === 'gemini-pro-vision') {
    return recognizePlantWithGemini(filePath, location, onProgress);
  } else {
    return Promise.reject(new Error(translate('models', 'errors.unknownModel')));
  }
}

/**
 * 使用千问VL识别植物
 */
function recognizePlantWithQwenVL(filePath, location = null, onProgress = null) {
  return new Promise((resolve, reject) => {
    const config = getModelConfig();
    
    if (onProgress) onProgress(translate('models', 'progress.compressing'));
    compressImage(filePath, 0.8)
      .then((compressedFilePath) => {
    const fileSystemManager = wx.getFileSystemManager();
        return new Promise((fileResolve, fileReject) => {
    fileSystemManager.readFile({
            filePath: compressedFilePath,
      encoding: 'base64',
      success: (res) => {
              let imageBase64 = res.data;
              imageBase64 = processImageData(imageBase64, config.maxImageSize);
              
              const prompt = '请直接分析这张图片中的植物，不要提到Base64编码。请告诉我：1. 植物名称 2. 学名 3. 主要特征 4. 养护建议';
              const requestData = buildQwenVLRequest(prompt, imageBase64);
              
        if (onProgress) onProgress(translate('models', 'progress.sending'));

              sendApiRequest(config, requestData)
                .then((apiRes) => {
                  const content = parseQwenVLResponse(apiRes);
                  const parsedInfo = parseAIResponse(content);
                  
                  const result = {
                    name: parsedInfo.name || translate('common', 'unknownPlant'),
                    scientificName: parsedInfo.scientificName || '',
                    wateringTips: parsedInfo.wateringTips || translate('models', 'defaults.watering'),
                    lightingTips: parsedInfo.lightingTips || translate('models', 'defaults.lighting'),
                    healthInfo: parsedInfo.healthInfo || translate('models', 'defaults.health'),
                    careTips: parsedInfo.careTips || translate('models', 'defaults.care'),
                    funFacts: parsedInfo.funFacts || '',
                    model: 'qwen-vl',
                    rawResponse: content
                  };
                  
                  console.log('=== 准备返回结果 ===');
                  console.log('解析后的信息:', parsedInfo);
                  console.log('最终结果:', result);
                  console.log('结果类型:', typeof result);
                  console.log('结果键:', Object.keys(result));
                  
                  fileResolve(result);
                })
                .catch(fileReject);
            },
            fail: fileReject
          });
        });
      })
      .then((result) => {
        console.log('=== 外层Promise收到结果 ===');
        console.log('结果:', result);
        resolve(result);
      })
      .catch((error) => {
        console.log('=== 外层Promise捕获错误 ===');
        console.log('错误:', error);
        reject(error);
    });
  });
}

/**
 * 使用Gemini识别植物
 */
function recognizePlantWithGemini(filePath, location = null, onProgress = null) {
  return new Promise((resolve, reject) => {
    const config = getModelConfig('gemini-pro-vision');
    
    if (!config.apiKey) {
      reject(new Error(translate('models', 'errors.geminiKeyMissing')));
      return;
    }
    
    if (onProgress) onProgress(translate('models', 'progress.compressing'));
    compressImage(filePath, 0.8)
      .then((compressedFilePath) => {
        const fileSystemManager = wx.getFileSystemManager();
        return new Promise((resolve, reject) => {
          fileSystemManager.readFile({
            filePath: compressedFilePath,
            encoding: 'base64',
            success: (res) => {
              let imageBase64 = res.data;
              imageBase64 = processImageData(imageBase64, config.maxImageSize);
              
              const prompt = '请直接分析这张图片中的植物，不要提到Base64编码。请告诉我：1. 植物名称 2. 学名 3. 主要特征 4. 养护建议';
              const requestData = buildGeminiRequest(prompt, imageBase64);
              
              if (onProgress) onProgress(translate('models', 'progress.sending'));
              
              sendApiRequest(config, requestData)
                .then((apiRes) => {
                  const content = parseGeminiResponse(apiRes);
                  const parsedInfo = parseAIResponse(content);
  
  const result = {
                    name: parsedInfo.name || translate('common', 'unknownPlant'),
                    scientificName: parsedInfo.scientificName || '',
                    wateringTips: parsedInfo.wateringTips || translate('models', 'defaults.watering'),
                    lightingTips: parsedInfo.lightingTips || translate('models', 'defaults.lighting'),
                    healthInfo: parsedInfo.healthInfo || translate('models', 'defaults.health'),
                    careTips: parsedInfo.careTips || translate('models', 'defaults.care'),
                    funFacts: parsedInfo.funFacts || '',
                    model: 'gemini',
    rawResponse: content
  };
  
                  resolve(result);
                })
                .catch(reject);
            },
            fail: reject
          });
        });
      })
      .catch(reject);
  });
}

/**
 * 分析植物健康状态（拍照分析）
 */
function analyzePlantHealth(filePath, location = null) {
  const model = getCurrentModel();
  
  if (model === 'qwen-vl') {
    return analyzeHealthWithQwenVL(filePath, location);
  } else {
    // 其他模型不支持健康分析，返回基础信息
    return recognizePlant(filePath, location).then(result => {
      return {
        ...result,
        healthAnalysis: translate('models', 'defaults.healthAnalysis'),
        model: model
      };
    });
  }
}

/**
 * 使用千问VL分析植物健康状态
 */
function analyzeHealthWithQwenVL(filePath, location = null) {
  return new Promise((resolve, reject) => {
    const config = getModelConfig();
    
    compressImage(filePath, 0.7)
      .then((compressedFilePath) => {
    const fileSystemManager = wx.getFileSystemManager();
        return new Promise((resolve, reject) => {
    fileSystemManager.readFile({
            filePath: compressedFilePath,
      encoding: 'base64',
      success: (res) => {
              let imageBase64 = res.data;
              imageBase64 = processImageData(imageBase64, config.maxImageSize);
              
        const currentDate = new Date().toLocaleDateString('zh-CN');
        const locationText = location ? `位置：纬度${location.latitude}，经度${location.longitude}` : '位置：未知';
        
        const prompt = `请直接分析这张植物照片的当前健康状态，不要提到Base64编码。请提供养护建议：

当前日期：${currentDate}
${locationText}

请从以下几个方面分析：
1. 植物整体健康状况（优秀/良好/一般/需要关注）
2. 叶片状态分析
3. 土壤湿度判断
4. 是否需要浇水
5. 是否需要施肥
6. 光照是否充足
7. 其他养护建议

请用中文回答，内容要详细且实用。`;

              const requestData = buildQwenVLRequest(prompt, imageBase64);
              
              sendApiRequest(config, requestData)
                .then((apiRes) => {
                  const content = parseQwenVLResponse(apiRes);
                  
                const result = {
                  healthAnalysis: content,
                  model: 'qwen-vl',
                  analysisDate: new Date().toISOString(),
                  location: location
                };
                  
                resolve(result);
                })
                .catch(reject);
            },
            fail: reject
          });
        });
      })
      .catch(reject);
  });
}

module.exports = {
  getCurrentModel,
  getModelConfig,
  recognizePlant,
  analyzePlantHealth
};
