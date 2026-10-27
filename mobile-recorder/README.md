# 随练 · train2.0 手机训练记录器

推荐 skill 默认将模板直接同步到本人私有站点，手机联网打开即可获取。数据范围与接口说明见 [SYNC.md](SYNC.md)。手动 JSON 文件导入仍可备用。

无前端依赖的 PWA，重点支持 iPhone。浏览器源码位于 `dist/`，部署时用标准库脚本打包为轻量 Worker，通过 R2 接收推荐模板。填写内容仅存当前设备的 IndexedDB，新建草稿不改写训练仓库。

## 使用

1. 让 `recommend-training-2` 推荐训练，skill 自动同步模板到本人私有随练站点。
2. 联网打开随练或点“同步推荐”，今日无草稿时直接生成卡片；已有草稿保留，使用新版模板需主动确认重建。
3. 收尾确认整体训练状态、总时长、Session RPE、Readiness 和疼痛。
4. 复制记录或保存 Markdown，交给 `record-training-2` 正式入库。

iPhone 用 Safari 打开部署网址，通过分享菜单“添加到主屏幕”。从桌面联网打开一次，确认“离线已就绪”后再离线使用。应用更新只删除旧静态缓存，不删除草稿。

同日导入默认继续原草稿；主动重建才覆盖。JSON 文件可备份、恢复和跨设备转移。无痕窗口、清理网站数据或卸载可能丢失浏览器数据；浏览器与主屏幕应用的数据可能不同，请固定入口并备份。

## 更新与返回首页

已安装旧版但看不到变化时，直接打开同一站点的 `update.html`。这个入口绕过旧版页面缓存，检查新版并切换；不会清理 IndexedDB、登录或其他网站数据。新版顶部出现“保存并更新”后可直接使用，页面底部显示当前版本并保留更新入口。每次发布根据工具内容自动生成版本和缓存标识，不依赖手工修改版本号。

左上角图标只在页面内返回首页，不跳转网址；可以用“继续填写当前草稿”回到原记录。

## 本地验证

在仓库根目录运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory mobile-recorder/dist
node tools/test_training_recorder.js
python tools/verify_training_recorder_browser.py
git diff --check
```

本地网址 `http://127.0.0.1:8765/` 支持 Service Worker 开发验证；普通静态服务器没有推荐接收接口，可手动文件导入。直接双击 `dist/index.html` 支持基本填写和导出，安装及离线缓存需要 HTTPS/localhost。

接口、示例和 skill 边界见 [FORMAT.md](FORMAT.md)。代码发布只包含独立工具，不打包档案、训练历史、手机草稿或推荐数据；推荐由私有 API 单独存入 R2。原 Sites project_id 保留，R2 绑定为 BUCKET。运行 `node mobile-recorder/scripts/build-worker.mjs` 生成忽略的 Worker 输出，再按 Sites 流程打包发布；升级保留 R2 和手机 IndexedDB。
