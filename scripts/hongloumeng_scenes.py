"""Scene table for books/local/hongloumeng, authored chapter by chapter.

Each row: (start_id, label, location, time, weather, moods, tension,
music_group, ambience_tags). A scene ends where the next one starts; the
last scene runs to the final paragraph. Chapter-end annotation paragraphs
belong to the chapter's closing scene. Labels are episode names in the
director's own words — never quoted prose.

Location, music-group, and ambience vocabularies are interpreted by
scripts/build_hongloumeng_direction.py and the playback compiler.
"""

SCENES = [
    # ---- 卷首（版权页/三版序言/再版序/前言/凡例/目录）：静默、无演出 ----
    ("p0002", "卷首诸序", "frontmatter", None, None, ["scholarly", "quiet"], 0.05, None, []),

    # ---- 第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀 ----
    ("p0197", "青埂峰下", "qinggeng", "myth", None, ["mythic", "wistful"], 0.2, "taixu", []),
    ("p0213", "姑苏阊门甄家", "gusu", "day", None, ["settled", "genteel"], 0.15, "xianting", []),
    ("p0214", "书房昼梦闻仙机", "taixu", "dream", None, ["dreamlike", "numinous"], 0.32, "taixu", []),
    ("p0220", "梦醒见僧道", "gusu", "day", None, ["uneasy", "omen"], 0.34, "anliu", []),
    ("p0225", "葫芦庙寒儒", "gusu", "day", None, ["aspiring", "poor"], 0.2, "xianting", []),
    ("p0230", "中秋对月邀饮", "gusu", "night", None, ["festive", "ambitious"], 0.26, "pinghu", ["crickets"]),
    ("p0243", "元宵失女祸起", "gusu", "night", None, ["ominous", "loss"], 0.55, "bianzheng", []),
    ("p0246", "好了歌与出家", "gusu", "day", None, ["epiphany", "desolate"], 0.4, "kongshan", []),
    ("p0258", "门前喝道", "gusu", "day", None, ["turning"], 0.28, "xianting", []),

    # ---- 第二回 贾夫人仙逝扬州城 冷子兴演说荣国府 ----
    ("p0358", "娇杏偶因一顾", "gusu", "day", None, ["worldly", "ironic"], 0.2, "xianting", []),
    ("p0365", "维扬西宾", "yangzhou", "day", None, ["settled", "quiet"], 0.15, "chunjiang", []),
    ("p0368", "郭外村肆演说荣府", "countryside", "dusk", None, ["ruminative", "expository"], 0.2, "xianting", []),

    # ---- 第三回 贾雨村夤缘复旧职 林黛玉抛父进京都 ----
    ("p0438", "如海托孤", "yangzhou", "day", None, ["parting", "grief"], 0.3, "yangguan", []),
    ("p0442", "登舟入都", "capital", "day", None, ["awed", "unfamiliar"], 0.28, "xianting", []),
    ("p0445", "外祖母搂孙痛哭", "jiamu", "day", None, ["tender", "tearful"], 0.4, "hangong", []),
    ("p0448", "凤姐出场", "jiamu", "day", None, ["dazzling", "lively"], 0.3, "xianting", []),
    ("p0452", "荣禧堂拜舅", "ronghall", "day", None, ["formal", "grand"], 0.24, "xianting", []),
    ("p0465", "宝黛初会摔玉", "jiamu", "dusk", None, ["fated", "wonder", "shock"], 0.48, "taixu", []),
    ("p0474", "碧纱橱夜话", "jiamu", "night", None, ["quiet", "intimate"], 0.2, "pinghu", []),

    # ---- 第四回 薄命女偏逢薄命郎 葫芦僧乱判葫芦案 ----
    ("p0570", "李纨与四春", "neiyuan", "day", None, ["quiet", "domestic"], 0.15, "xianting", []),
    ("p0573", "葫芦僧乱判葫芦案", "court", "day", None, ["corrupt", "cynical"], 0.46, "anliu", []),
    ("p0592", "薛家进京", "journey", "day", None, ["worldly", "expedient"], 0.24, "xianting", []),
    ("p0596", "寄居梨香院", "neiyuan", "day", None, ["settled", "polite"], 0.18, "xianting", []),

    # ---- 第五回 游幻境指迷十二钗 饮仙醪曲演红楼梦 ----
    ("p0659", "宁府赏梅倦怠", "ningfu", "day", None, ["festive", "drowsy"], 0.2, "xianting", []),
    ("p0664", "秦氏卧房入梦", "qinroom", "day", None, ["languid", "perfumed"], 0.3, "chunjiang", []),
    ("p0669", "太虚幻境阅册", "taixu", "dream", None, ["ethereal", "fateful"], 0.5, "taixu", []),
    ("p0728", "仙曲十二支", "taixu", "dream", None, ["ethereal", "elegiac"], 0.52, "taixu", []),
    ("p0748", "迷津惊魂", "taixu", "dream", None, ["abyssal", "terror"], 0.62, "anliu", []),
    ("p0749", "梦回卧房", "qinroom", "day", None, ["startled", "hushed"], 0.3, "xianting", []),

    # ---- 第六回 贾宝玉初试云雨情 刘姥姥一进荣国府 ----
    ("p0843", "袭人初试", "jiamu", "dusk", None, ["secret", "tender"], 0.28, "chunjiang", []),
    ("p0846", "王家村舍谋生计", "rural", "day", None, ["humble", "pinched"], 0.3, "xianting", []),
    ("p0851", "一进荣国府", "rongfu_gate", "morning", None, ["timid", "awed"], 0.34, "xianting", []),
    ("p0858", "凤姐堂屋打抽丰", "neiyuan", "day", None, ["opulent", "nervous"], 0.4, "xianting", []),
    ("p0871", "得银而归", "capital", "day", None, ["relieved", "grateful"], 0.22, "xianting", []),

    # ---- 第七回 送宫花贾琏戏熙凤 宴宁府宝玉会秦钟 ----
    ("p0907", "周瑞家的送宫花", "neiyuan", "day", None, ["domestic", "gossipy"], 0.18, "xianting", []),
    ("p0921", "过宁府会秦钟", "ningfu", "day", None, ["social", "bright"], 0.24, "xianting", []),
    ("p0929", "焦大醉骂", "ningfu", "night", None, ["drunken", "explosive", "shameful"], 0.5, "bianzheng", []),

    # ---- 第八回 比通灵金莺微露意 探宝钗黛玉半含酸 ----
    ("p0971", "梨香院比通灵", "lixiang", "day", "snow", ["warm", "fated", "tart"], 0.32, "chunjiang", []),
    ("p0994", "醉后回房掷茶", "jiamu", "night", "snow", ["tipsy", "petulant"], 0.3, "xianting", []),
    ("p0998", "秦钟来拜定入塾", "neiyuan", "day", None, ["courteous"], 0.2, "xianting", []),

    # ---- 第九回 恋风流情友入家塾 起嫌疑顽童闹学堂 ----
    ("p1035", "上学辞行", "jiamu", "morning", None, ["fresh", "dutiful"], 0.22, "xianting", []),
    ("p1037", "书房训话", "study", "morning", None, ["stern", "wry"], 0.3, "xianting", []),
    ("p1040", "顽童闹学堂", "school", "day", None, ["mischief", "rowdy"], 0.45, "yuzhou", []),

    # ---- 第十回 金寡妇贪利权受辱 张太医论病细穷源 ----
    ("p1086", "金寡妇忍气", "commonhouse", "day", None, ["aggrieved", "calculating"], 0.3, "xianting", []),
    ("p1090", "宁府说病", "ningfu", "day", None, ["deflated", "worried"], 0.32, "xianting", []),
    ("p1095", "张太医细穷源", "qinroom", "noon", None, ["clinical", "foreboding"], 0.38, "anliu", []),

    # ---- 第十一回 庆寿辰宁府排家宴 见熙凤贾瑞起淫心 ----
    ("p1114", "贾敬寿辰家宴", "ningfu", "day", None, ["festive", "undertow"], 0.26, "yanle", []),
    ("p1123", "探病可卿", "qinroom", "day", None, ["sorrowful", "sisterly"], 0.42, "hangong", []),
    ("p1128", "会芳园遇贾瑞", "huifang", "day", None, ["creepy", "unctuous"], 0.42, "anliu", []),
    ("p1132", "登楼看戏席散", "ningfu", "dusk", None, ["lingering"], 0.28, "xianting", []),
    ("p1135", "贾瑞来缠", "neiyuan", "day", None, ["predatory", "cold"], 0.4, "anliu", []),

    # ---- 第十二回 王熙凤毒设相思局 贾天祥正照风月鉴 ----
    ("p1162", "毒设相思局", "neiyuan", "day", None, ["predatory", "scheming"], 0.45, "anliu", []),
    ("p1165", "穿堂夜冻", "raid", "night", "wind", ["freezing", "humiliated"], 0.5, "anliu", ["snowwind"]),
    ("p1172", "正照风月鉴", "commonhouse", "night", None, ["wasting", "doomed"], 0.58, "aiyin", []),
    ("p1178", "如海书至送黛玉归", "neiyuan", "day", None, ["parting", "heavy"], 0.35, "yangguan", []),

    # ---- 第十三回 秦可卿死封龙禁尉 王熙凤协理宁国府 ----
    ("p1197", "凤姐夜梦可卿", "neiyuan", "night", None, ["dream", "portent"], 0.5, "taixu", []),
    ("p1202", "丧音乍起", "ningfu", "night", None, ["shock", "clamor"], 0.6, "bianzheng", []),
    ("p1207", "大殓僭礼", "mourning", "day", None, ["pomp", "excess"], 0.45, "aiyin", []),
    ("p1215", "请凤协理", "ningfu", "day", None, ["appraising", "burdened"], 0.34, "xianting", []),
    ("p1220", "抱厦筹画", "ningfu", "day", None, ["resolute"], 0.3, "xianting", []),

    # ---- 第十四回 林如海捐馆扬州城 贾宝玉路谒北静王 ----
    ("p1268", "协理立威", "ningfu", "morning", None, ["brisk", "iron"], 0.38, "xianting", []),
    ("p1274", "五七法事", "mourning", "day", None, ["ritual", "mournful"], 0.42, "aiyin", ["temple"]),
    ("p1283", "灵前事务", "ningfu", "day", None, ["busy", "orderly"], 0.3, "xianting", []),
    ("p1290", "伴宿之夕", "mourning", "night", None, ["vigil", "blazing"], 0.42, "aiyin", []),
    ("p1293", "大殡出城", "capital", "day", None, ["procession", "grand"], 0.45, "aiyin", []),

    # ---- 第十五回 王凤姐弄权铁槛寺 秦鲸卿得趣馒头庵 ----
    ("p1346", "路谒北静王", "capital", "day", None, ["courtly", "admiring"], 0.34, "xianting", []),
    ("p1349", "郊外农庄", "rural", "day", None, ["rustic", "fresh"], 0.22, "chunjiang", []),
    ("p1353", "铁槛寺安灵", "tiejian", "dusk", None, ["cloistered", "smoky"], 0.34, "xianting", ["temple"]),
    ("p1358", "馒头庵弄权", "tiejian", "night", None, ["venal", "furtive", "amorous"], 0.48, "anliu", []),

    # ---- 第十六回 贾元春才选凤藻宫 秦鲸卿夭逝黄泉路 ----
    ("p1397", "弄权果报", "study", "night", None, ["cold", "retribution"], 0.45, "anliu", []),
    ("p1399", "元春晋封", "ronghall", "day", None, ["alarm", "pomp", "joy"], 0.45, "yanle", []),
    ("p1403", "琏凤对谈省亲", "neiyuan", "dusk", None, ["domestic", "reminiscent"], 0.28, "xianting", []),
    ("p1420", "筹建别墅", "capital", "day", None, ["bustling", "ambitious"], 0.3, "xianting", []),
    ("p1422", "秦钟夭逝", "commonhouse", "dusk", None, ["deathbed", "ghostly"], 0.52, "aiyin", []),

    # ---- 第十七回至十八回 大观园试才题对额 荣国府归省庆元宵 ----
    ("p1480", "痛悼秦钟", "neiyuan", "day", None, ["grieving"], 0.3, "aiyin", []),
    ("p1483", "入园试才", "daguan_spring", "day", None, ["verdant", "testing"], 0.3, "chunjiang", []),
    ("p1490", "翠竹幽馆", "xiaoxiang", "day", None, ["secluded", "cool"], 0.28, "chunjiang", ["bamboo"]),
    ("p1496", "山怀田舍", "daoxiang", "day", None, ["rustic", "contrived"], 0.26, "chunjiang", []),
    ("p1504", "蘅芷清芬", "hengwu", "day", None, ["austere", "fragrant"], 0.26, "chunjiang", []),
    ("p1512", "崇阁玉宇", "ronghall", "day", None, ["monumental"], 0.3, "chunjiang", []),
    ("p1515", "红香绿玉", "yihong", "day", None, ["ornate", "labyrinthine"], 0.28, "chunjiang", []),
    ("p1521", "香囊风波", "jiamu", "dusk", None, ["petulant", "tender"], 0.3, "xianting", []),
    ("p1526", "买伶采尼", "capital", "day", None, ["bustling", "preparatory"], 0.25, "xianting", []),
    ("p1530", "元宵驾至", "shengqin", "night", None, ["solemn", "resplendent"], 0.5, "yanle", []),
    ("p1542", "骨肉私聚", "shengqin", "night", None, ["tearful", "constrained"], 0.5, "hangong", []),
    ("p1546", "游幸题咏", "shengqin", "night", None, ["ceremonious", "literary"], 0.4, "yanle", []),
    ("p1613", "赐物回銮", "shengqin", "dawn", None, ["parting", "weary"], 0.42, "yangguan", []),

    # ---- 第十九回 情切切良宵花解语 意绵绵静日玉生香 ----
    ("p1774", "元宵既过", "neiyuan", "day", None, ["slack", "recuperating"], 0.2, "xianting", []),
    ("p1777", "宁府散戏", "ningfu", "day", None, ["idle", "mischief"], 0.25, "xianting", []),
    ("p1782", "袭人家探视", "commonhouse", "day", None, ["homely", "warm"], 0.25, "chunjiang", []),
    ("p1786", "酥酪风波", "jiamu", "dusk", None, ["fussy", "comic"], 0.22, "xianting", []),
    ("p1790", "良宵花解语", "jiamu", "night", None, ["coaxing", "earnest"], 0.28, "pinghu", []),
    ("p1801", "静日玉生香", "jiamu", "day", None, ["drowsy", "playful", "fragrant"], 0.26, "chunjiang", []),

    # ---- 第二十回 王熙凤正言弹妒意 林黛玉俏语谑娇音 ----
    ("p1845", "正言弹妒意", "jiamu", "day", None, ["squabble", "protective"], 0.3, "xianting", []),
    ("p1852", "麝月篦头", "jiamu", "night", None, ["quiet", "gentle"], 0.2, "pinghu", []),
    ("p1856", "贾环耍赖", "neiyuan", "day", None, ["petty", "sour"], 0.3, "xianting", []),
    ("p1863", "湘云到来", "jiamu", "day", None, ["merry", "banter"], 0.25, "yuzhou", []),

    # ---- 第二十一回 贤袭人娇嗔箴宝玉 俏平儿软语救贾琏 ----
    ("p1883", "晨妆同盥", "jiamu", "morning", None, ["intimate", "fresh"], 0.22, "chunjiang", []),
    ("p1888", "娇嗔箴宝玉", "jiamu", "day", None, ["reproachful", "cool"], 0.3, "xianting", []),
    ("p1892", "灯下续庄子", "jiamu", "night", None, ["huffy", "zen"], 0.3, "kongshan", []),
    ("p1902", "大姐出痘", "neiyuan", "day", None, ["vulgar", "furtive"], 0.34, "anliu", []),
    ("p1907", "软语救贾琏", "neiyuan", "day", None, ["sly", "teasing"], 0.28, "xianting", []),

    # ---- 第二十二回 听曲文宝玉悟禅机 制灯谜贾政悲谶语 ----
    ("p1959", "筹办生辰", "neiyuan", "day", None, ["planning"], 0.2, "xianting", []),
    ("p1961", "宝钗生辰戏酒", "jiamu", "day", None, ["festive", "warm"], 0.28, "yanle", []),
    ("p1969", "戏子之谑", "jiamu", "dusk", None, ["prickly", "offended"], 0.35, "xianting", []),
    ("p1974", "参禅写偈", "jiamu", "night", None, ["zen", "sulky"], 0.3, "kongshan", []),
    ("p1983", "元妃灯谜", "jiamu", "day", None, ["riddling", "playful"], 0.28, "xianting", []),
    ("p1997", "谜底藏谶", "jiamu", "night", None, ["fatherly", "uneasy", "omen"], 0.42, "anliu", []),

    # ---- 第二十三回 西厢记妙词通戏语 牡丹亭艳曲警芳心 ----
    ("p2069", "奉旨入园", "ronghall", "day", None, ["formal", "expectant"], 0.25, "xianting", []),
    ("p2080", "四时即事", "daguan_spring", "day", None, ["idyllic", "contented"], 0.2, "chunjiang", []),
    ("p2103", "沁芳共读西厢", "flowermound", "day", None, ["blossoming", "thrilled"], 0.4, "chunjiang", []),
    ("p2108", "艳曲警芳心", "daguan_spring", "dusk", None, ["piercing", "melancholy"], 0.45, "hangong", []),

    # ---- 第二十四回 醉金刚轻财尚义侠 痴女儿遗帕惹相思 ----
    ("p2153", "鸳鸯传话", "jiamu", "day", None, ["domestic"], 0.2, "xianting", []),
    ("p2161", "醉金刚仗义", "capital", "day", None, ["streetwise", "generous"], 0.3, "xianting", []),
    ("p2168", "谋得种树差", "neiyuan", "day", None, ["eager", "obsequious"], 0.25, "xianting", []),
    ("p2178", "小红初遇", "yihong", "dusk", None, ["stirring", "shy"], 0.3, "chunjiang", []),

    # ---- 第二十五回 魇魔法姊弟逢五鬼 红楼梦通灵遇双真 ----
    ("p2209", "遗帕魂牵", "yihong", "morning", None, ["yearning"], 0.25, "chunjiang", []),
    ("p2212", "灯油烫面", "neiyuan", "day", None, ["spiteful", "scalding"], 0.45, "bianzheng", []),
    ("p2219", "马道婆魇魔", "neiyuan", "day", None, ["witchy", "venal", "sinister"], 0.55, "anliu", []),
    ("p2227", "怡红打趣", "yihong", "day", None, ["teasing", "light"], 0.25, "chunjiang", []),
    ("p2232", "五鬼大发作", "neiyuan", "day", None, ["chaos", "terror"], 0.68, "bianzheng", []),
    ("p2238", "双真持诵通灵", "neiyuan", "dusk", None, ["numinous", "turning"], 0.5, "taixu", []),

    # ---- 第二十六回 蜂腰桥设言传心事 潇湘馆春困发幽情 ----
    ("p2288", "蜂腰桥传心事", "yihong", "day", None, ["hopeful", "scheming"], 0.26, "xianting", []),
    ("p2303", "潇湘春困", "xiaoxiang", "noon", None, ["languid", "tender"], 0.3, "chunjiang", ["bamboo"]),
    ("p2310", "外书房酒局", "study", "day", None, ["raucous", "worldly"], 0.28, "yuzhou", []),
    ("p2318", "错关院门", "yihong", "night", None, ["misunderstood", "aching"], 0.48, "hangong", []),

    # ---- 第二十七回 滴翠亭杨妃戏彩蝶 埋香冢飞燕泣残红 ----
    ("p2349", "芒种饯花会", "daguan_spring", "morning", None, ["festival", "bright"], 0.25, "yuzhou", []),
    ("p2354", "滴翠亭戏蝶", "shuixie", "day", None, ["playful", "wary"], 0.35, "yuzhou", []),
    ("p2359", "小红答话", "daguan_spring", "day", None, ["crisp", "ambitious"], 0.25, "xianting", []),
    ("p2371", "花冢葬花吟", "flowermound", "day", None, ["grief", "exquisite"], 0.55, "hangong", []),

    # ---- 第二十八回 蒋玉菡情赠茜香罗 薛宝钗羞笼红麝串 ----
    ("p2416", "山坡诉悲释嫌", "flowermound", "day", None, ["reconciled", "tender"], 0.4, "hangong", []),
    ("p2421", "王夫人处论药", "neiyuan", "day", None, ["domestic", "chatty"], 0.22, "xianting", []),
    ("p2432", "冯家行酒令", "study", "day", None, ["rakish", "convivial"], 0.3, "yuzhou", []),
    ("p2493", "汗巾易主", "yihong", "night", None, ["secret", "drowsy"], 0.25, "xianting", []),
    ("p2497", "红麝串之赐", "jiamu", "day", None, ["signal", "awkward"], 0.3, "xianting", []),

    # ---- 第二十九回 享福人福深还祷福 痴情女情重愈斟情 ----
    ("p2545", "倾府起行", "capital", "morning", None, ["procession", "festive"], 0.3, "yanle", []),
    ("p2552", "清虚观打醮", "temple", "day", None, ["ceremonial", "bustling"], 0.3, "yanle", ["temple"]),
    ("p2572", "痴情愈斟情", "jiamu", "day", None, ["stormy", "anguished"], 0.58, "hangong", []),

    # ---- 第三十回 宝钗借扇机带双敲 龄官划蔷痴及局外 ----
    ("p2619", "潇湘请罪", "xiaoxiang", "morning", None, ["contrite", "melting"], 0.32, "chunjiang", ["bamboo"]),
    ("p2626", "借扇双敲", "jiamu", "day", None, ["barbed", "witty"], 0.3, "xianting", []),
    ("p2632", "金钏之戏", "neiyuan", "noon", None, ["drowsy", "fatal"], 0.45, "anliu", []),
    ("p2636", "龄官划蔷", "daguan_summer", "day", "rain", ["obsessive", "poignant"], 0.32, "hangong", ["rain"]),
    ("p2641", "雨夜归院", "yihong", "dusk", "rain", ["irritable", "regretful"], 0.34, "xianting", ["rain"]),

    # ---- 第三十一回 撕扇子作千金一笑 因麒麟伏白首双星 ----
    ("p2662", "袭人见血", "yihong", "dawn", None, ["alarmed"], 0.35, "xianting", []),
    ("p2664", "端阳节宴", "neiyuan", "noon", None, ["listless", "festival"], 0.25, "xianting", []),
    ("p2666", "晴雯跌扇", "yihong", "day", None, ["quarrel", "proud"], 0.4, "xianting", []),
    ("p2673", "撕扇一笑", "yihong", "night", None, ["extravagant", "laughing"], 0.3, "yuzhou", ["crickets"]),
    ("p2677", "湘云拾麒麟", "jiamu", "day", None, ["merry", "portent"], 0.28, "yuzhou", []),

    # ---- 第三十二回 诉肺腑心迷活宝玉 含耻辱情烈死金钏 ----
    ("p2714", "麒麟话旧", "yihong", "day", None, ["candid", "clashing"], 0.35, "xianting", []),
    ("p2721", "诉肺腑", "daguan_summer", "day", None, ["soulbaring", "electric"], 0.52, "hangong", ["crickets"]),
    ("p2726", "错表袭人", "neiyuan", "day", None, ["flustered"], 0.3, "xianting", []),
    ("p2731", "金钏投井", "neiyuan", "day", None, ["shock", "grief", "guilt"], 0.55, "aiyin", []),

    # ---- 第三十三回 手足眈眈小动唇舌 不肖种种大承笞挞 ----
    ("p2749", "祸事叠至", "ronghall", "day", None, ["dread", "mounting"], 0.6, "anliu", []),
    ("p2758", "大承笞挞", "ronghall", "day", None, ["fury", "violence", "agony"], 0.75, "bianzheng", []),
    ("p2765", "贾母救孙", "ronghall", "day", None, ["matriarch", "reproach", "weeping"], 0.58, "aiyin", []),

    # ---- 第三十四回 情中情因情感妹妹 错里错以错劝哥哥 ----
    ("p2787", "伤后探望", "yihong", "day", None, ["aching", "tender"], 0.42, "hangong", []),
    ("p2798", "袭人密陈", "neiyuan", "dusk", None, ["confiding", "pivotal"], 0.4, "anliu", []),
    ("p2808", "题帕三绝", "xiaoxiang", "night", None, ["burning", "devoted"], 0.5, "hangong", []),
    ("p2820", "错里错劝兄", "lixiang", "night", None, ["squabble", "tearful"], 0.35, "xianting", []),

    # ---- 第三十五回 白玉钏亲尝莲叶羹 黄金莺巧结梅花络 ----
    ("p2840", "鹦鹉架前", "xiaoxiang", "day", None, ["wistful"], 0.28, "hangong", ["bamboo"]),
    ("p2844", "薛家和好", "lixiang", "day", None, ["appeasing"], 0.24, "xianting", []),
    ("p2848", "怡红问疾", "yihong", "day", None, ["bustling", "doting"], 0.25, "yuzhou", []),
    ("p2859", "玉钏尝羹", "yihong", "day", None, ["peacemaking", "gentle"], 0.28, "chunjiang", []),
    ("p2866", "莺儿结络", "yihong", "day", None, ["homely", "craft"], 0.22, "chunjiang", []),

    # ---- 第三十六回 绣鸳鸯梦兆绛芸轩 识分定情悟梨香院 ----
    ("p2887", "月例风波", "neiyuan", "day", None, ["accounting", "cold"], 0.3, "xianting", []),
    ("p2896", "绣鸳鸯梦兆", "yihong", "noon", None, ["drowsy", "ironic"], 0.35, "chunjiang", ["crickets"]),
    ("p2905", "情悟梨香院", "lixiang", "day", None, ["disillusioned", "awakening"], 0.4, "hangong", []),
    ("p2911", "湘云暂归", "yihong", "dusk", None, ["parting"], 0.25, "xianting", []),

    # ---- 第三十七回 秋爽斋偶结海棠社 蘅芜苑夜拟菊花题 ----
    ("p2932", "贾政点差", "ronghall", "day", None, ["formal"], 0.2, "xianting", []),
    ("p2933", "偶结海棠社", "qiushuang", "day", None, ["elegant", "founding"], 0.28, "yuzhou", []),
    ("p2978", "遣送菱粉", "yihong", "day", None, ["busy", "kindly"], 0.22, "xianting", []),
    ("p2986", "湘云和韵", "qiushuang", "day", None, ["brilliant", "convivial"], 0.28, "yuzhou", []),
    ("p2999", "蘅芜夜拟菊题", "hengwu", "night", None, ["intimate", "planning"], 0.25, "pinghu", ["crickets"]),

    # ---- 第三十八回 林潇湘魁夺菊花诗 薛蘅芜讽和螃蟹咏 ----
    ("p3060", "藕香榭蟹宴", "shuixie", "day", None, ["autumnal", "feasting"], 0.26, "yuzhou", []),
    ("p3071", "菊花诗夺魁", "shuixie", "day", None, ["poetic", "radiant"], 0.3, "pinghu", []),
    ("p3139", "螃蟹咏讽和", "shuixie", "day", None, ["witty", "barbed"], 0.28, "yuzhou", []),

    # ---- 第三十九回 村姥姥是信口开河 情哥哥偏寻根究底 ----
    ("p3237", "散社闲评", "daguan_autumn", "day", None, ["easy", "chatty"], 0.22, "xianting", []),
    ("p3246", "姥姥信口开河", "jiamu", "dusk", None, ["folksy", "spellbinding"], 0.26, "xianting", []),
    ("p3260", "寻根究底", "yihong", "day", None, ["credulous", "quixotic"], 0.25, "xianting", []),

    # ---- 第四十回 史太君两宴大观园 金鸳鸯三宣牙牌令 ----
    ("p3283", "晓晴排宴", "daguan_autumn", "morning", None, ["crisp", "festive"], 0.25, "yuzhou", []),
    ("p3287", "潇湘馆留步", "xiaoxiang", "morning", None, ["amused", "bookish"], 0.24, "chunjiang", ["bamboo"]),
    ("p3293", "晓翠堂笑宴", "qiushuang", "day", None, ["hilarious", "warm"], 0.3, "yuzhou", []),
    ("p3306", "舟游蘅芜", "hengwu", "day", None, ["austere", "critical"], 0.24, "pinghu", []),
    ("p3312", "牙牌令", "banquet", "day", None, ["game", "brilliant"], 0.3, "yanle", []),

    # ---- 第四十一回 栊翠庵茶品梅花雪 怡红院劫遇母蝗虫 ----
    ("p3359", "续宴茄鲞", "banquet", "day", None, ["comic", "groaning"], 0.28, "yanle", []),
    ("p3371", "栊翠庵品茶", "longcui", "day", None, ["rarefied", "fastidious"], 0.3, "meihua", []),
    ("p3379", "醉卧怡红", "yihong", "dusk", None, ["drunken", "farce"], 0.3, "yuzhou", []),

    # ---- 第四十二回 蘅芜君兰言解疑癖 潇湘子雅谑补馀香 ----
    ("p3429", "姥姥满载辞行", "neiyuan", "day", None, ["grateful", "parting"], 0.24, "xianting", []),
    ("p3445", "兰言解疑癖", "hengwu", "day", None, ["confessional", "sisterly"], 0.3, "pinghu", []),
    ("p3448", "稻香村议画", "daoxiang", "day", None, ["hilarious", "witty"], 0.26, "yuzhou", []),

    # ---- 第四十三回 闲取乐偶攒金庆寿 不了情暂撮土为香 ----
    ("p3514", "攒金庆寿", "jiamu", "day", None, ["merry", "scheming"], 0.25, "yanle", []),
    ("p3526", "水仙庵私祭", "temple", "morning", None, ["secret", "mourning"], 0.4, "aiyin", ["temple"]),
    ("p3535", "回府听戏", "banquet", "day", None, ["festive", "guilty"], 0.3, "yanle", []),

    # ---- 第四十四回 变生不测凤姐泼醋 喜出望外平儿理妆 ----
    ("p3567", "寿筵观剧", "banquet", "day", None, ["festive"], 0.26, "yanle", []),
    ("p3571", "变生不测泼醋", "neiyuan", "day", None, ["jealous", "eruptive"], 0.62, "bianzheng", []),
    ("p3582", "平儿理妆", "yihong", "day", None, ["solacing", "delicate"], 0.35, "chunjiang", []),
    ("p3587", "跪请赔情", "jiamu", "morning", None, ["farcical", "uneasy"], 0.35, "xianting", []),

    # ---- 第四十五回 金兰契互剖金兰语 风雨夕闷制风雨词 ----
    ("p3615", "赖嬷嬷说教", "neiyuan", "day", None, ["chatty", "earthy"], 0.22, "xianting", []),
    ("p3626", "金兰互剖", "xiaoxiang", "day", None, ["confiding", "melancholy"], 0.35, "pinghu", ["bamboo"]),
    ("p3630", "秋窗风雨夕", "xiaoxiang", "night", "rain", ["desolate", "aching"], 0.5, "hangong", ["rain"]),
    ("p3641", "夜访潇湘", "xiaoxiang", "night", "rain", ["tender", "cozy"], 0.35, "pinghu", ["rain"]),

    # ---- 第四十六回 尴尬人难免尴尬事 鸳鸯女誓绝鸳鸯偶 ----
    ("p3689", "尴尬说媒", "neiyuan", "day", None, ["awkward", "grasping"], 0.4, "anliu", []),
    ("p3698", "枫下密语", "daguan_autumn", "day", None, ["defiant", "sisterly"], 0.35, "xianting", []),
    ("p3709", "誓绝鸳鸯偶", "jiamu", "day", None, ["thunder", "resolute"], 0.55, "bianzheng", []),

    # ---- 第四十七回 呆霸王调情遭苦打 冷郎君惧祸走他乡 ----
    ("p3738", "老太太斥媒", "jiamu", "day", None, ["chastened", "cardgame"], 0.3, "xianting", []),
    ("p3748", "赖园宴集", "banquet", "day", None, ["convivial"], 0.25, "yanle", []),
    ("p3752", "苇塘苦打", "countryside", "dusk", None, ["vengeful", "thrashing"], 0.5, "bianzheng", []),
    ("p3760", "薛家善后", "lixiang", "night", None, ["smarting", "sullen"], 0.3, "xianting", []),

    # ---- 第四十八回 滥情人情误思游艺 慕雅女雅集苦吟诗 ----
    ("p3784", "薛蟠议行商", "lixiang", "day", None, ["restless", "practical"], 0.24, "xianting", []),
    ("p3792", "石呆子古扇", "neiyuan", "day", None, ["outrage", "rapacious"], 0.38, "anliu", []),
    ("p3795", "香菱学诗", "xiaoxiang", "night", None, ["studious", "rapt"], 0.24, "chunjiang", []),
    ("p3822", "梦中得句", "hengwu", "night", None, ["obsessed", "dreaming"], 0.26, "pinghu", ["crickets"]),

    # ---- 第四十九回 琉璃世界白雪红梅 脂粉香娃割腥啖膻 ----
    ("p3857", "众芳齐聚", "jiamu", "day", None, ["arrivals", "delight"], 0.26, "yuzhou", []),
    ("p3876", "琉璃世界踏雪", "luxue", "day", "snow", ["dazzling", "crystal"], 0.28, "meihua", ["snowwind"]),
    ("p3884", "割腥啖膻", "luxue", "morning", "snow", ["wild", "hearty"], 0.3, "yuzhou", []),

    # ---- 第五十回 芦雪广争联即景诗 暖香坞雅制春灯谜 ----
    ("p3927", "芦雪广争联", "luxue", "day", "snow", ["blazing", "joyous"], 0.35, "yuzhou", ["snowwind"]),
    ("p4045", "栊翠庵乞红梅", "longcui", "day", "snow", ["quest", "pristine"], 0.3, "meihua", []),
    ("p4047", "红梅入席", "luxue", "day", "snow", ["exquisite", "prized"], 0.3, "meihua", []),
    ("p4074", "贾母雪中来", "luxue", "day", "snow", ["indulgent", "festive"], 0.28, "yanle", []),
    ("p4084", "暖香坞制谜", "qiushuang", "day", None, ["riddling", "cozy"], 0.26, "xianting", []),

    # ---- 第五十一回 薛小妹新编怀古诗 胡庸医乱用虎狼药 ----
    ("p4172", "怀古十咏", "qiushuang", "day", None, ["erudite", "mysterious"], 0.26, "pinghu", []),
    ("p4205", "袭人归省", "neiyuan", "dusk", None, ["hasty", "considerate"], 0.22, "xianting", []),
    ("p4211", "月夜风寒", "yihong", "night", None, ["mischief", "chill"], 0.28, "xianting", ["snowwind"]),
    ("p4217", "虎狼药方", "yihong", "day", None, ["quackery", "indignant"], 0.3, "xianting", []),

    # ---- 第五十二回 俏平儿情掩虾须镯 勇晴雯病补雀金裘 ----
    ("p4288", "情掩虾须镯", "yihong", "day", None, ["discreet", "generous"], 0.3, "xianting", []),
    ("p4293", "真真国女儿诗", "hengwu", "day", None, ["exotic", "sparkling"], 0.26, "pinghu", []),
    ("p4306", "雀金裘之赐", "jiamu", "morning", None, ["ceremonial", "fond"], 0.24, "xianting", []),
    ("p4311", "病补雀金裘", "yihong", "night", None, ["heroic", "fevered", "devoted"], 0.5, "hangong", []),

    # ---- 第五十三回 宁国府除夕祭宗祠 荣国府元宵开夜宴 ----
    ("p4343", "裘成力尽", "yihong", "dawn", None, ["spent", "grateful"], 0.3, "xianting", []),
    ("p4347", "乌庄头交租", "ningfu", "day", "snow", ["ledger", "strained"], 0.28, "xianting", []),
    ("p4361", "除夕祭宗祠", "ronghall", "dusk", None, ["solemn", "ancestral"], 0.4, "kongshan", ["temple"]),
    ("p4380", "元宵开夜宴", "banquet", "night", None, ["glittering", "clan"], 0.35, "yanle", []),

    # ---- 第五十四回 史太君破陈腐旧套 王熙凤效戏彩斑衣 ----
    ("p4428", "女先儿说书", "banquet", "night", None, ["storytelling", "warm"], 0.3, "yanle", []),
    ("p4457", "效戏彩斑衣", "banquet", "night", None, ["jesting", "uproarious"], 0.32, "yanle", []),
    ("p4463", "烟火阑珊", "banquet", "night", None, ["pyrotechnic", "waning"], 0.3, "yanle", []),

    # ---- 第五十五回 辱亲女愚妾争闲气 欺幼主刁奴蓄险心 ----
    ("p4499", "太妃薨凤姐病", "neiyuan", "day", None, ["grey", "transition"], 0.3, "xianting", []),
    ("p4506", "探春理事", "ronghall", "day", None, ["steely", "tearful"], 0.42, "anliu", []),
    ("p4528", "灯下论探春", "neiyuan", "dusk", None, ["appraising", "shrewd"], 0.28, "xianting", []),

    # ---- 第五十六回 敏探春兴利除宿弊 时宝钗小惠全大体 ----
    ("p4549", "兴利除宿弊", "ronghall", "day", None, ["reformist", "brisk"], 0.3, "xianting", []),
    ("p4571", "甄家来访梦真", "jiamu", "day", None, ["uncanny", "mirror"], 0.3, "taixu", []),

    # ---- 第五十七回 慧紫鹃情辞试忙玉 慈姨妈爱语慰痴颦 ----
    ("p4604", "情辞试忙玉", "xiaoxiang", "day", None, ["probing", "fond"], 0.3, "chunjiang", ["bamboo"]),
    ("p4612", "痴迷大恸", "yihong", "day", None, ["catatonic", "panic"], 0.6, "bianzheng", []),
    ("p4623", "紫鹃夜话", "yihong", "night", None, ["recovering", "candid"], 0.3, "pinghu", []),
    ("p4635", "岫烟定亲", "lixiang", "day", None, ["matchmaking", "gentle"], 0.24, "xianting", []),
    ("p4643", "当票与冬衣", "xiaoxiang", "day", None, ["genteel", "kind"], 0.28, "pinghu", []),
    ("p4647", "爱语慰痴颦", "xiaoxiang", "day", None, ["motherly", "wistful"], 0.3, "hangong", []),

    # ---- 第五十八回 杏子阴假凤泣虚凰 茜纱窗真情揆痴理 ----
    ("p4682", "遣散梨园", "neiyuan", "day", None, ["grey", "dispersal"], 0.3, "xianting", []),
    ("p4692", "杏子阴烧纸", "daguan_spring", "day", None, ["elegiac", "pensive"], 0.35, "hangong", []),
    ("p4703", "洗头风波", "yihong", "day", None, ["petty", "protective"], 0.28, "xianting", []),
    ("p4713", "茜纱窗揆痴理", "yihong", "night", None, ["revelatory", "moved"], 0.32, "pinghu", []),

    # ---- 第五十九回 柳叶渚边嗔莺咤燕 绛云轩里召将飞符 ----
    ("p4744", "送灵起程", "capital", "morning", None, ["procession", "quiet"], 0.25, "xianting", []),
    ("p4748", "柳叶渚编柳", "daguan_spring", "morning", None, ["springfresh", "squabble"], 0.26, "chunjiang", []),
    ("p4759", "嗔莺咤燕", "yihong", "day", None, ["scolding", "tangled"], 0.32, "xianting", []),

    # ---- 第六十回 茉莉粉替去蔷薇硝 玫瑰露引来茯苓霜 ----
    ("p4779", "蔷薇硝茉莉粉", "yihong", "day", None, ["swap", "brewing"], 0.28, "xianting", []),
    ("p4786", "大闹怡红院", "yihong", "day", None, ["brawl", "farce"], 0.5, "bianzheng", []),
    ("p4800", "厨房是非", "neiyuan", "day", None, ["belowstairs", "gossip"], 0.28, "xianting", []),
    ("p4811", "玫瑰露茯苓霜", "neiyuan", "dusk", None, ["gift", "entangled"], 0.26, "xianting", []),

    # ---- 第六十一回 投鼠忌器宝玉瞒赃 判冤决狱平儿行权 ----
    ("p4889", "角门斗嘴", "neiyuan", "day", None, ["sharp", "comic"], 0.24, "xianting", []),
    ("p4892", "司棋闹厨", "neiyuan", "day", None, ["kitchenwar", "petty"], 0.35, "xianting", []),
    ("p4899", "五儿蒙冤", "daguan_spring", "night", None, ["unjust", "frightened"], 0.42, "anliu", []),
    ("p4905", "平儿行权", "neiyuan", "day", None, ["judicious", "merciful"], 0.3, "xianting", []),

    # ---- 第六十二回 憨湘云醉眠芍药裀 呆香菱情解石榴裙 ----
    ("p4939", "大事化小", "neiyuan", "morning", None, ["deflated", "wry"], 0.24, "xianting", []),
    ("p4944", "寿辰行礼", "yihong", "morning", None, ["birthday", "courteous"], 0.25, "yuzhou", []),
    ("p4957", "红香圃射覆", "daguan_summer", "day", None, ["games", "brilliant"], 0.3, "yuzhou", []),
    ("p4979", "醉眠芍药裀", "daguan_summer", "noon", None, ["drunken", "idyllic"], 0.3, "pinghu", ["crickets"]),
    ("p4989", "情解石榴裙", "daguan_summer", "day", None, ["innocent", "mishap"], 0.26, "chunjiang", []),

    # ---- 第六十三回 寿怡红群芳开夜宴 死金丹独艳理亲丧 ----
    ("p5041", "夜宴筹备", "yihong", "dusk", None, ["conspiratorial", "giddy"], 0.26, "xianting", []),
    ("p5048", "群芳开夜宴", "yihong", "night", None, ["blossoming", "revel", "fateful"], 0.38, "yanle", []),
    ("p5084", "醉后天明", "yihong", "morning", None, ["hazy", "amused"], 0.24, "xianting", []),
    ("p5087", "槛外人拜帖", "yihong", "day", None, ["cryptic", "charmed"], 0.28, "meihua", []),
    ("p5095", "榆荫堂还席", "daguan_summer", "day", None, ["easy", "green"], 0.26, "yuzhou", []),
    ("p5097", "死金丹", "ningfu", "day", None, ["suddendeath", "scramble"], 0.55, "bianzheng", []),
    ("p5099", "独艳理亲丧", "ningfu", "day", None, ["composed", "burdened"], 0.4, "aiyin", []),

    # ---- 第六十四回 幽淑女悲题五美吟 浪荡子情遗九龙珮 ----
    ("p5158", "丧仪如仪", "mourning", "day", None, ["rites", "weary"], 0.35, "aiyin", ["temple"]),
    ("p5162", "静日闲嬉", "yihong", "day", None, ["idle", "cooling"], 0.24, "xianting", []),
    ("p5167", "五美吟", "xiaoxiang", "day", None, ["elegiac", "learned"], 0.35, "hangong", ["bamboo"]),
    ("p5193", "情遗九龙珮", "ningfu", "day", None, ["lecherous", "scheming"], 0.4, "anliu", []),

    # ---- 第六十五回 贾二舍偷娶尤二姨 尤三姐思嫁柳二郎 ----
    ("p5261", "小花枝巷", "commonhouse", "night", None, ["illicit", "honeyed"], 0.3, "chunjiang", []),
    ("p5263", "三姐震席", "commonhouse", "night", None, ["lurid", "blazing"], 0.5, "bianzheng", []),
    ("p5276", "思嫁柳二郎", "commonhouse", "day", None, ["proud", "resolute"], 0.35, "hangong", []),
    ("p5281", "兴儿说荣府", "commonhouse", "dusk", None, ["gossip", "vivid"], 0.28, "xianting", []),

    # ---- 第六十六回 情小妹耻情归地府 冷二郎一冷入空门 ----
    ("p5309", "鸳鸯剑定情", "commonhouse", "day", None, ["betrothal", "keen"], 0.32, "xianting", []),
    ("p5312", "道中遇湘莲", "journey", "day", None, ["chance", "hearty"], 0.3, "xianting", []),
    ("p5319", "冷郎反悔", "capital", "day", None, ["doubt", "cold"], 0.42, "anliu", []),
    ("p5324", "耻情归地府", "commonhouse", "day", None, ["tragic", "steel", "shattering"], 0.65, "aiyin", []),
    ("p5328", "一冷入空门", "countryside", "dusk", None, ["vanitas", "awakening"], 0.45, "kongshan", ["temple"]),

    # ---- 第六十七回 见土仪颦卿思故里 闻秘事凤姐讯家童 ----
    ("p5342", "薛家闻信", "lixiang", "day", None, ["sighing", "practical"], 0.26, "xianting", []),
    ("p5347", "土仪思故里", "xiaoxiang", "day", None, ["homesick", "teary"], 0.35, "hangong", []),
    ("p5362", "袭人探凤", "neiyuan", "day", None, ["courteous", "observant"], 0.26, "xianting", []),
    ("p5370", "凤姐讯家童", "neiyuan", "day", None, ["interrogation", "fury"], 0.5, "anliu", []),

    # ---- 第六十八回 苦尤娘赚入大观园 酸凤姐大闹宁国府 ----
    ("p5386", "赚入大观园", "commonhouse", "day", None, ["silken", "venomous"], 0.45, "anliu", []),
    ("p5395", "善姐磨折", "daguan_autumn", "day", None, ["trapped", "wilting"], 0.4, "anliu", []),
    ("p5398", "唆讼都察院", "court", "day", None, ["machination", "brazen"], 0.42, "anliu", []),
    ("p5403", "大闹宁国府", "ningfu", "day", None, ["tempest", "theatrical"], 0.6, "bianzheng", []),

    # ---- 第六十九回 弄小巧用借剑杀人 觉大限吞生金自逝 ----
    ("p5431", "拜见贾母", "jiamu", "day", None, ["veiled", "performative"], 0.35, "anliu", []),
    ("p5441", "借剑杀人", "neiyuan", "day", None, ["persecution", "cold"], 0.5, "anliu", []),
    ("p5447", "病中梦妹", "neiyuan", "night", None, ["haunted", "despairing"], 0.5, "aiyin", []),
    ("p5456", "吞生金自逝", "neiyuan", "dawn", None, ["finality", "hush"], 0.62, "aiyin", []),
    ("p5460", "草草殡殓", "neiyuan", "day", None, ["bitter", "meager"], 0.4, "aiyin", []),

    # ---- 第七十回 林黛玉重建桃花社 史湘云偶填柳絮词 ----
    ("p5480", "岁暮诸务", "neiyuan", "day", None, ["administrative", "wintry"], 0.26, "xianting", []),
    ("p5486", "桃花行", "daguan_spring", "day", None, ["lyric", "sorrowful"], 0.38, "hangong", []),
    ("p5506", "寿仪与家书", "neiyuan", "day", None, ["dutiful", "expectant"], 0.25, "xianting", []),
    ("p5512", "柳絮词", "xiaoxiang", "day", None, ["airy", "valedictory"], 0.32, "pinghu", []),
    ("p5529", "放风筝", "daguan_spring", "day", "wind", ["soaring", "release"], 0.3, "yuzhou", []),

    # ---- 第七十一回 嫌隙人有心生嫌隙 鸳鸯女无意遇鸳鸯 ----
    ("p5572", "八旬大庆", "banquet", "day", None, ["pomp", "thronged"], 0.35, "yanle", []),
    ("p5581", "角门怠慢", "daguan_autumn", "dusk", None, ["slighted", "simmering"], 0.32, "xianting", []),
    ("p5594", "当众折凤", "banquet", "day", None, ["humiliation", "barbed"], 0.45, "anliu", []),
    ("p5600", "鸳鸯察隐", "jiamu", "night", None, ["perceptive", "soothing"], 0.3, "xianting", []),
    ("p5608", "无意遇鸳鸯", "daguan_autumn", "night", None, ["startled", "secret"], 0.4, "anliu", ["crickets"]),

    # ---- 第七十二回 王熙凤恃强羞说病 来旺妇倚势霸成亲 ----
    ("p5648", "守秘慰司棋", "daguan_autumn", "day", None, ["anxious", "discreet"], 0.32, "xianting", []),
    ("p5653", "恃强羞说病", "neiyuan", "day", None, ["strained", "proud"], 0.35, "xianting", []),
    ("p5672", "太监打抽丰", "neiyuan", "day", None, ["extortion", "dread"], 0.42, "anliu", []),
    ("p5676", "倚势霸成亲", "neiyuan", "dusk", None, ["coercion", "sour"], 0.4, "anliu", []),

    # ---- 第七十三回 痴丫头误拾绣春囊 懦小姐不问累金凤 ----
    ("p5716", "夜读急就章", "yihong", "night", None, ["cramming", "jittery"], 0.32, "xianting", []),
    ("p5722", "夜警查赌", "daguan_autumn", "night", None, ["alarm", "sweep"], 0.4, "anliu", []),
    ("p5734", "误拾绣春囊", "daguan_autumn", "day", None, ["trigger", "ominous"], 0.5, "anliu", []),
    ("p5737", "懦小姐累金凤", "shuixie", "day", None, ["meek", "fleeced"], 0.35, "xianting", []),

    # ---- 第七十四回 惑奸谗抄检大观园 矢孤介杜绝宁国府 ----
    ("p5794", "绣春囊震怒", "neiyuan", "day", None, ["accusation", "storm"], 0.55, "anliu", []),
    ("p5808", "谗言及晴雯", "neiyuan", "day", None, ["slander", "defiant"], 0.5, "anliu", []),
    ("p5814", "夜抄大观园", "raid", "night", None, ["inquisition", "violation"], 0.68, "bianzheng", []),
    ("p5821", "秋爽斋之怒", "qiushuang", "night", None, ["dignity", "prophetic"], 0.66, "bianzheng", []),
    ("p5829", "司棋事发", "raid", "night", None, ["exposure", "ruin"], 0.6, "bianzheng", []),
    ("p5840", "矢孤介绝宁府", "neiyuan", "day", None, ["coldpurity", "rift"], 0.42, "anliu", []),

    # ---- 第七十五回 开夜宴异兆发悲音 赏中秋新词得佳谶 ----
    ("p5886", "甄家风声", "daoxiang", "day", None, ["foreboding", "hushed"], 0.4, "anliu", []),
    ("p5895", "晚膳米艰", "jiamu", "dusk", None, ["thrift", "decline"], 0.32, "xianting", []),
    ("p5903", "宁府夜赌", "ningfu", "night", None, ["dissolute", "rowdy"], 0.4, "anliu", []),
    ("p5913", "祠堂异兆", "ningfu", "night", None, ["eerie", "chill"], 0.55, "anliu", []),
    ("p5919", "凸碧堂传花", "moonpav", "night", None, ["reunion", "thin"], 0.35, "pinghu", []),

    # ---- 第七十六回 凸碧堂品笛感凄清 凹晶馆联诗悲寂寞 ----
    ("p5970", "品笛感凄清", "moonpav", "night", None, ["desolate", "tearful"], 0.45, "hangong", []),
    ("p5984", "凹晶馆联诗", "moonpav", "night", None, ["crystalline", "plangent"], 0.45, "pinghu", ["crickets"]),
    ("p6060", "栊翠庵续诗", "longcui", "night", None, ["transcendent", "warm"], 0.34, "meihua", []),

    # ---- 第七十七回 俏丫鬟抱屈夭风流 美优伶斩情归水月 ----
    ("p6134", "人参风波", "neiyuan", "day", None, ["depleted", "scrounging"], 0.32, "xianting", []),
    ("p6140", "司棋被逐", "daguan_autumn", "day", None, ["expulsion", "pleading"], 0.5, "aiyin", []),
    ("p6151", "抄检怡红", "yihong", "day", None, ["purge", "heartbreak"], 0.6, "bianzheng", []),
    ("p6164", "夜探晴雯", "commonhouse", "dusk", None, ["deathbed", "fierce", "love"], 0.62, "hangong", []),
    ("p6176", "归园惊梦", "yihong", "night", None, ["grief", "dream"], 0.5, "aiyin", []),
    ("p6183", "斩情归水月", "neiyuan", "day", None, ["renunciation", "stark"], 0.42, "kongshan", ["temple"]),

    # ---- 第七十八回 老学士闲征姽婳词 痴公子杜撰芙蓉诔 ----
    ("p6215", "袭人名分定", "jiamu", "morning", None, ["settling", "subdued"], 0.3, "xianting", []),
    ("p6224", "芙蓉花神", "daguan_autumn", "dusk", None, ["mythmaking", "consoling"], 0.4, "hangong", []),
    ("p6233", "闲征姽婳词", "study", "night", None, ["martial", "literary"], 0.32, "pinghu", []),
    ("p6290", "杜撰芙蓉诔", "flowermound", "night", None, ["requiem", "exalted"], 0.58, "aiyin", ["crickets"]),

    # ---- 第七十九回 薛文龙悔娶河东狮 贾迎春误嫁中山狼 ----
    ("p6429", "花影改诔", "flowermound", "night", None, ["uncanny", "tender"], 0.45, "hangong", []),
    ("p6434", "误嫁中山狼", "neiyuan", "day", None, ["resigned", "wrong"], 0.4, "anliu", []),
    ("p6449", "河东狮进门", "lixiang", "day", None, ["misalliance", "brassy"], 0.35, "xianting", []),

    # ---- 第八十回 美香菱屈受贪夫棒 王道士胡诌妒妇方 ----
    ("p6482", "香菱屈受", "lixiang", "day", None, ["torment", "scheming"], 0.45, "anliu", []),
    ("p6505", "天齐庙妒妇方", "temple", "day", None, ["quack", "comic"], 0.28, "xianting", []),
    ("p6514", "迎春归宁泣诉", "neiyuan", "dusk", None, ["battered", "weeping"], 0.5, "aiyin", []),

    # ---- 第八十一回 占旺相四美钓游鱼 奉严词两番入家塾 ----
    ("p6541", "四美钓游鱼", "shuixie", "day", None, ["diminished", "pastime"], 0.3, "pinghu", []),
    ("p6549", "奉严词", "study", "day", None, ["stern", "dutiful"], 0.32, "xianting", []),
    ("p6552", "两番入家塾", "school", "morning", None, ["regimented", "dull"], 0.3, "xianting", []),

    # ---- 第八十二回 老学究讲义警顽心 病潇湘痴魂惊噩梦 ----
    ("p6578", "下学访潇湘", "xiaoxiang", "dusk", None, ["affinity", "studious"], 0.28, "chunjiang", ["bamboo"]),
    ("p6582", "袭人闲话", "xiaoxiang", "day", None, ["probing", "uneasy"], 0.28, "xianting", []),
    ("p6585", "痴魂惊噩梦", "xiaoxiang", "night", None, ["nightmare", "terror", "abandonment"], 0.62, "anliu", ["snowwind"]),
    ("p6589", "惊醒见血", "xiaoxiang", "dawn", None, ["hemorrhage", "dread"], 0.55, "aiyin", []),

    # ---- 第八十三回 省宫闱贾元妃染恙 闹闺阃薛宝钗吞声 ----
    ("p6608", "窗外恶语", "xiaoxiang", "day", None, ["misheard", "wounded"], 0.35, "hangong", []),
    ("p6613", "省宫闱", "palace", "day", None, ["courtly", "anxious"], 0.38, "anliu", []),
    ("p6623", "闹闺阃", "lixiang", "day", None, ["shrewstorm", "swallowed"], 0.45, "bianzheng", []),

    # ---- 第八十四回 试文字宝玉始提亲 探惊风贾环重结怨 ----
    ("p6650", "肝气之痛", "lixiang", "day", None, ["aching", "weary"], 0.3, "xianting", []),
    ("p6651", "试文字始提亲", "jiamu", "day", None, ["examining", "matchmaking"], 0.32, "xianting", []),
    ("p6662", "探惊风结怨", "neiyuan", "day", None, ["sickroom", "spite"], 0.4, "anliu", []),

    # ---- 第八十五回 贾存周报升郎中任 薛文起复惹放流刑 ----
    ("p6690", "北静王府贺寿", "capital", "day", None, ["courtly", "bright"], 0.3, "yanle", []),
    ("p6699", "探口风", "yihong", "night", None, ["tentative", "wistful"], 0.3, "xianting", []),
    ("p6703", "黛玉生辰观戏", "banquet", "day", None, ["festive", "fragile"], 0.32, "yanle", []),
    ("p6708", "人命惊变", "lixiang", "day", None, ["catastrophe", "scramble"], 0.55, "bianzheng", []),

    # ---- 第八十六回 受私贿老官翻案牍 寄闲情淑女解琴书 ----
    ("p6732", "打点刑名", "lixiang", "day", None, ["bribery", "grinding"], 0.4, "anliu", []),
    ("p6744", "淑女解琴书", "xiaoxiang", "day", None, ["refined", "tender"], 0.28, "chunjiang", ["bamboo"]),

    # ---- 第八十七回 感秋深抚琴悲往事 坐禅寂走火入邪魔 ----
    ("p6772", "感秋故园书", "xiaoxiang", "day", None, ["autumnal", "homesick"], 0.4, "hangong", []),
    ("p6784", "蓼风轩观棋", "daguan_autumn", "day", None, ["cool", "zen"], 0.28, "pinghu", []),
    ("p6788", "抚琴悲往事", "xiaoxiang", "dusk", None, ["plangent", "keening"], 0.5, "hangong", ["bamboo"]),
    ("p6797", "坐禅走火", "longcui", "night", None, ["turmoil", "possession"], 0.52, "anliu", []),

    # ---- 第八十八回 博庭欢宝玉赞孤儿 正家法贾珍鞭悍仆 ----
    ("p6841", "博庭欢", "jiamu", "day", None, ["doting", "pious"], 0.26, "xianting", []),
    ("p6845", "正家法", "ningfu", "day", None, ["discipline", "rough"], 0.38, "anliu", []),
    ("p6847", "贾芸钻营", "neiyuan", "day", None, ["obsequious", "snubbed"], 0.3, "xianting", []),
    ("p6852", "夜半惊魂", "neiyuan", "night", None, ["jumpy", "haunted"], 0.42, "anliu", []),

    # ---- 第八十九回 人亡物在公子填词 蛇影杯弓颦卿绝粒 ----
    ("p6870", "寒冬诸事", "neiyuan", "day", None, ["wintry", "routine"], 0.28, "xianting", []),
    ("p6874", "人亡物在", "yihong", "day", None, ["keepsake", "mourning"], 0.45, "aiyin", []),
    ("p6881", "琴画清谈", "xiaoxiang", "day", None, ["serene", "doubleedged"], 0.3, "chunjiang", ["bamboo"]),
    ("p6884", "蛇影杯弓", "xiaoxiang", "day", None, ["misconstrued", "despair"], 0.5, "anliu", []),
    ("p6887", "颦卿绝粒", "xiaoxiang", "morning", None, ["selferasure", "wasting"], 0.55, "aiyin", []),

    # ---- 第九十回 失绵衣贫女耐嗷嘈 送果品小郎惊叵测 ----
    ("p6906", "心病心药", "xiaoxiang", "day", None, ["reprieve", "frail"], 0.4, "hangong", []),
    ("p6913", "失绵衣", "shuixie", "day", None, ["pettytheft", "forbearing"], 0.3, "xianting", []),
    ("p6917", "送果品叵测", "lixiang", "night", None, ["seductive", "queasy"], 0.38, "anliu", []),

    # ---- 第九十一回 纵淫心宝蟾工设计 布疑阵宝玉妄谈禅 ----
    ("p6933", "宝蟾设计", "lixiang", "night", None, ["lust", "scheme"], 0.4, "anliu", []),
    ("p6938", "狱案家书", "lixiang", "day", None, ["grinding", "anxious"], 0.35, "xianting", []),
    ("p6944", "妄谈禅", "xiaoxiang", "night", None, ["zenriddle", "pledge"], 0.4, "kongshan", []),

    # ---- 第九十二回 评女传巧姐慕贤良 玩母珠贾政参聚散 ----
    ("p6969", "评女传", "jiamu", "day", None, ["didactic", "cozy"], 0.26, "xianting", []),
    ("p6975", "玩母珠参聚散", "study", "day", None, ["portent", "melancholy"], 0.32, "pinghu", []),

    # ---- 第九十三回 甄家仆投靠贾家门 水月庵掀翻风月案 ----
    ("p7024", "临安伯观剧", "banquet", "day", None, ["theatrical", "recognition"], 0.3, "yuzhou", []),
    ("p7030", "甄仆投靠", "ronghall", "day", None, ["refugee", "echo"], 0.35, "anliu", []),
    ("p7033", "门贴风月案", "ronghall", "day", None, ["scandal", "fury"], 0.45, "bianzheng", []),
    ("p7039", "水月庵查处", "tiejian", "day", None, ["roundup", "seedy"], 0.35, "anliu", []),

    # ---- 第九十四回 宴海棠贾母赏花妖 失宝玉通灵知奇祸 ----
    ("p7060", "风波善后", "ronghall", "day", None, ["patching", "uneasy"], 0.3, "xianting", []),
    ("p7065", "宴海棠花妖", "yihong", "day", None, ["uncanny", "forcedcheer"], 0.42, "anliu", []),
    ("p7079", "失通灵知奇祸", "yihong", "dusk", None, ["loss", "panic", "frantic"], 0.6, "bianzheng", []),

    # ---- 第九十五回 因讹成实元妃薨逝 以假混真宝玉疯癫 ----
    ("p7100", "扶乩问玉", "longcui", "day", None, ["occult", "grasping"], 0.4, "anliu", []),
    ("p7107", "元妃薨逝", "palace", "day", None, ["statemourn", "heavy"], 0.5, "aiyin", []),
    ("p7112", "宝玉疯癫", "yihong", "day", None, ["vacant", "dimming"], 0.5, "aiyin", []),
    ("p7116", "以假混真", "ronghall", "day", None, ["fraud", "grim"], 0.4, "anliu", []),

    # ---- 第九十六回 瞒消息凤姐设奇谋 泄机关颦儿迷本性 ----
    ("p7129", "设奇谋", "jiamu", "day", None, ["hurried", "fatalplan"], 0.45, "anliu", []),
    ("p7135", "泄机关", "daguan_autumn", "day", None, ["shattering", "daze"], 0.65, "bianzheng", []),
    ("p7137", "相对痴笑", "jiamu", "day", None, ["hollow", "chilling"], 0.6, "aiyin", []),

    # ---- 第九十七回 林黛玉焚稿断痴情 薛宝钗出闺成大礼 ----
    ("p7149", "迷本性回馆", "xiaoxiang", "day", None, ["daze", "sinking"], 0.6, "aiyin", []),
    ("p7152", "试玉定计", "neiyuan", "day", None, ["testing", "conspiring"], 0.42, "anliu", []),
    ("p7159", "焚稿断痴情", "xiaoxiang", "night", None, ["immolation", "finality"], 0.7, "hangong", []),
    ("p7171", "出闺成大礼", "banquet", "night", None, ["weddingmask", "surreal"], 0.55, "yanle", []),
    ("p7174", "礼成病发", "yihong", "day", None, ["collapse", "duped"], 0.5, "aiyin", []),

    # ---- 第九十八回 苦绛珠魂归离恨天 病神瑛泪洒相思地 ----
    ("p7198", "魂魄游离", "yihong", "day", None, ["liminal", "otherworld"], 0.55, "taixu", []),
    ("p7204", "魂归离恨天", "xiaoxiang", "night", None, ["death", "unappeased"], 0.75, "aiyin", []),
    ("p7208", "两处忙乱", "neiyuan", "day", None, ["aftermath", "weary"], 0.45, "aiyin", []),
    ("p7212", "泪洒相思地", "xiaoxiang", "day", None, ["grief", "torrent"], 0.6, "hangong", ["bamboo"]),

    # ---- 第九十九回 守官箴恶奴同破例 阅邸报老舅自担惊 ----
    ("p7224", "病愈谈书", "neiyuan", "day", None, ["convalescent", "wry"], 0.3, "xianting", []),
    ("p7226", "守官箴", "court", "day", None, ["corruption", "drift"], 0.4, "anliu", []),
    ("p7232", "阅邸报担惊", "study", "day", None, ["letters", "alarm"], 0.38, "anliu", []),

    # ---- 第一〇〇回 破好事香菱结深恨 悲远嫁宝玉感离情 ----
    ("p7270", "薛案反复", "court", "day", None, ["grinding", "costly"], 0.4, "anliu", []),
    ("p7272", "香菱结深恨", "lixiang", "day", None, ["venom", "thwarted"], 0.42, "anliu", []),
    ("p7275", "悲远嫁", "jiamu", "day", None, ["farewell", "resigned"], 0.48, "yangguan", []),

    # ---- 第一〇一回 大观园月夜感幽魂 散花寺神签惊异兆 ----
    ("p7287", "月夜感幽魂", "daguan_autumn", "night", None, ["ghostly", "shiver"], 0.5, "anliu", ["snowwind"]),
    ("p7289", "内外交困", "neiyuan", "day", None, ["harried", "sour"], 0.36, "xianting", []),
    ("p7297", "散花寺神签", "temple", "day", None, ["oracle", "disquiet"], 0.4, "anliu", ["temple"]),

    # ---- 第一〇二回 宁国府骨肉病灾祲 大观园符水驱妖孽 ----
    ("p7319", "探春辞行", "neiyuan", "day", None, ["departure", "brave"], 0.45, "yangguan", []),
    ("p7321", "园荒妖异", "daguan_autumn", "day", None, ["derelict", "haunted"], 0.45, "anliu", []),
    ("p7327", "符水驱妖", "daguan_autumn", "day", None, ["exorcism", "farce"], 0.35, "xianting", []),

    # ---- 第一〇三回 施毒计金桂自焚身 昧真禅雨村空遇旧 ----
    ("p7352", "部里打点", "neiyuan", "day", None, ["procedural"], 0.32, "xianting", []),
    ("p7353", "毒计自焚身", "lixiang", "day", None, ["poison", "boomerang"], 0.55, "bianzheng", []),
    ("p7363", "急流津遇旧", "countryside", "day", None, ["riddling", "missed"], 0.4, "kongshan", []),

    # ---- 第一〇四回 醉金刚小鳅生大浪 痴公子馀痛触前情 ----
    ("p7378", "小鳅生大浪", "capital", "day", None, ["street", "rumbling"], 0.32, "xianting", []),
    ("p7386", "贾政还朝", "ronghall", "day", None, ["homecoming", "foreboding"], 0.35, "xianting", []),
    ("p7390", "馀痛触前情", "yihong", "night", None, ["longing", "secretgrief"], 0.48, "hangong", []),

    # ---- 第一〇五回 锦衣军查抄宁国府 骢马使弹劾平安州 ----
    ("p7400", "锦衣军查抄", "ronghall", "day", None, ["raid", "catastrophe", "rout"], 0.8, "bianzheng", []),
    ("p7404", "内眷惊散", "jiamu", "day", None, ["terror", "collapse"], 0.7, "bianzheng", []),
    ("p7409", "听候旨意", "ronghall", "dusk", None, ["suspense", "shame"], 0.55, "anliu", []),

    # ---- 第一〇六回 王熙凤致祸抱羞惭 贾太君祷天消祸患 ----
    ("p7438", "惊悸病倒", "jiamu", "day", None, ["shaken", "frail"], 0.5, "aiyin", []),
    ("p7443", "致祸抱羞惭", "neiyuan", "day", None, ["reckoning", "disgrace"], 0.5, "anliu", []),
    ("p7445", "祷天消祸患", "jiamu", "night", None, ["prayer", "selfless"], 0.52, "aiyin", []),

    # ---- 第一〇七回 散馀资贾母明大义 复世职政老沐天恩 ----
    ("p7459", "复世职", "court", "day", None, ["reprieve", "qualified"], 0.4, "xianting", []),
    ("p7462", "散馀资明大义", "jiamu", "day", None, ["matriarch", "clearance"], 0.45, "aiyin", []),
    ("p7472", "家道萧条", "capital", "day", None, ["diminished", "watchful"], 0.38, "anliu", []),

    # ---- 第一〇八回 强欢笑蘅芜庆生辰 死缠绵潇湘闻鬼哭 ----
    ("p7491", "家计重整", "ronghall", "day", None, ["salvage", "plainer"], 0.35, "xianting", []),
    ("p7493", "强欢笑庆生辰", "jiamu", "day", None, ["forcedgaiety", "threadbare"], 0.38, "yanle", []),
    ("p7498", "潇湘闻鬼哭", "xiaoxiang", "night", None, ["haunting", "inconsolable"], 0.55, "hangong", ["snowwind"]),

    # ---- 第一〇九回 候芳魂五儿承错爱 还孽债迎女返真元 ----
    ("p7522", "释疑劝慰", "yihong", "night", None, ["soothing", "candid"], 0.35, "xianting", []),
    ("p7526", "候芳魂错爱", "yihong", "night", None, ["vigil", "mistaken"], 0.4, "hangong", []),
    ("p7533", "贾母病笃", "jiamu", "day", None, ["sinking", "gathering"], 0.5, "aiyin", []),

    # ---- 第一一〇回 史太君寿终归地府 王凤姐力诎失人心 ----
    ("p7549", "寿终归地府", "jiamu", "day", None, ["deathbed", "solemn", "love"], 0.62, "aiyin", []),
    ("p7551", "力诎失人心", "mourning", "day", None, ["understaffed", "humiliated"], 0.48, "anliu", []),

    # ---- 第一一一回 鸳鸯女殉主登太虚 狗彘奴欺天招伙盗 ----
    ("p7575", "辞灵之夜", "mourning", "night", None, ["vigil", "drained"], 0.5, "aiyin", []),
    ("p7577", "鸳鸯殉主", "jiamu", "night", None, ["devotion", "death", "eerie"], 0.6, "aiyin", []),
    ("p7582", "家贼引盗", "capital", "night", None, ["treachery", "heist"], 0.5, "bianzheng", []),
    ("p7585", "夜盗入园", "raid", "night", None, ["breakin", "alarm"], 0.58, "bianzheng", []),

    # ---- 第一一二回 活冤孽妙尼遭大劫 死雠仇赵妾赴冥曹 ----
    ("p7602", "失盗善后", "neiyuan", "day", None, ["reckoning", "sullen"], 0.4, "anliu", []),
    ("p7609", "妙尼遭大劫", "longcui", "night", None, ["abduction", "violation"], 0.6, "bianzheng", []),
    ("p7614", "赵妾赴冥曹", "tiejian", "day", None, ["possession", "grotesque"], 0.52, "anliu", ["temple"]),

    # ---- 第一一三回 忏宿冤凤姐托村妪 释旧憾情婢感痴郎 ----
    ("p7632", "寺中余悸", "tiejian", "day", None, ["shaken", "murmuring"], 0.4, "anliu", []),
    ("p7635", "忏宿冤托村妪", "neiyuan", "day", None, ["visions", "entrustment"], 0.55, "aiyin", []),
    ("p7641", "释旧憾感痴郎", "yihong", "night", None, ["thaw", "sharedgrief"], 0.45, "hangong", []),

    # ---- 第一一四回 王熙凤历幻返金陵 甄应嘉蒙恩还玉阙 ----
    ("p7650", "历幻返金陵", "neiyuan", "night", None, ["death", "passing"], 0.55, "aiyin", []),
    ("p7656", "甄应嘉来访", "ronghall", "day", None, ["courtesy", "subdued"], 0.32, "xianting", []),

    # ---- 第一一五回 惑偏私惜春矢素志 证同类宝玉失相知 ----
    ("p7667", "惜春矢素志", "neiyuan", "day", None, ["vow", "austere"], 0.42, "kongshan", []),
    ("p7672", "两个宝玉", "ronghall", "day", None, ["mirror", "disillusion"], 0.4, "taixu", []),
    ("p7678", "病笃僧至", "yihong", "day", None, ["crisis", "summons"], 0.55, "anliu", []),

    # ---- 第一一六回 得通灵幻境悟仙缘 送慈柩故乡全孝道 ----
    ("p7694", "重游幻境", "taixu", "dream", None, ["revelation", "cyclecomplete"], 0.6, "taixu", []),
    ("p7709", "苏醒了悟", "yihong", "day", None, ["clarified", "detached"], 0.4, "kongshan", []),
    ("p7711", "送柩全孝道", "journey", "day", None, ["filial", "longroad"], 0.4, "yangguan", []),

    # ---- 第一一七回 阻超凡佳人双护玉 欣聚党恶子独承家 ----
    ("p7718", "双护玉", "yihong", "day", None, ["tugofwar", "fervent"], 0.48, "anliu", []),
    ("p7725", "恶子独承家", "study", "night", None, ["dissolute", "takeover"], 0.42, "anliu", []),
]
