# MyFlower - Flower Memos tool

## What does it do?
- Keep track of your garden's state, including:
  - Automatic plant recognizing
  - Analyzed tips for watering, giving light and fertilizing your plant
  - Update your plant's healthy status
  - Summarized caring tips for you plant
  - Fun facts about your plant
  - Batch operations for watering and fertilizing
  - Image management with memos and ordering
  - Plant sharing to WeChat friends and moments
  - Share Landing page and Home Friends strip

## How does it work?
- Using the API of the model qwen-vl-max to analyze your plant
- Support for both Baidu AI and Qwen-VL models
- Cloud storage integration for data synchronization
- Location-based personalized care suggestions

## Features
- **Plant Recognition**: Automatic identification using AI models
- **Care Tracking**: Record watering and fertilizing schedules
- **Health Analysis**: AI-powered plant health assessment
- **Batch Operations**: Manage multiple plants simultaneously
- **Image Management**: Organize photos with memos and custom ordering
- **Sharing**: Share plant information with friends via WeChat, with a dedicated Share Landing and a Home “Friends” strip
- **Cloud Sync**: Data synchronization across devices

## Get Started
- This **WeChat Mini-Program** is already published on the list called 阳台森友. 
- It provides English and Chinese. 

## Issues
The list of known issues are [here](https://github.com/J-K-hhh/myflower/issues)

## Support
You can ask for help in:
* [MyFlower Discord Server](https://discord.gg/MnR7Xmb8wP)

## License
This program is licensed under the ISC License.

## New: Share Landing + Friends (M1)

- Share Landing: recipients of a WeChat forward open a dedicated page highlighting the cover image, latest status (watering/fertilizing), memo summary, and lightweight interactions (local likes/comments).
- Home Friends Section: once you tap `关注到我的首页` on a shared plant, a horizontal strip appears on the Home page showing up to 10 followed shares from the recent 14 days, with quick entry back to the landing page.
- Forward path and deep links: `pages/share/landing?owner=<openid>&pid=<id>&from=wxcard&scene=forward`.

How to test locally (DevTools):
- Detail page → Share → send to another account; or manually open the deep link with `owner=<your openid>&pid=<plant id>`.
- On the landing page, tap `关注到我的首页` to follow; the Home page shows the Friends strip after returning.
- Comments/likes are stored locally for M1; backend models (Share/Follow/Activity) can be added in later milestones.
