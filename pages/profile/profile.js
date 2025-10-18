const i18n = require('../../utils/i18n.js');
const cloudUtils = require('../../utils/cloud_utils.js');

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    hasProfile: false,
    loading: false,
    i18n: i18n.getSection('profile'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage()
  },

  onLoad: function() {
    this.updateTranslations();
    this.loadUserProfile();
  },

  onShow: function() {
    this.updateTranslations();
  },

  updateTranslations: function() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    this.setData({
      i18n: i18n.getSection('profile', language),
      i18nCommon: i18n.getSection('common', language),
      language: language
    });
  },

  translate: function(namespace, keyPath, params = {}) {
    const app = getApp();
    if (app && typeof app.t === 'function') {
      return app.t(namespace, keyPath, params);
    }
    const language = this.data.language || i18n.getLanguage();
    return i18n.t(namespace, keyPath, params, language);
  },

  // 加载用户资料
  loadUserProfile: function() {
    this.setData({ loading: true });
    
    cloudUtils.getUserProfile().then(profile => {
      if (profile) {
        this.setData({
          nickname: profile.nickname || '',
          avatarUrl: profile.avatarUrl || '',
          hasProfile: true
        });
      } else {
        this.setData({
          nickname: '',
          avatarUrl: '',
          hasProfile: false
        });
      }
      this.setData({ loading: false });
    }).catch(err => {
      console.error('加载用户资料失败:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: this.translate('common', 'loadFailed'),
        icon: 'none'
      });
    });
  },

  // 昵称输入
  onNicknameInput: function(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 选择头像
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      avatarUrl: avatarUrl
    });
  },

  // 保存用户资料
  saveProfile: function() {
    const { nickname, hasProfile } = this.data;
    
    if (!nickname || nickname.trim() === '') {
      wx.showToast({
        title: this.translate('profile', 'nicknameRequired'),
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    const saveFunction = hasProfile ? cloudUtils.updateUserProfile : cloudUtils.saveUserProfile;
    
    saveFunction(nickname.trim(), this.data.avatarUrl).then(success => {
      this.setData({ loading: false });
      
      if (success) {
        wx.showToast({
          title: this.translate('common', 'saved'),
          icon: 'success'
        });
        this.setData({ hasProfile: true });
        
        // 更新全局用户资料数据
        const app = getApp();
        if (app && typeof app.updateUserProfile === 'function') {
          app.updateUserProfile({
            nickname: nickname.trim(),
            avatarUrl: this.data.avatarUrl
          });
        }
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: this.translate('common', 'saveFailed'),
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('保存用户资料失败:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: this.translate('common', 'saveFailed'),
        icon: 'none'
      });
    });
  },

  // 删除用户资料
  deleteProfile: function() {
    wx.showModal({
      title: this.translate('profile', 'deleteConfirmTitle'),
      content: this.translate('profile', 'deleteConfirmContent'),
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          
          wx.cloud.callFunction({
            name: 'userProfile',
            data: { action: 'delete' }
          }).then(res => {
            this.setData({ loading: false });
            
            if (res.result && res.result.success) {
              wx.showToast({
                title: this.translate('profile', 'deleteSuccess'),
                icon: 'success'
              });
              this.setData({
                nickname: '',
                avatarUrl: '',
                hasProfile: false
              });
            } else {
              wx.showToast({
                title: this.translate('common', 'deleteFailed'),
                icon: 'none'
              });
            }
          }).catch(err => {
            console.error('删除用户资料失败:', err);
            this.setData({ loading: false });
            wx.showToast({
              title: this.translate('common', 'deleteFailed'),
              icon: 'none'
            });
          });
        }
      }
    });
  }
});
