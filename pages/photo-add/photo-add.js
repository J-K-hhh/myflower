const i18n = require('../../utils/i18n.js');

Page({
  data: {
    filePath: '',
    dateString: '',
    i18nPhoto: i18n.getSection('photoAdd'),
    i18nCommon: i18n.getSection('common'),
    language: i18n.getLanguage()
  },
  onLoad() {
    this.updateTranslations();
    try {
      const channel = this.getOpenerEventChannel();
      channel.on('initData', (data) => {
        const { filePath, dateInfo } = data || {};
        const dateString = (dateInfo && dateInfo.dateString) || new Date().toISOString().split('T')[0];
        this.setData({ filePath: filePath || '', dateString });
      });
    } catch (e) {}
  },
  onShow() {
    this.updateTranslations();
  },
  updateTranslations() {
    const app = getApp();
    const language = app && typeof app.getLanguage === 'function' ? app.getLanguage() : i18n.getLanguage();
    const i18nPhoto = i18n.getSection('photoAdd', language);
    const i18nCommon = i18n.getSection('common', language);
    this.setData({ i18nPhoto, i18nCommon, language });
    try { wx.setNavigationBarTitle({ title: i18nPhoto.title }); } catch (e) {}
  },
  onDateChange(e) {
    this.setData({ dateString: e.detail.value });
  },
  onCancel() {
    wx.navigateBack();
  },
  onConfirm() {
    const ts = new Date(this.data.dateString).getTime();
    const channel = this.getOpenerEventChannel();
    try {
      channel.emit('onPhotoDateSelected', {
        dateInfo: {
          timestamp: ts,
          dateString: this.data.dateString
        }
      });
    } catch (e) {}
    wx.navigateBack();
  }
});
