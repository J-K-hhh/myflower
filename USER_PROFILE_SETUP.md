# 用户资料功能设置指南

## 功能概述

本功能允许用户设置个人昵称和头像，这些信息将存储在云端数据库中，并与用户的植物记录关联。

## 数据库结构

### user_profiles 集合
```javascript
{
  _id: "openid", // 使用openid作为文档ID
  openid: "user_openid",
  nickname: "用户微信名",
  avatarUrl: "用户头像URL", // 可选
  createdAt: "创建时间",
  updatedAt: "更新时间"
}
```

## 部署步骤

### 1. 部署云函数
在微信开发者工具中：
1. 右键点击 `cloudfunctions/userProfile` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成

### 2. 创建数据库集合
在微信云开发控制台：
1. 进入"数据库"页面
2. 创建新集合：`user_profiles`
3. 设置权限为"仅创建者可读写"

### 3. 更新默认头像
将 `/images/default-avatar.png` 替换为真实的默认头像图片（建议200x200px）

## 功能说明

### 用户资料页面
- 路径：`/pages/profile/profile`
- 功能：
  - 设置/修改昵称
  - 选择头像（使用微信头像昵称组件）
  - 删除用户资料

### 数据关联
- 植物分享时显示真实用户昵称
- 用户资料与openid绑定，确保数据安全

## 使用方法

### 用户操作
1. 进入"设置"页面
2. 点击"用户资料" -> "设置昵称和头像"
3. 输入昵称并选择头像
4. 点击"保存资料"

### 开发者调用
```javascript
// 获取用户资料
const cloudUtils = require('./utils/cloud_utils.js');
const profile = await cloudUtils.getUserProfile();

// 保存用户资料
const success = await cloudUtils.saveUserProfile('用户昵称', '头像URL');

// 更新用户资料
const success = await cloudUtils.updateUserProfile('新昵称', '新头像URL');
```

## 注意事项

1. **隐私保护**：用户资料仅与openid关联，不会泄露真实身份
2. **数据安全**：数据库权限设置为"仅创建者可读写"
3. **兼容性**：使用微信官方推荐的头像昵称组件
4. **多语言**：支持中英文界面

## 技术实现

### 云函数
- `userProfile`: 处理用户资料的增删改查操作

### 工具函数
- `getUserProfile()`: 获取当前用户资料
- `saveUserProfile()`: 创建用户资料
- `updateUserProfile()`: 更新用户资料

### 页面组件
- 用户资料设置页面
- 微信头像昵称组件
- 多语言支持

## 测试建议

1. 测试用户资料创建和更新
2. 测试植物分享时昵称显示
3. 测试多语言切换
4. 测试数据权限和安全性
