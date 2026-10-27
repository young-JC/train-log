# 推荐直达接口

用户已在本次会话明确回复“同意”，授权推荐模板（含 Readiness 和疼痛注意事项）默认同步到本人私有随练站点。两套推荐 skill 使用同一协议；实际训练和手机草稿仍在本机。

授权范围：每次推荐生成后，将该次的动作候选、剂量、周期/槽位、Readiness 原始值及疼痛/停止注意事项，发送到现有本人私有随练站点 `https://suilian-training-recorder.aqua-wood-0631.chatgpt.site` 的推荐收件箱（Sites R2）。实际训练重量、组次、反馈、手机草稿及正式历史不在上传范围内。

## 实现

- `worker/handler.mjs`：`POST /api/recommendations` 校验标准推荐后保存按日模板；同内容重试幂等；`GET /api/recommendations/latest?asOf=YYYY-MM-DD` 排除未来日期并禁用缓存。部署后由 Sites 私有站点认证保护。
- `dist/app.js`：联网打开、回到前台或点“同步推荐”时读取模板。只有今日且本机没有同日草稿时自动生成待填写卡片；已有草稿只提示查看，不覆盖实绩；过期推荐要求核对日期。读请求不上传手机内容。
- `tools/push_training_recommendation.js`：文件参数只指向推荐 JSON，Sites get_site 返回对象经隐藏 stdin 输入；校验本人私有权限后推送，凭据不写入文件、命令行或前端，不跟随重定向。
- `scripts/build-worker.mjs`：仅将工具静态资源嵌入无依赖 Worker，生成忽略的 `dist/server/index.js` 和部署配置。模板与草稿不进代码包。原项目 id 不变，R2 绑定为 BUCKET。

## 验证

```powershell
node tools/test_training_recorder.js
node tools/test_training_recorder_sync.mjs
python tools/verify_training_recorder_browser.py
```

全部测试使用虚构数据和本地假存储/接口，不向线上上传测试推荐。覆盖更新、幂等、排除未来日期、缺少服务凭据/私有权限、已有草稿保护、新设备自动生成空白卡片、离线恢复与原有导入导出。

操作协议与凭据处理见 [FORMAT.md](FORMAT.md) 的“站点直达推荐”。成功时仅返回简短状态和网址；失败保留 JSON 文件备用，默认不再让用户经微信传长 JSON。不得凭本地文件保存成功宣称远端已同步。
