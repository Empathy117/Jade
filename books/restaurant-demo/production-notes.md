# 《要求特别多的餐厅》制作记录

> Production mode: Agent-assisted
> Source revision: 1
> Paragraphs: 149
> Scenes: 7
> Playback cues: 8
> Staging: direction/playback v2（ADR-0004 试点）；visual_novel 档位，scene_006 为 ADR-0005 垂直切片

## 自动或机械完成

- TXT 以原始字节保存并计算 SHA-256；
- 149 个文本块生成稳定 paragraph ID；
- JSON Schema、原文身份、scene 覆盖、cue 顺序和素材引用由 validator 检查；
- 背景、音乐和环境音由 Runtime 按独立状态通道执行；
- 三首音乐完成格式统一、响度处理和循环可用性检查；
- 全套前端测试、Python 测试和生产构建自动执行。

## Agent 完成但需要审美判断

- 将全文划分为 7 个语义场景；
- 为每个场景确定地点、时间、天气、mood 和 tension；
- 生成 6 张风格一致的背景图；
- 搜索、筛选并处理 3 首 CC0 音乐；
- 制作 2 条低音量环境音；
- 编排 8 个 playback cue，并决定背景、音乐、环境音和清屏时机。

## 用户明确反馈与修改

- 单击逐段推进被确认为最重要的体验增益，保留为核心交互；
- 新段落过于贴近底部渐隐区，增加底部视觉安全区；
- 回看正文不方便，增加可滚动且可跳转的阅读历史；
- 第一版程序合成音更像音效而非音乐，替换为三首真实旋律/电影感 BGM；
- 音乐替换后复测确认体验进一步改善；
- 项目定位确认为个人阅读工具，接受单用户体验闸门。

## v2 运镜试点（2026-09-28）

本书是 ADR-0004 的第一本试点，镜头、调色和关键时刻均由 Agent 手工编译。

**素材约束。** 六张背景都是 1672×941，在常见桌面视口上只有约 1.15 倍的推近
余量，因此统一登记 `min_scale_headroom: 1.15`，全书只用 `wide / medium`
取景，没有特写。要做 `close / detail` 需先重出更高分辨率的背景。

**焦点区域。** 看图后逐张标注：深山小径 `path`、山谷 `valley`、餐厅正门
`entrance`、走廊尽头 `far_door`、准备室的门 `door` 与镜子 `mirror`、最后
那扇门的门缝 `door_gap`、黎明山谷 `valley`。

**手工编译规则**（供将来 Compiler 参考）：

- 取景到缩放：`wide` 1.0，`medium` 1.05–1.08，推近终点不超过余量 1.15；
- 焦点到 x/y：取焦点矩形中心 `(cx, cy)`，`x = (cx − 0.5) × 2`、
  `y = (cy − 0.5) × 2`；
- `push_in` 在该镜头区间末端落关键帧，区间起点再放一个保持帧，使推近只发生
  在镜头覆盖的段落里；
- 同一背景跨场景时（蓝色走廊贯穿 scene_003–004），镜头连续推进不归位。

**调色。** 五档，随张力从暖到冷、饱和度逐步降低：`dusk → lamplight →
unease → dread → dawn`。每档都很淡（shade 0.08–0.32），只在场景切换时以
2.4 秒过渡。

**关键时刻。** 全篇没有章节标题，按克制规则整本书只能有 2 个：

- p0042 `letterbox_hold`（intent `threshold`）：门上第一次写出“要求很多”，
  也是书名本身出现的地方——踏进圈套的门槛。停顿 1.2 秒；
- p0118 `isolate_line`（intent `threat`）：钥匙孔里的青色眼睛，全篇视觉高点。
  压暗 0.6、模糊 8px、停顿 1.8 秒。

放弃的候选：p0102“最后一项要求”（与 p0118 仅隔 16 段，且恐惧已由
`final-door-tension` 的音乐切换承担）、p0137 房间消失（背景与调色切换本身已
足够，再加 `flash_cut` 会过火）。

**实际阅读验证。** 在真实 Reader 中从头读到尾：镜头随翻页推进；换背景时镜头
归位；两个关键时刻各触发一次；停顿吃掉第一次翻页；往回翻不重放。上下黑边
最初在暗背景上几乎看不见，已为 Runtime 加上细亮线。

## 视觉小说垂直切片：钥匙孔（2026-09-28）

依据 ADR-0005，本书切换到 `visual_novel` 档位，但只有 scene_006（p0113–p0136）
按视觉小说密度制作，其余场景保持原样，便于对比两种体验。

**这一幕的演出清单**

| 锚点 | 演出 |
|---|---|
| p0113 | 进入底部对话框版式；背景横向擦除进场；灰尘粒子、灯光不稳 |
| p0118 | CG「钥匙孔里的眼睛」圆形展开；上下黑边与 1.8 秒停顿；心跳音与暗红心跳暗角 |
| p0119 | 震屏（中）；这一行字剧烈颤抖 |
| p0120 | 字继续颤抖；CG 到此结束 |
| p0122 | 门后低语 |
| p0129 | CG「揉皱的面纸」横向擦入；字轻微颤抖 |
| p0130 | 吃吃笑声 |
| p0134 | 破门声，180ms 后狗吠；震屏（强） |
| p0135 | 低吼，1.4 秒后门被冲开；震屏（轻） |
| p0136 | 喵——嗷——，1.9 秒后沙沙声 |
| p0137 | 回到全屏文字，粒子与闪烁关闭 |

