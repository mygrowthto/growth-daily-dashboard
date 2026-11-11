# 项目报告

## 已完成内容

- 3 天日报数据工作台与按日切换；
- 指标自动重算与原始值差异标记；
- 播放与触达指数趋势图；
- 四段转化漏斗；
- 话术版本加权对比；
- 自动异常与数据质量提示；
- 指标口径和数据边界说明；
- 桌面与手机响应式布局；
- 零依赖本地静态服务器；
- 计算、数据、图表与服务器测试。

## 验证结果

```text
node --test
tests 24
pass 24
fail 0
```

浏览器验证：

- 手机视口：390 x 844。
- 桌面视口：1440 x 900。
- 页面级横向溢出：无。
- 日期切换：通过。
- 8 月 1 日转化率重算：4.3% -> 6.3%。
- 8 月 2 日流量承接预警：播放 +62.3%，触达 +27.7%。
- 话术版本加权回复率：A 5.9%，B 7.6%。
- 浏览器控制台 error：0。

## 启动

在线演示：https://mygrowthto.github.io/growth-daily-dashboard/ （备用：https://growth-daily-dashboard.app.workbuddy.host/?sharecode=DASKOPVRPM ）。`127.0.0.1` 仅本机可访问。

默认端口：

```powershell
npm start
```

```text
http://127.0.0.1:4173
```

端口被占用时：

```powershell
$env:PORT=4174
npm start
```

```text
http://127.0.0.1:4174
```

## 运行测试

```powershell
npm test
```

## 发布前检查

- 确认公司信息、医生账号、用户聊天记录和内部截图已脱敏。
- 确认所有公开数据都经过授权。
- 运行 `npm test`。
- 运行一次手机和桌面浏览器检查。
- 上传到 GitHub 仓库根目录。
- 在 GitHub Pages 选择 `master` 分支和根目录发布。
