const i18n = require('./utils/i18n.js');

App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    const savedLanguage = wx.getStorageSync('appLanguage') || 'zh'
    i18n.setLanguage(savedLanguage)
    this.globalData.language = i18n.getLanguage()

    if (!wx.cloud) {
      console.error(i18n.t('common', 'pleaseUseNewVersion'))
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
    const title = i18n.t('common', 'appTitle', { emoji: randomEmoji }, this.getLanguage())
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: title
    })
    
    // 保存到全局数据，供其他页面使用
    this.globalData.currentEmoji = randomEmoji
    this.globalData.currentTitle = title
  },

  setLanguage(lang) {
    const language = i18n.translations[lang] ? lang : 'zh'
    i18n.setLanguage(language)
    this.globalData.language = language
    wx.setStorageSync('appLanguage', language)
    this.setRandomTitle()
  },

  getLanguage() {
    return this.globalData.language || i18n.getLanguage()
  },

  t(namespace, keyPath, params = {}) {
    return i18n.t(namespace, keyPath, params, this.getLanguage())
  },
  
  
  globalData: {
    userInfo: null,
    currentEmoji: '🌱',
    currentTitle: '',
    language: 'zh',
    baiduAi: {
      apiKey: 'rJtyOhhpWmzpCtkqe2RBSuY6',
      secretKey: 'o9jMcF3qbM5wlpsWxFfDFplFIfu9RITy',
      accessToken: null
    }
  }
})
