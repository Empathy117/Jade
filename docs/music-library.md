# 私人音乐库索引

制书选 BGM 时的参考目录。它只是一个**参考**：先按场景确定真正需要的音乐，
库里有最合适的就用；库里只有“勉强能用”的，宁可在 `production-notes.md` 里写下
想要的曲目，由用户扩充音乐库后再补，也不凑合。

## 位置与边界

| 项目 | 位置 | 是否入 git |
|---|---|---|
| 音乐文件 | `~/Library/CloudStorage/OneDrive-个人/MusicLibary`（可用 `JADE_MUSIC_LIBRARY` 覆盖） | 否 |
| 索引 | `music/library.local.json` | 否（gitignored） |
| 索引镜像 | `<音乐库>/jade-music-index.json`，随 OneDrive 同步，防止策展信息丢失 | 否 |
| 扫描工具 | `scripts/index_music_library.py` | 是 |
| 整理记录 | `music/organize-<日期>.local.json`：整理时的旧→新路径映射 | 否（gitignored） |

库里的录音都是用户的个人副本（商业原声、流媒体下载、视频站音轨），授权未经独立核实：

- 只能用于 `books/local/` 下的私人书籍，**绝不进入入库的书籍包**；
- 登记到 `assets.json` 时沿用既有写法：`license` 写
  `User-supplied local recording; rights not independently verified. Private local reading only.`，
  `source` 写 `User music library: <索引里的 path>`，`attribution` 写作曲/演奏者；
- 库文件是原件，制书时转码、响度统一、剪循环点都在书籍目录的副本上做，不回写音乐库。

## 目录结构

```text
MusicLibary/
├── 古典 Classical/        # 西方古典，作品名 - 作曲家
├── 影视 Film & TV/        # 电影、剧集原声
├── 游戏 Game/             # 游戏原声
│   └── 只狼 Sekiro OST/   # 整张专辑（含 ダイアログ 对白曲）
├── 国风 Chinese/          # 民乐、古琴古筝，以及华语影视/游戏配乐
├── 流行 Pop & R&B/        # 有唱词的流行/R&B 歌单（少量爵士器乐）
└── jade-music-index.json # 索引镜像
```

新增曲目放进对应分类目录即可，文件名用 `曲名 - 艺术家.扩展名`。然后运行：

```sh
just index-music          # 重扫；已有策展字段按路径或“大小+时长”指纹保留
just check-music          # 列出 curation: pending 的新曲目与不合词表的标签
```

扫描不会触发 OneDrive 下载：仅在云端的占位文件照样登记（策展字段照常保留），
但时长等技术字段为空，并标 `"probe": "cloud-only"`；文件下载到本机后再扫一次即补齐。
需要试听或转码某首曲目时，在 Finder 里对它选“始终保留在此设备上”即可。

## 扩充音乐库：从网易云音乐或 Apple Music 下载

库里缺合适的曲目时，可以用用户本机的两个下载工具补充。它们都用**用户自己的账号**，
下载的录音与库中其他曲目一样：授权未经独立核实，只用于 `books/local/` 下的私人书。

| 工具 | 位置 | 适用 |
|---|---|---|
| 网易云音乐 | `~/ncm-dl/ncm_dl.py` | 首选；单曲、专辑、歌单；默认 320k MP3，对阅读 BGM 足够 |
| Apple Music | `~/ncm-dl/amdl` | 网易云没有，或需要无损时；依赖本机的 wrapper 服务 |

### 流程

1. **先查库。** `just find-music …` 找不到合适的，才考虑下载。先写出理想曲目清单：
   曲名、艺术家、专辑，以及它对应哪个场景、为什么合适。
2. **找到具体曲目。** 网易云需要歌曲链接或 ID（`https://music.163.com/#/song?id=…`），
   可在网上检索或请用户提供；Apple Music 可用 `~/ncm-dl/amdl --search song "<关键词>"`。
   只要单曲或确实需要的专辑，不整张下载歌单或艺术家全集。
3. **下载前征得用户同意。** 列出每首的曲名、艺术家、来源平台与链接、预计大小
   （320k MP3 约 2.4MB/分钟），得到明确同意后再下载。一次同意只覆盖这一批。
4. **下到暂存目录，不直接进音乐库。**
   - 网易云：`~/ncm-dl/ncm_dl.py song <链接或ID> [...] -o <暂存目录>`，单曲会落在
     `<暂存目录>/单曲/`。保持默认音质与并发数，不要为求快调高 `-j`。
   - Apple Music：amdl 的保存目录是相对当前目录的（`AM-AAC/`、`AM-Lossless/`），
     所以先进入暂存目录再运行 `~/ncm-dl/amdl <专辑或歌曲链接>`；需要逐首挑选时加
     `--select`。
