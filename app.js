const i18n = require('./utils/i18n.js');

App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    const savedLanguage = wx.getStorageSync('appLanguage') || 'zh'
    i18n.setLanguage(savedLanguage)
    this.globalData.language = i18n.getLanguage()

    // Backend-aware init: only init wx.cloud when using Tencent backend
    const systemConfig = require('./utils/system_config.js');
    const backend = systemConfig.getBackend();
    this.backendType = backend.type || 'tencent';

    if (this.backendType === 'tencent') {
      if (!wx.cloud) {
        console.error(i18n.t('common', 'pleaseUseNewVersion'))
      } else {
        wx.cloud.init({
          env: wx.cloud.DYNAMIC_CURRENT_ENV,
          traceUser: true
        });
        console.log('[app] wx.cloud.init done (DYNAMIC_CURRENT_ENV)');
      }

      // Ready: fetch openid via cloud function
      this.ready = (async () => {
        try {
          const { result } = await wx.cloud.callFunction({ name: 'login' });
          this.openid = result.openid;
          console.log('[app] openid:', this.openid);
          try { wx.setStorageSync('openid', this.openid); } catch (e) {}
          return this.openid;
        } catch (e) {
          console.error('[app] login failed:', e);
          return null;
        }
      })();
    } else {
      // Non-Tencent backend: no cloud init or openid
      this.ready = Promise.resolve(null);
    }

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

  // 加载用户资料（通过后端服务适配器）
  loadUserProfile: async function() {
    try {
      const backend = require('./utils/backend_service.js');
      const profile = await backend.getUserProfile();
      this.globalData.userProfile = profile;
      return profile;
    } catch (e) {
      console.error('[app] loadUserProfile failed:', e);
      return null;
    }
  },

  // 更新用户资料
  updateUserProfile: function(profile) {
    this.globalData.userProfile = profile;
  },
  
  
  globalData: {
    userInfo: null,
    userProfile: null, // 用户资料信息
    currentEmoji: '🌱',
    currentTitle: '',
    language: 'zh'
  }
})
