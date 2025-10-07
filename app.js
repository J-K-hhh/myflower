App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    wx.login({ success: res => {} })
    
    // 初始化云能力（用于持久化图片）
    try {
      if (wx.cloud && typeof wx.cloud.init === 'function') {
        wx.cloud.init({ env: 'cloud1-3g0zhoisfb048afb', traceUser: false });
      }
    } catch (e) {}

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
