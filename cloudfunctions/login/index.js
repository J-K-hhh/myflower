const cloud = require('wx-server-sdk');
// 一定要指定动态环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 必须返回一个对象；不要 return undefined / 空
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || null,
    env: wxContext.ENV
  };
};



