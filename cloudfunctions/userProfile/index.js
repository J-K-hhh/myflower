const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, nickname, avatarUrl } = event || {};
  const openid = wxContext.OPENID;
  
  if (!openid) {
    return { success: false, error: 'no_openid' };
  }
  
  const db = cloud.database();
  const collection = db.collection('user_profiles');
  
  try {
    switch (action) {
      case 'get':
        // 获取用户资料
        const getResult = await collection.doc(openid).get();
        if (getResult.data) {
          return { 
            success: true, 
            data: getResult.data 
          };
        } else {
          return { 
            success: true, 
            data: null 
          };
        }
        
      case 'create':
      case 'update':
        // 创建或更新用户资料
        if (!nickname || nickname.trim() === '') {
          return { 
            success: false, 
            error: 'nickname_required' 
          };
        }
        
        const now = new Date();
        const userData = {
          openid: openid,
          nickname: nickname.trim(),
          updatedAt: now
        };
        
        // 如果是更新，添加头像URL
        if (avatarUrl) {
          userData.avatarUrl = avatarUrl;
        }
        
        // 尝试创建，如果已存在则更新
        try {
          await collection.doc(openid).set({
            data: {
              ...userData,
              createdAt: now
            }
          });
          return { 
            success: true, 
            message: 'created' 
          };
        } catch (createError) {
          // 如果创建失败，尝试更新
          await collection.doc(openid).update({
            data: userData
          });
          return { 
            success: true, 
            message: 'updated' 
          };
        }
        
      case 'delete':
        // 删除用户资料
        await collection.doc(openid).remove();
        return { 
          success: true, 
          message: 'deleted' 
        };
        
      default:
        return { 
          success: false, 
          error: 'invalid_action' 
        };
    }
  } catch (error) {
    console.error('userProfile error:', error);
    return { 
      success: false, 
      error: error.message || 'unknown_error' 
    };
  }
};
