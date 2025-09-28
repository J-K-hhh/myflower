Page({
  data: {
    plantList: [],
    statusIcon: '🌱',
    statusText: '开始种植'
  },
  onShow: function () {
    this.loadPlantData();
    this.setRandomTitle();
  },
  
  setRandomTitle: function() {
    const app = getApp();
    app.setRandomTitle();
  },
  loadPlantData: function () {
    const plantList = wx.getStorageSync('plantList') || [];
    plantList.forEach(plant => {
      if (plant.createTime) {
        plant.createDate = new Date(plant.createTime).toLocaleDateString();
      }
    });
    const statusInfo = this.getStatusInfo(plantList.length);
    this.setData({
      plantList: plantList,
      statusIcon: statusInfo.icon,
      statusText: statusInfo.text
    });
  },
  getStatusInfo: function (count) {
    if (count === 0) {
      return { icon: '🌱', text: '开始种植' };
    } else if (count <= 2) {
      return { icon: '🌿', text: '小花园' };
    } else if (count <= 5) {
      return { icon: '🌳', text: '绿意盎然' };
    } else {
      return { icon: '🏡', text: '植物王国' };
    }
  },
  goToAdd: function () {
    wx.navigateTo({
      url: '/pages/add/add',
    });
  },
  goToDetail: function (e) {
    const plantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${plantId}`,
    });
  },
  goToSettings: function () {
    wx.navigateTo({
      url: '/pages/settings/settings',
    });
  }
});
