# 水量记录

一个轻量、无前端框架依赖的每日喝水记录网页应用。它可以记录每日饮水量、计算个人目标、展示 7 天趋势，并在本地服务模式下通过系统通知提醒喝水。

## 功能特性

- 快速记录常用饮水量，也支持自定义毫升数。
- 按日期查看、删除和清空当天饮水记录。
- 根据性别、体重、运动、高温、孕期/哺乳期或手动目标计算每日饮水建议。
- 显示今日进度、剩余量、超标量和不同状态颜色。
- 展示最近 7 天柱状趋势和目标参考线。
- 可配置提醒开始时间、结束时间和提醒间隔。
- 支持本地系统通知：macOS、Windows、Linux。
- 数据保存在浏览器 `localStorage`，不依赖数据库。

## 技术架构

- `index.html`：页面结构。
- `styles.css`：视觉样式、响应式布局和动画。
- `app.js`：饮水记录、目标计算、趋势图、提醒计划和前端状态。
- `server.js`：本地静态服务和跨平台系统通知接口。
- `assets/`：图标和水杯 SVG 资源。

前端为纯 HTML/CSS/JavaScript。系统通知通过本地 Node.js 服务实现：

- macOS：`osascript display notification`
- Windows：`powershell.exe` + `System.Windows.Forms.NotifyIcon`
- Linux：`notify-send`

## 本地运行

推荐使用本地服务模式，以启用系统通知：

```sh
node server.js
```

然后访问：

```text
http://127.0.0.1:8787/
```

仅查看基础页面也可以直接打开 `index.html`，但系统通知不可用或不稳定。

## 开发检查

运行语法检查：

```sh
node --check app.js
node --check server.js
```

手动测试建议：

- 添加、删除、清空饮水记录。
- 切换日期并返回今天。
- 修改目标和提醒配置。
- 刷新页面确认数据保留。
- 在本地服务地址中开启通知并等待提醒触发。

