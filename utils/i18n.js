const translations = {
  zh: {
    common: {
      appTitle: '{{emoji}} 我的阳台花园',
      unknownPlant: '未知植物',
      pleaseUseNewVersion: '请使用 2.2.3+ 的基础库以使用云能力',
      ok: '确定',
      cancel: '取消',
      gotIt: '知道了',
      continueAdding: '继续添加',
      viewDetails: '查看详情',
      retry: '重新识别',
      success: '成功',
      failure: '失败',
      yes: '是',
      no: '否',
      notAvailable: '不可用',
      loading: '加载中...',
      saved: '已保存',
      saveFailed: '保存失败',
      loadFailed: '加载失败',
      deleteFailed: '删除失败',
      listDelimiter: '、',
      languageNames: {
        zh: '中文',
        en: 'English'
      },
      languages: {
        title: '界面语言',
        description: '选择用于界面显示的语言'
      },
      nav: {
        settings: '设置',
        addPlant: '添加植物'
      },
      storage: {
        restoreSuccess: '已从云端恢复数据',
        restoreEmpty: '没有云端数据',
        restoreFailed: '云端恢复失败',
        cloudUnavailable: '云能力不可用',
        identityFailed: '无法获取用户身份',
        uploadFailed: '图片上传失败',
        syncFailed: '云同步失败'
      },
      reminder: {
        title: '浇水提醒',
        description: '设置浇水提醒频率',
        frequency: {
          daily: '每天',
          frequent: '频繁（3天一次）',
          occasional: '偶尔（7天一次）',
          off: '关闭'
        },
        status: {
          needsWatering: '小绿植口渴啦！💧',
          wateredRecently: '小绿植很健康！🌱',
          noPlants: '暂无植物'
        },
        lastWatering: '最近浇水',
        needsWateringTitle: '需要浇水的植物',
        noPlantsNeedWatering: '没有植物需要浇水',
        neverWatered: '从未浇水',
        neverWateredCute: '还没有被浇过水呢～',
        daysAgo: '{{days}}天前'
      }
    },
    index: {
      emptyState: {
        title: '您的阳台花园还在等第一株小绿植呢',
        tip: '点击下方的“+”按钮开始记录吧'
      },
      batchMode: {
        tip: '批量模式：点击植物进行选择',
        selectedCount: '已选择 {{count}} 株',
        watering: '批量浇水',
        fertilizing: '批量施肥',
        exit: '退出',
        historyTitle: '批量操作记录',
        plantCountLabel: '{{count}}株植物：',
        emptyHistory: '暂无批量操作记录',
        confirmWateringTitle: '批量浇水',
        confirmWateringContent: '确定要为选中的 {{count}} 株植物浇水吗？',
        confirmFertilizingTitle: '批量施肥',
        confirmFertilizingContent: '确定要为选中的 {{count}} 株植物施肥吗？',
        processingWatering: '正在批量浇水...',
        processingFertilizing: '正在批量施肥...',
        successWatering: '已为 {{count}} 株植物浇水',
        successFertilizing: '已为 {{count}} 株植物施肥',
        noSelection: '请选择植物'
      },
      historyToastEmpty: '暂无批量操作记录'
    },
    add: {
      uploader: {
        title: '添加新绿植',
        subtitle: '为您的绿植拍一张美照吧 📷'
      },
      sections: {
        recognitionInfo: '识别信息',
        recognitionResult: '识别结果',
        careInfo: '养护信息'
      },
      info: {
        currentModel: '当前模型：',
        modelBaidu: '百度AI植物识别',
        modelQwen: '通义千问VL',
        locationService: '位置服务：',
        locationEnabled: '已开启',
        locationDisabled: '未开启',
        currentLocation: '当前位置：'
      },
      loading: {
        recognizing: '正在识别中...'
      },
      qwen: {
        watering: '💧 浇水tips',
        lighting: '☀️ 光照tips',
        health: '🏥 健康信息',
        care: '🌱 综合养护tips',
        knowledge: '💡 小知识'
      },
      baiduCare: {
        title: '养护要点'
      },
      form: {
        lastWatering: '上次浇水',
        lastFertilizing: '上次施肥',
        selectDate: '请选择日期'
      },
      buttons: {
        save: '🌱 种下绿植',
        recognizing: '识别中...'
      },
      apiTest: {
        testing: '测试API连接...',
        missingKeyTitle: 'API Key未配置',
        missingKeyContent: '请先配置{{modelName}}的API Key',
        successTitle: 'API配置正常',
        cloudUploadFailedTitle: '上传到云端失败',
        cloudUploadFailedContent: '已改为仅保存到本地，图片不会出现在云存储。',
        cloudUnavailableTitle: '云能力不可用',
        cloudUnavailableContent: '当前无法上传到云存储，图片将仅保存在本地，云端不可见。'
      },
      recognition: {
        preparingImage: '正在准备图片...',
        connectingModel: '正在连接AI模型...',
        analyzing: '正在分析植物特征...',
        processing: '正在处理识别结果...',
        failedTitle: '识别失败',
        failedContent: '植物识别失败，是否继续添加绿植？\n\n错误详情：\n{{error}}',
        continueAddingTitle: '可以继续添加绿植',
        fullErrorTitle: '详细错误信息',
        errorLabels: {
          model: '模型',
          message: '错误信息',
          type: '错误类型',
          full: '完整错误'
        },
        errorPlaceholder: '未知错误',
        selectImageFirst: '请先选择一张图片',
        recognizingWait: '正在识别中，请稍候',
        successModalTitle: '🌱 种下成功！'
      }
    },
    detail: {
      image: {
        setCover: '设为题图',
        delete: '删除',
        addMemo: '📝 添加备忘',
        memoPlaceholder: '添加备忘信息...',
        memoSave: '保存',
        memoCancel: '取消',
        memoSaved: '备忘已保存',
        alreadyCover: '已经是题图了',
        setCoverSuccess: '已设为题图',
        keepAtLeastOne: '至少保留一张照片',
        deleteConfirmTitle: '确认删除',
        deleteConfirmContent: '确定要删除这张照片吗？',
        deleteSuccess: '照片已删除',
        firstImage: '已经是第一张了',
        lastImage: '已经是最后一张了',
        orderUpdated: '图片顺序已调整',
        limitReached: '最多只能保存{{count}}张照片',
        coverBadge: '题图'
      },
      history: {
        titleWatering: '浇水记录',
        titleFertilizing: '施肥记录',
        titleHealth: '健康分析记录',
        none: '暂无记录',
        viewDetails: '查看详情',
        updateWatering: '💧 更新浇水',
        updateFertilizing: '🌱 更新施肥',
        takePhoto: '📷 为它拍照',
        noHealth: '暂无健康分析记录',
        recordUnit: '次记录',
        analysisUnit: '次分析'
      },
      info: {
        recordedAt: '记录时间',
        healthAnalysis: '健康分析',
        noAnalysis: '暂无分析'
      },
      status: {
        loadingShare: '加载分享...',
        analyzingHealth: '分析健康状态...',
        shareFromFriend: '来自朋友的{{name}}'
      },
      errors: {
        missingId: '缺少植物ID',
        plantNotFound: '找不到该植物信息',
        shareLoadFailed: '无法加载分享内容',
        shareExpired: '分享已失效或被删除',
        loadFailed: '加载失败',
        nameRequired: '名称不能为空',
        photoCaptureFailed: '拍照失败'
      },
      baike: {
        title: '养护小百科',
        viewMore: '查看更多信息'
      },
      qwen: {
        sectionTitle: 'AI智能分析',
        scientificName: '🌿 学名',
        watering: '💧 浇水tips',
        lighting: '☀️ 光照tips',
        health: '🏥 健康信息',
        care: '🌱 综合养护tips',
        knowledge: '💡 小知识'
      },
      care: {
        sectionTitle: '养护要点',
        watering: '浇水',
        lighting: '光照',
        temperature: '温度',
        humidity: '湿度',
        fertilizing: '施肥'
      },
      modals: {
        deletePlantTitle: '确认删除',
        deletePlantContent: '您确定要删除 "{{name}}" 吗？此操作不可恢复。',
        deletePlantSuccess: '删除成功',
        healthAnalysisTitle: '健康分析结果',
        healthAnalysisFailTitle: '分析失败: {{message}}',
        healthAnalysisNoRecord: '暂无健康分析记录',
        savePhoto: '保存照片',
        externalLinkTitle: '外部链接',
        externalLinkContent: '小程序不支持直接打开网页，您可以复制链接后在浏览器中打开。',
        externalLinkConfirm: '复制链接'
      },
      toast: {
        photoAdded: '照片已添加',
        nameUpdated: '名称已更新',
        wateringUpdated: '浇水时间已更新',
        fertilizingUpdated: '施肥时间已更新',
        copied: '已复制'
      },
      share: {
        shareTitle: '分享我的植物：{{name}}',
        momentsTitle: '我的植物：{{name}} - 来自我的阳台花园',
        friendTitle: '来自朋友的{{name}}'
      },
      buttons: {
        deletePlant: '删除绿植'
      }
    },
    settings: {
      sections: {
        model: '模型设置',
        storage: '存储限制',
        location: '位置服务',
        data: '数据管理',
        language: '界面语言'
      },
      modelList: {
        baidu: {
          name: '百度AI植物识别',
          description: '快速识别植物种类'
        },
        qwen: {
          name: '通义千问VL',
          description: '多模态分析，提供详细养护建议'
        }
      },
      buttons: {
        testModel: '测试模型连接',
        clearData: '清除所有数据',
        saveSettings: '保存设置'
      },
      modelTest: {
        testing: '测试连接...',
        missingKey: 'API Key未配置',
        success: '配置正常'
      },
      storage: {
        maxPhotos: '每株植物最多保存照片数',
        maxRecords: '浇水/施肥记录条数'
      },
      location: {
        permission: '位置权限',
        tapToEnable: '点击开启',
        currentLocation: '当前位置',
        locationNotAvailable: '未获取位置',
        enabled: '已开启'
      },
      language: {
        description: '选择界面显示语言'
      },
      toasts: {
        settingsSaved: '设置已保存',
        photosCleaned: '已清理超出限制的旧图片',
        recordsCleaned: '已清理超出限制的旧记录',
        dataCleared: '数据已清除'
      },
      modals: {
        locationPermissionTitle: '位置权限',
        locationPermissionContent: '需要位置权限来提供更准确的养护建议，请在设置中开启',
        clearDataTitle: '清除所有数据',
        clearDataContent: '此操作将删除所有绿植记录，确定继续吗？'
      }
    },
    models: {
      progress: {
        compressing: '正在压缩图片...',
        sending: '正在发送请求到AI模型...'
      },
      defaults: {
        watering: '请根据植物特性适量浇水',
        lighting: '需要适当的光照条件',
        health: '请定期观察植物状态',
        care: '请根据植物需求进行养护',
        healthAnalysis: '请使用千问VL模型获得详细的健康分析',
        wateringSoil: '请根据土壤湿度适量浇水',
        lightingAvoid: '需要适当的光照，避免强光直射',
        temperatureRange: '适宜温度15-25°C',
        humidity: '保持适当湿度',
        fertilizing: '定期施肥，注意浓度'
      },
      errors: {
        unknownModel: '未知的模型类型',
        geminiKeyMissing: 'Gemini API Key未配置',
        networkFailed: '网络请求失败: {{message}}',
        apiRequestFailed: 'API请求失败: {{code}}',
        baiduRecognitionFailed: '植物识别失败，请尝试更清晰的图片',
        whitelistRequired: '域名不在白名单，请在微信小程序后台配置服务器域名：https://aip.baidubce.com',
        imageReadFailed: '图片读取失败: {{message}}',
        unknown: '未知错误',
        apiKeyMisconfigured: 'API密钥未正确配置',
        accessTokenFailed: '获取 access_token 失败: {{message}}',
        responseEmpty: '响应数据为空'
      },
      health: {
        location: '位置：纬度{{latitude}}，经度{{longitude}}',
        locationUnknown: '位置：未知'
      }
    },
    profile: {
      title: '用户资料',
      subtitle: '设置您的个人信息',
      avatarLabel: '头像',
      changeAvatar: '更换头像',
      nicknameLabel: '昵称',
      nicknamePlaceholder: '请输入您的昵称',
      nicknameHint: '昵称将显示在您的植物记录中',
      nicknameRequired: '请输入昵称',
      saveButton: '保存资料',
      saving: '保存中...',
      deleteButton: '删除资料',
      deleteConfirmTitle: '确认删除',
      deleteConfirmContent: '确定要删除您的用户资料吗？',
      deleteSuccess: '资料已删除'
    }
  },
  en: {
    common: {
      appTitle: '{{emoji}} My Balcony Garden',
      unknownPlant: 'Unknown Plant',
      pleaseUseNewVersion: 'Please use Base Library 2.2.3 or above to access cloud features.',
      ok: 'OK',
      cancel: 'Cancel',
      gotIt: 'Got it',
      continueAdding: 'Keep Adding',
      viewDetails: 'View Details',
      retry: 'Try Again',
      success: 'Success',
      failure: 'Failure',
      yes: 'Yes',
      no: 'No',
      notAvailable: 'Unavailable',
      loading: 'Loading...',
      saved: 'Saved',
      saveFailed: 'Save failed',
      loadFailed: 'Load failed',
      deleteFailed: 'Delete failed',
      listDelimiter: ', ',
      languageNames: {
        zh: '中文',
        en: 'English'
      },
      languages: {
        title: 'Interface Language',
        description: 'Choose the language shown in the interface'
      },
      nav: {
        settings: 'Settings',
        addPlant: 'Add Plant'
      },
      storage: {
        restoreSuccess: 'Data restored from cloud',
        restoreEmpty: 'No cloud data available',
        restoreFailed: 'Failed to restore from cloud',
        cloudUnavailable: 'Cloud features are unavailable.',
        identityFailed: 'Unable to authenticate user.',
        uploadFailed: 'Failed to upload image.',
        syncFailed: 'Cloud sync failed.'
      },
      reminder: {
        title: 'Watering Reminder',
        description: 'Set watering reminder frequency',
        frequency: {
          daily: 'Daily',
          frequent: 'Frequent (3 days)',
          occasional: 'Occasional (7 days)',
          off: 'Off'
        },
        status: {
          needsWatering: 'Little plants are thirsty! 💧',
          wateredRecently: 'Little plants are healthy! 🌱',
          noPlants: 'No plants'
        },
        lastWatering: 'Last watering',
        needsWateringTitle: 'Plants Need Watering',
        noPlantsNeedWatering: 'No plants need watering',
        neverWatered: 'Never watered',
        neverWateredCute: "Hasn't been watered yet~",
        daysAgo: '{{days}} days ago'
      }
    },
    index: {
      emptyState: {
        title: 'Your balcony garden is waiting for its first green friend.',
        tip: 'Tap the “+” button below to start logging.'
      },
      batchMode: {
        tip: 'Batch mode: tap plants to select them',
        selectedCount: '{{count}} selected',
        watering: 'Batch Watering',
        fertilizing: 'Batch Fertilizing',
        exit: 'Exit',
        historyTitle: 'Batch Operation History',
        plantCountLabel: '{{count}} plants:',
        emptyHistory: 'No batch operations yet',
        confirmWateringTitle: 'Batch Watering',
        confirmWateringContent: 'Water {{count}} selected plants?',
        confirmFertilizingTitle: 'Batch Fertilizing',
        confirmFertilizingContent: 'Fertilize {{count}} selected plants?',
        processingWatering: 'Batch watering in progress...',
        processingFertilizing: 'Batch fertilizing in progress...',
        successWatering: 'Watered {{count}} plants',
        successFertilizing: 'Fertilized {{count}} plants',
        noSelection: 'Please select plants'
      },
      historyToastEmpty: 'No batch operations yet'
    },
    add: {
      uploader: {
        title: 'Add a New Plant',
        subtitle: 'Take a lovely photo of your plant 📷'
      },
      sections: {
        recognitionInfo: 'Recognition Info',
        recognitionResult: 'Recognition Result',
        careInfo: 'Care Info'
      },
      info: {
        currentModel: 'Model:',
        modelBaidu: 'Baidu Plant Recognition',
        modelQwen: 'Qwen-VL',
        locationService: 'Location:',
        locationEnabled: 'Enabled',
        locationDisabled: 'Disabled',
        currentLocation: 'Current location:'
      },
      loading: {
        recognizing: 'Recognizing...'
      },
      qwen: {
        watering: '💧 Watering Tips',
        lighting: '☀️ Light Tips',
        health: '🏥 Health Info',
        care: '🌱 Care Tips',
        knowledge: '💡 Fun Facts'
      },
      baiduCare: {
        title: 'Care Highlights'
      },
      form: {
        lastWatering: 'Last Watering',
        lastFertilizing: 'Last Fertilizing',
        selectDate: 'Select a date'
      },
      buttons: {
        save: '🌱 Save Plant',
        recognizing: 'Recognizing...'
      },
      apiTest: {
        testing: 'Testing API connection...',
        missingKeyTitle: 'API Key Missing',
        missingKeyContent: 'Please configure the API key for {{modelName}} first.',
        successTitle: 'API Configured',
        cloudUploadFailedTitle: 'Cloud Upload Failed',
        cloudUploadFailedContent: 'Only local storage is available; the photo will not appear in the cloud.',
        cloudUnavailableTitle: 'Cloud Unavailable',
        cloudUnavailableContent: 'Unable to upload to cloud storage. The photo will stay on this device.'
      },
      recognition: {
        preparingImage: 'Preparing image...',
        connectingModel: 'Connecting to AI model...',
        analyzing: 'Analyzing plant features...',
        processing: 'Processing recognition result...',
        failedTitle: 'Recognition Failed',
        failedContent: 'Plant recognition failed. Continue adding the plant?\n\nDetails:\n{{error}}',
        continueAddingTitle: 'You can continue adding the plant',
        fullErrorTitle: 'Error Details',
        errorLabels: {
          model: 'Model',
          message: 'Error Message',
          type: 'Error Type',
          full: 'Full Error'
        },
        errorPlaceholder: 'Unknown error',
        selectImageFirst: 'Please select an image first',
        recognizingWait: 'Recognition in progress, please wait',
        successModalTitle: '🌱 Added Successfully!'
      }
    },
    detail: {
      image: {
        setCover: 'Set as Cover',
        delete: 'Delete',
        addMemo: '📝 Add Memo',
        memoPlaceholder: 'Add a memo...',
        memoSave: 'Save',
        memoCancel: 'Cancel',
        memoSaved: 'Memo saved',
        alreadyCover: 'Already the cover',
        setCoverSuccess: 'Cover updated',
        keepAtLeastOne: 'Keep at least one photo',
        deleteConfirmTitle: 'Delete Photo',
        deleteConfirmContent: 'Delete this photo?',
        deleteSuccess: 'Photo deleted',
        firstImage: 'This is already the first photo',
        lastImage: 'This is already the last photo',
        orderUpdated: 'Photo order updated',
        limitReached: 'You can keep up to {{count}} photos',
        coverBadge: 'Cover'
      },
      history: {
        titleWatering: 'Watering History',
        titleFertilizing: 'Fertilizing History',
        titleHealth: 'Health Analyses',
        none: 'No records',
        viewDetails: 'View details',
        updateWatering: '💧 Update Watering',
        updateFertilizing: '🌱 Update Fertilizing',
        takePhoto: '📷 Take a Photo',
        noHealth: 'No health analyses yet',
        recordUnit: ' entries',
        analysisUnit: ' analyses'
      },
      info: {
        recordedAt: 'Recorded At',
        healthAnalysis: 'Health Analysis',
        noAnalysis: 'No analysis yet'
      },
      status: {
        loadingShare: 'Loading shared plant...',
        analyzingHealth: 'Analyzing health...',
        shareFromFriend: 'From a friend: {{name}}'
      },
      errors: {
        missingId: 'Plant ID is missing',
        plantNotFound: 'Plant not found',
        shareLoadFailed: 'Unable to load shared plant',
        shareExpired: 'This share has expired or was removed',
        loadFailed: 'Failed to load',
        nameRequired: 'Name cannot be empty',
        photoCaptureFailed: 'Failed to take photo'
      },
      baike: {
        title: 'Care Encyclopedia',
        viewMore: 'View more'
      },
      qwen: {
        sectionTitle: 'AI Insights',
        scientificName: '🌿 Scientific Name',
        watering: '💧 Watering Tips',
        lighting: '☀️ Light Tips',
        health: '🏥 Health Info',
        care: '🌱 Care Tips',
        knowledge: '💡 Fun Facts'
      },
      care: {
        sectionTitle: 'Care Highlights',
        watering: 'Watering',
        lighting: 'Light',
        temperature: 'Temperature',
        humidity: 'Humidity',
        fertilizing: 'Fertilizing'
      },
      modals: {
        deletePlantTitle: 'Delete Plant',
        deletePlantContent: 'Delete "{{name}}"? This action cannot be undone.',
        deletePlantSuccess: 'Plant deleted',
        healthAnalysisTitle: 'Health Analysis',
        healthAnalysisFailTitle: 'Analysis failed: {{message}}',
        healthAnalysisNoRecord: 'No health analyses yet',
        savePhoto: 'Save Photo',
        externalLinkTitle: 'External Link',
        externalLinkContent: 'Mini Programs cannot open web pages directly. Copy the link and open it in a browser.',
        externalLinkConfirm: 'Copy Link'
      },
      toast: {
        photoAdded: 'Photo added',
        nameUpdated: 'Name updated',
        wateringUpdated: 'Watering time updated',
        fertilizingUpdated: 'Fertilizing time updated',
        copied: 'Copied'
      },
      share: {
        shareTitle: 'Check out my plant: {{name}}',
        momentsTitle: 'My plant: {{name}} - from My Balcony Garden',
        friendTitle: 'From a friend: {{name}}'
      },
      buttons: {
        deletePlant: 'Delete Plant'
      }
    },
    settings: {
      sections: {
        model: 'Model Settings',
        storage: 'Storage Limits',
        location: 'Location Services',
        data: 'Data Management',
        language: 'Language'
      },
      modelList: {
        baidu: {
          name: 'Baidu Plant Recognition',
          description: 'Quickly identify plant species'
        },
        qwen: {
          name: 'Qwen-VL',
          description: 'Multi-modal analysis with detailed care tips'
        }
      },
      buttons: {
        testModel: 'Test Model Connection',
        clearData: 'Clear All Data',
        saveSettings: 'Save Settings'
      },
      modelTest: {
        testing: 'Testing connection...',
        missingKey: 'API key not configured',
        success: 'Configuration OK'
      },
      storage: {
        maxPhotos: 'Max photos per plant',
        maxRecords: 'Watering/Fertilizing history limit'
      },
      location: {
        permission: 'Location Permission',
        tapToEnable: 'Tap to enable',
        currentLocation: 'Current Location',
        locationNotAvailable: 'Location not available',
        enabled: 'Enabled'
      },
      language: {
        description: 'Choose the interface language'
      },
      toasts: {
        settingsSaved: 'Settings saved',
        photosCleaned: 'Removed extra photos beyond the limit',
        recordsCleaned: 'Removed extra records beyond the limit',
        dataCleared: 'Data cleared'
      },
      modals: {
        locationPermissionTitle: 'Location Permission',
        locationPermissionContent: 'Enable location access for more accurate care advice.',
        clearDataTitle: 'Clear All Data',
        clearDataContent: 'This will delete all plant records. Continue?'
      }
    },
    models: {
      progress: {
        compressing: 'Compressing image...',
        sending: 'Sending request to the AI model...'
      },
      defaults: {
        watering: 'Water the plant according to its needs.',
        lighting: 'Ensure the plant receives appropriate light.',
        health: 'Check the plant regularly.',
        care: 'Care for the plant based on its requirements.',
        healthAnalysis: 'Use the Qwen-VL model for detailed health analysis.',
        wateringSoil: 'Water according to the soil moisture level.',
        lightingAvoid: 'Provide suitable light and avoid harsh direct sunlight.',
        temperatureRange: 'Ideal temperature: 15-25°C.',
        humidity: 'Maintain moderate humidity.',
        fertilizing: 'Fertilize regularly and watch the concentration.'
      },
      errors: {
        unknownModel: 'Unknown model type',
        geminiKeyMissing: 'Gemini API key is not configured.',
        networkFailed: 'Network request failed: {{message}}',
        apiRequestFailed: 'API request failed: {{code}}',
        baiduRecognitionFailed: 'Plant recognition failed. Please try a clearer photo.',
        whitelistRequired: 'The domain is not whitelisted. Add https://aip.baidubce.com in the Mini Program console.',
        imageReadFailed: 'Failed to read image: {{message}}',
        unknown: 'Unknown error',
        apiKeyMisconfigured: 'The API key is not configured correctly.',
        accessTokenFailed: 'Failed to get access token: {{message}}',
        responseEmpty: 'Response is empty'
      },
      health: {
        location: 'Location: Latitude {{latitude}}, Longitude {{longitude}}',
        locationUnknown: 'Location: Unknown'
      }
    },
    profile: {
      title: 'User Profile',
      subtitle: 'Set your personal information',
      avatarLabel: 'Avatar',
      changeAvatar: 'Change Avatar',
      nicknameLabel: 'Nickname',
      nicknamePlaceholder: 'Enter your nickname',
      nicknameHint: 'Your nickname will be shown in your plant records',
      nicknameRequired: 'Please enter a nickname',
      saveButton: 'Save Profile',
      saving: 'Saving...',
      deleteButton: 'Delete Profile',
      deleteConfirmTitle: 'Confirm Delete',
      deleteConfirmContent: 'Are you sure you want to delete your user profile?',
      deleteSuccess: 'Profile deleted'
    }
  }
};

