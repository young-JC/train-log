# 报告数据规范

在仓库根目录运行 `python tools/training_review.py draft --type weekly --start 2026-09-28 --end 2026-10-04`，得到完整草稿 JSON。阶段使用 `stage` 与完整 28 天区间。工具仅使用 Python 标准库，不参与浏览器运行。

用文件工具将 JSON 写入工作区临时文件，填完再 `save --input <文件>`。不要直接保存空草稿，不要在 shell 中插值 JSON。临时文件处理完可删除；正式报告无需保留输入 JSON。

## 草稿中由工具确定的字段

- `id`：`周期起点-type-start-end`，同时为 Markdown 文件名；同周期、类型与区间只有一个标识。
- `cycleStart` / `type` / `start` / `end`：目前仅支持正式起点 2026-09-21 和 3 日版；weekly 对齐 7 天，stage 对齐 28 天。
- `generatedAt` / `updatedAt`：ISO 8601，带 `+08:00`，首次由工具取实际上海时间。重跑使用本次实际时间，save 保留最初 generatedAt；不能伪造早期生成时间使报告影响历史推荐。
- `dataThrough`：截止日，完整报告为区间结束日；进展为今天（不超区间）。区间结束日当晚仍属于进展，从次日可生成完整报告。“完整”仅指区间结束，不表示数据齐全。
- `status`：`complete` / `progress`。`applicability`：完整周为下一周，完整阶段为下一阶段（均不超 W12）；进展和 W12 后为 null，不自动开始新周期。
- `stats`：整个统计输出对象，包括逐条正式记录、原始文本、警告、缺失日期和覆盖率。`sources`：区间内详情的 SHA-256 指纹。两者必须原样保留；不能把缺失或不一致值手工改成有效值。
- `profileUpdatedAt`：使用的个人档案日期，缺失为“未记录”。如使用身体测量，另在 findings/gaps 注明测量日期、方法与可比性。

## AI 必须核对并补全的字段

- `summary`：非空总结，区分已证实、待观察和无法判断。空数据时明确无记录，不能编造成绩。
- `execution`：保留草稿中的全部 W/D 槽位，各槽位包含 `week`、`slot`、`status`、`dates`、`note`。status 为 `complete`、`partial`、`no-record`、`not-completed` 或 `unknown`；完整/部分/明确未完成必须有日期证据。note 解释补做、适配、未记录模块或归属疑点。未结束周未来槽位使用 unknown 并说明尚未到期，不写成未完成。
- `extraSessions` / `findings` / `decisions`：列表，每项为 `{"text":"有依据的描述", "dates":["YYYY-MM-DD"]}`。extraSessions 在文字中注明恢复、额外实战或其他类型；decisions 用“保留：”“调整：”“暂缓：”开头并给出原因和验证指标。dates 只能来自本报告 sources；区间外基线、个人资料或身体测量以 text 中明确路径/日期注明，不伪装为区间内证据。
- `gaps`：文字列表，说明缺失字段、测试条件、目标成绩等。只有确无缺口时才可为空；统计覆盖率不足必须解释。

完整完成率由工具计算 `complete 槽位数 / 全部计划槽位数`，partial 不折算。无记录不是明确未训练。工具不判断归属、动作进步或弱点改善，AI 必须回看正式记录。

## 保存与刷新

`save` 校验元数据与统计来源，生成可读 Markdown 正文和隐藏 `review-data` JSON 块（报告的结构化内容）。两者由同一对象生成；修改报告时重新走 draft/save，不手改正文或镜像。`verify` 检查正文/结构块、索引、JS 一致。

`sync` 只重算当前正式记录指纹、索引和 JS 镜像；不重新分析或改写报告。正式记录补录、纠错后由记录技能运行 sync；区间内来源有变化时显示待刷新，包括新增和移除的日期。

`due --as-of YYYY-MM-DD` 列出已结束但未复盘/待刷新的周与阶段；`applicable --date YYYY-MM-DD` 直接从 Markdown 选择推荐日期可用的阶段/周报告，排除进展、待刷新、过期，以及该日期之后才生成或更新的版本。输出为空时继续既有推荐流程，不要求为了推荐先补做复盘。

后续推荐必须检查报告的当时依据与当前档案/实际表现，阶段结论提供重点，周结论调整执行恢复；冲突时不叠加刺激，采取符合当前约束的较保守方案，并说明取舍。