原 p0118 的 `isolate_line` 改为 `letterbox_hold`：压暗会把 CG 一起压黑，而黑边
正好给 CG 加上电影画幅。

**CG 取舍。** 用户暂不做角色立绘，所以第二张 CG 不画两位绅士的脸，而画原文
自己的比喻——一张被揉皱的面纸。

**占位素材。** 两张 CG 由 `scripts/render_restaurant_cgs.py` 程序绘制，九个音效由
`scripts/generate_restaurant_sfx.sh` 合成，都只是为了把节奏和时机先跑通。心跳、
破门、门响、沙沙声的合成版尚可；狗吠、猫叫、笑声、低语明显是合成音，必须替换。

### 正式 CG 生图 prompt

规格：16:9，至少 2560×1440，JPEG；生成后以同名文件覆盖 `assets/cg/` 下的占位
图，再运行 `just hash-assets books/restaurant-demo && just validate books/restaurant-demo`。
与本书六张背景同一画风：写实偏绘画、低照度、暖色壁灯与冷色阴影。

`keyhole-eyes.jpg`

```
Cinematic painterly illustration, dark and quiet, same style as a moody realistic
matte painting. Extreme close-up of an old heavy wooden door in a Western-style
restaurant hidden in a Japanese mountain forest, early 1920s. On the door, two
large old-fashioned keyholes side by side, each set in a tarnished brass
escutcheon; above them, a silver fork and a silver knife carved in relief into
the wood. Inside each keyhole, a single glowing pale-blue eye looks out,
glancing sideways, wet and alive, the only saturated colour in the frame.
Warm dim light from an unseen wall sconce on the left, deep umber shadows, faint
dust in the air. Unsettling but restrained, no gore. No text, letters, signature
or watermark. 16:9 wide, 2560x1440.
```

`crumpled-paper.jpg`

```
Cinematic painterly still life, dark and quiet. A single sheet of thin white
tissue paper that has been crushed in a fist and half smoothed out again, filling
the whole frame, every crease sharp. Cold blue-grey light rakes across it from a
narrow door gap on the upper left, leaving deep shadows in the folds. The paper
subtly suggests the texture of a trembling, crumpled face without depicting any
face, eyes or mouth. Muted palette of pale grey, bone white and slate blue,
heavy vignette. No text, letters, signature or watermark. 16:9 wide, 2560x1440.
```

### 待替换的真实音效

优先 CC0 或公有领域录音；每条都要登记来源页、授权与处理说明。

| 文件 | 需要的声音 |
|---|---|
| `dog-bark.mp3` | 大型犬两声粗重吠叫，近距离、室内 |
| `cat-yowl.mp3` | 猫在黑暗中拉长的嚎叫「喵——嗷——」，尾音带咕噜 |
| `giggle.mp3` | 两三个人隔着门压低嗓子的吃吃笑声，闷、短 |
| `whisper.mp3` | 隔着门的几人窃窃私语，听不清词句 |
| `growl.mp3` | 两只大狗低沉的呜呜低吼 |
| `door-crash.mp3` | 木门被猛力撞开、门板砸墙 |
| `door-bang.mp3` | 另一扇门「啪」地被冲开 |
| `heartbeat.mp3` | 缓慢的心跳两下，低频为主 |
| `rustle.mp3` | 黑暗中草丛或布料的沙沙声 |

## 仍需人工判断

- 一首曲子是否“好听且适合长期阅读”无法只靠技术指标判断；
- 背景画风的一致性和对故事气质的贴合需要看图确认；
- scene 边界、清屏和音乐切换是否抢注意力需要实际完整阅读；
- 下载素材的授权页面与 attribution 仍需逐项核对；
- 同一地点应复用旧图还是生成新的时间/天气变体，需要结合叙事重要性决定；
- 关键时刻选哪两处、镜头推向哪个焦点，仍是逐场看图、读文后的判断。

## 暂不自动化

- 不从一本文本直接提炼通用 Asset Matcher 权重；
- 不用固定分数替代音乐试听和画面审美；
- 不在素材库规模很小时实现无人值守上传流程；
- 不让 Runtime 猜测缺失的导演或播放信息。

## 跨书观察候选

制作后续书籍时重点记录：

1. location ID 合并是否反复耗时；
2. 背景、音乐和环境音标签是否出现稳定词表；
3. 哪些场景类型总能直接复用素材；
4. BGM 响度、循环和格式处理是否完全机械；
5. 哪些 playback 决定连续三本书都遵循同一规则。

同一种人工判断至少跨三本书重复出现后，再考虑提取为自动 Director、Matcher
或 Compiler 规则。