let currentLanguage = 'zh';

function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
  } else {
    currentLanguage = 'zh';
  }
}

function getLanguage() {
  return currentLanguage;
}

function getValue(lang, namespace, keyPath) {
  const langData = translations[lang] || {};
  const section = langData[namespace] || {};
  if (!keyPath) {
    return section;
  }
  const keys = keyPath.split('.');
  let current = section;
  for (const key of keys) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(target = {}, source = {}) {
  const result = { ...target };
  Object.keys(source).forEach(key => {
    const targetValue = target[key];
    const sourceValue = source[key];
    if (isObject(targetValue) && isObject(sourceValue)) {
      result[key] = mergeDeep(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  });
  return result;
}

function getSection(namespace, lang) {
  const activeLang = lang || currentLanguage;
  const fallback = getValue('zh', namespace);
  const active = getValue(activeLang, namespace);
  if (isObject(fallback) || isObject(active)) {
    return mergeDeep(fallback, active);
  }
  return active !== undefined ? active : fallback;
}

function format(template, params = {}) {
  if (typeof template !== 'string') {
    return template;
  }
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmed = key.trim();
    return params[trimmed] !== undefined ? params[trimmed] : '';
  });
}

function t(namespace, keyPath, params = {}, lang) {
  const activeLang = lang || currentLanguage;
  const value = getValue(activeLang, namespace, keyPath);
  if (value !== undefined) {
    return format(value, params);
  }
  const fallbackValue = getValue('zh', namespace, keyPath);
  return format(fallbackValue, params) || '';
}

function getLocale() {
  return currentLanguage === 'en' ? 'en-US' : 'zh-CN';
}

module.exports = {
  setLanguage,
  getLanguage,
  getSection,
  t,
  format,
  getLocale,
  translations
};