5. **检查后入库。** 确认文件能解码、时长和曲目对得上，把文件改名为
   `曲名 - 艺术家.扩展名`，移入音乐库对应的分类目录，然后运行 `just index-music`
   与 `just check-music`，补齐新条目的策展字段。`notes` 里写上来源平台与歌曲 ID，
   方便以后查找原曲。
6. **制书时按常规登记**（见上文“位置与边界”），并在该书 `production-notes.md` 记录
   这首曲子是为哪个场景下载的。

### 边界

- 两个工具的登录状态属于用户：`~/ncm-dl/ncm_dl.py status` 可以查看是否已登录，
  但不要读取、修改或复制 `session.json`、`config.yaml` 里的账号信息。未登录时请用户
  自己运行 `~/ncm-dl/ncm_dl.py login` 扫码。
- amdl 报出连不上 wrapper、解密失败或账号相关的错误时，停下来告诉用户，不要自行启动、
  修改或重建 `~/ncm-dl/wrapper`，也不要改 `config.yaml`。
- 下载失败的曲目记在暂存目录的“下载失败.txt”里；重试一次仍失败就换候选或告诉用户，
  不要反复重跑触发限流。
- 下载的文件和其他库中录音一样，绝不进入受 git 跟踪的书籍包。

## 条目字段

扫描产生的技术字段：`path`、`format`、`duration_s`、`bitrate_kbps`、
`sample_rate`、`channels`、`size`、`tag_title`、`tag_artist`、`tag_album`。

策展字段（新曲目为 `"curation": "pending"`，由 Agent 按下表补齐后删去该键）：

| 字段 | 含义 |
|---|---|
| `id` | 稳定 ID，`<分类>/<slug>`；改名、移动不变 |
| `title` / `artist` / `work` | 规范化的曲名、作曲或演奏者、出处（电影/游戏/套曲） |
| `collection` | `classical` `film` `game` `chinese` `pop` |
| `vocals` | `instrumental` 纯器乐；`wordless` 无词人声；`choral` 合唱/歌剧；`vocal` 有唱词；`dialogue` 对白 |
| `moods` | 情绪，见下方词表 |
| `settings` | 时代、地域、题材色彩，见下方词表 |
| `instruments` | 主奏乐器，自由词：`piano` `strings` `orchestra` `guqin` `guzheng` `pipa` `dizi` `cello` `violin` `choir` `synth` `guitar`… |
| `energy` | 1（极静）– 5（激烈） |
| `fit` | `primary` 可长时间低音量垫在阅读下；`accent` 主题鲜明或起伏大，只适合短段高潮、开篇、章末；`avoid` 有唱词、对白、过于家喻户晓会出戏 |
| `notes` | 选曲提示：循环接缝、前奏长短、何处爆发、适合什么场景 |
| `duplicate_of` | 同一录音或几乎相同的版本，指向保留的那条 |
| `used_by` | 已用在哪些书：`<book-id>:<asset-id>`；Agent 用库中曲目制书后追加 |

情绪 `moods`：serene tender romantic melancholy grief nostalgic wonder dreamy
mysterious eerie tense ominous dark heroic epic triumphant playful festive
whimsical solemn sacred lonely hopeful bittersweet pastoral majestic frantic
contemplative elegant adventurous defiant warm

题材 `settings`：chinese-classical wuxia japanese european-baroque
european-classical european-romantic viennese opera medieval fantasy sci-fi
space modern urban war crime spy nature sea desert sacred childhood christmas
frontier latin nordic slavic post-apocalyptic court rural dance

词表在 `scripts/index_music_library.py` 的 `VOCAB` 中，扩充时两处一起改。

## 选曲时怎么用

```sh
just find-music mood=melancholy fit=primary
just find-music setting=wuxia energy=1-3
just find-music collection=classical instrument=piano mood=serene
```

过滤条件全部满足才列出，按 `fit` 排序。然后：

1. 先对照场景的情绪/张力（Director 的 music tags）筛出候选，再试听判断，
   不以标签匹配度代替审美判断；
2. `accent` 曲目只放在短段落或叙事高点，不整章铺底；
3. 参考 `used_by` 避免多本书共用同一首成为“签名曲”，除非确实最合适；
4. 库里没有合适曲目时，在该书 `production-notes.md` 的 BGM 菜单写下理想曲目，
   按上文“扩充音乐库”的流程征得用户同意后下载；用户暂不下载时，可暂用合成或
   CC0 曲目占位；
5. 用了库里的曲目后，把 `<book-id>:<asset-id>` 追加到该条 `used_by`。
