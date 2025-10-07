// Cloud function to get current user's openid
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID || wxContext.openid,
    appid: wxContext.APPID || wxContext.appid
  }
}


