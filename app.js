App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    wx.login({ success: res => {} })
    
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
