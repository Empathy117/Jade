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
   告诉用户可以扩充音乐库；可暂用合成或 CC0 曲目占位；
5. 用了库里的曲目后，把 `<book-id>:<asset-id>` 追加到该条 `used_by`。
