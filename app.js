App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    if (!wx.cloud) {
      console.error('请使用 2.2.3+ 的基础库以使用云能力');
      return;
    }

    // 2) 正确初始化云环境 —— 用动态环境，和 DevTools 当前选择的 env 保持一致
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV, // ✅ 关键：指定动态环境
      traceUser: true
    });
    console.log('[app] wx.cloud.init done (DYNAMIC_CURRENT_ENV)');

    // 3) 全局就绪：先拿 openid，页面里 await app.ready 再去查云端
    this.ready = (async () => {
      try {
        const { result } = await wx.cloud.callFunction({ name: 'login' });
        this.openid = result.openid;
        console.log('[app] openid:', this.openid);
        
        // 存储用户昵称到云数据库
        this.saveUserNickname();
        
        return this.openid;
      } catch (e) {
        console.error('[app] login failed:', e);
        // 这里返回 null，页面可以据此做降级（仅本地缓存，不查云端）
        return null;
      }
    })();

    // 设置随机emoji标题
    this.setRandomTitle()
  },
  
  // 设置随机emoji标题
  setRandomTitle() {
    const plantEmojis = [
      '🌱', '🌿', '🌳', '🌲', '🌴', '🌵', '🌾', '🌺', '🌻', '🌷',
      '🌸', '🌼', '🌹', '🌻', '🌺', '🌷', '🌿', '🌱', '🌳', '🌲',
      '🌴', '🌵', '🌾', '🌿', '🌱', '🌳', '🌲', '🌴', '🌵', '🌾',
      '🌺', '🌻', '🌷', '🌸', '🌼', '🌹', '🌻', '🌺', '🌷', '🌿',
      '🌱', '🌳', '🌲', '🌴', '🌵', '🌾', '🌿', '🌱', '🌳', '🌲'
    ]
    
    // 随机选择一个emoji
    const randomEmoji = plantEmojis[Math.floor(Math.random() * plantEmojis.length)]
    const title = `${randomEmoji} 我的阳台花园`
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: title
    })
    
    // 保存到全局数据，供其他页面使用
    this.globalData.currentEmoji = randomEmoji
    this.globalData.currentTitle = title
  },
  
  // 保存用户昵称到云数据库
  saveUserNickname() {
    if (!this.openid) return;
    
    wx.getUserProfile({
      desc: '用于分享时显示您的昵称',
      success: (res) => {
        const nickName = res.userInfo.nickName;
        if (nickName) {
          // 存储到云数据库
          wx.cloud.database().collection('users').doc(this.openid).set({
            data: {
              nickName: nickName,
              updateTime: new Date()
            }
          }).catch(e => {
            console.log('保存用户昵称失败:', e);
          });
        }
      },
      fail: (e) => {
        console.log('获取用户信息失败:', e);
      }
    });
  },
  
  globalData: {
    userInfo: null,
    currentEmoji: '🌱',
    currentTitle: '🌱 我的阳台花园',
    baiduAi: {
      apiKey: 'rJtyOhhpWmzpCtkqe2RBSuY6',
      secretKey: 'o9jMcF3qbM5wlpsWxFfDFplFIfu9RITy',
      accessToken: null
    }
  }
})
