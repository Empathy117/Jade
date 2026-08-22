#!/usr/bin/env python3
"""Assemble codex.json (档案) for books/local/hongloumeng.

    uv run --no-project python scripts/build_hongloumeng_codex.py

Every anchor below was verified against source.json prose before being
recorded (first textual introduction for characters, the revealing
paragraph for aliases, facts, relationships and status changes). Roles
describe only what the text has said by the character's anchor; ending-
level information stays out per the production protocol.
"""

from __future__ import annotations

import json
from pathlib import Path

BUNDLE = Path("books/local/hongloumeng")

RONG = "荣国府"
NING = "宁国府"
KIN = "史王薛亲眷"
MAID = "丫鬟仆妇"
BEYOND = "方外幻境"
OUTER = "府外人物"


def C(cid, name, at, role, group, aliases=(), facts=(), status=(), check=None):
    entry = {"id": f"char_{cid}", "name": name, "at": at, "role": role, "group": group}
    entry["_check"] = check or name
    if aliases:
        entry["aliases"] = [{"name": n, "at": a} for n, a in aliases]
    if facts:
        entry["facts"] = [{"text": t, "at": a} for t, a in facts]
    if status:
        entry["status"] = [{"label": lb, "kind": k, "at": a} for lb, k, a in status]
    return entry


CHARACTERS = [
    # ---- 荣国府 ----
    C("ronggong", "荣国公", "p0375", "荣府始祖，与宁国公一母同胞", RONG,
      aliases=[("贾源", "p0455")]),
    C("daishan", "贾代善", "p0375", "荣国公长子，袭荣府之职，娶史侯家小姐", RONG,
      status=[("早已去世", "dead", "p0375")]),
    C("jiamu", "贾母", "p0375", "贾代善之妻，史侯家小姐，两府之上的老祖宗", RONG,
      aliases=[("史太君", "p0445"), ("老祖宗", "p0450")],
      status=[("寿终归地府", "dead", "p7550")]),
    C("jiashe", "贾赦", "p0375", "贾代善长子，袭一等将军之职", RONG),
    C("jiazheng", "贾政", "p0375", "贾代善次子，自幼酷喜读书，任职工部", RONG),
    C("xingfuren", "邢夫人", "p0452", "贾赦之妻，迎春的继母", RONG),
    C("wangfuren", "王夫人", "p0451", "贾政之妻，王家小姐，宝玉之母", RONG),
    C("jiamin", "贾敏", "p0380", "贾代善之女，嫁扬州巡盐御史林如海", RONG,
      status=[("一疾而终", "dead", "p0367")]),
    C("zhaoyiniang", "赵姨娘", "p1860", "贾政之妾，贾环探春生母", RONG,
      status=[("寺中暴病身亡", "dead", "p7615")]),
    C("jialian", "贾琏", "p0381", "贾赦长子，捐同知，帮着料理荣府家务", RONG),
    C("wangxifeng", "王熙凤", "p0449", "王夫人内侄女，贾琏之妻，当家二奶奶", RONG,
      aliases=[("凤辣子", "p0448")],
      facts=[("协理宁国府，威重令行。", "p1268"),
             ("生日当天撞破贾琏私情，大闹一场。", "p3574")],
      status=[("病势缠绵日重", "unknown", "p7469"), ("停床而逝", "dead", "p7653")]),
    C("jiazhu", "贾珠", "p0572", "贾政长子，十四岁进学，娶李纨", RONG,
      status=[("不到二十岁一病死了", "dead", "p0572")]),
    C("lywan", "李纨", "p0572", "国子监祭酒之女，贾珠之妻，守节抚孤", RONG,
      aliases=[("宫裁", "p0572"), ("稻香老农", "p2944")]),
    C("jialan", "贾兰", "p0572", "贾珠与李纨之子，五岁入学攻书", RONG,
      facts=[("与宝玉同场乡试，中了举人。", "p7793")]),
    C("yuanchun", "元春", "p0380", "贾政长女，以贤孝才德选入宫中作女史", RONG,
      aliases=[("贾妃", "p1535"), ("元妃", "p1546")],
      facts=[("才选凤藻宫，加封贤德妃。", "p1401"),
             ("元宵归省，敕建大观园。", "p1533")],
      status=[("薨逝", "dead", "p7108")]),
    C("yingchun", "迎春", "p0380", "贾赦之妾所出的二小姐，性情懦静", RONG,
      facts=[("误嫁孙绍祖，归宁泣诉。", "p6514")],
      status=[("嫁孙绍祖", "alive", "p6448"), ("受磨折而亡", "dead", "p7538")]),
    C("tanchun", "探春", "p0380", "贾政庶出的三小姐，赵姨娘所生，精明有志", RONG,
      aliases=[("蕉下客", "p2945")],
      facts=[("发起海棠诗社。", "p2935"), ("代凤姐理家，兴利除宿弊。", "p4502")],
      status=[("远嫁海疆", "alive", "p7320"), ("随翁婿回京探亲", "alive", "p7754")]),
    C("xichun", "惜春", "p0380", "宁府贾珍的胞妹，自幼在荣府贾母身边", RONG,
      facts=[("奉命描画大观园。", "p3450")],
      status=[("矢志出家，妆改缁衣", "alive", "p7744")]),
    C("baoyu", "宝玉", "p0375", "贾政次子，衔玉而诞，阖府捧为凤凰", RONG,
      aliases=[("宝二爷", "p0854"), ("怡红公子", "p2976"), ("绛洞花主", "p2947")],
      facts=[("周岁抓周只把脂粉钗环抓来。", "p0375"),
             ("梦游太虚幻境，看了金陵十二钗册子。", "p0669"),
             ("大承笞挞，险些送命。", "p2758"),
             ("失了通灵玉后疯癫失性。", "p7112")],
      status=[("中乡魁后走失", "missing", "p7790"),
              ("毘陵驿雪中拜别，随僧道而去", "missing", "p7815")]),
    C("daiyu", "黛玉", "p0441", "林如海与贾敏独女，自幼体弱，寄居外祖母家", RONG,
      aliases=[("颦颦", "p0472"), ("潇湘妃子", "p2946")],
      facts=[("前身为西方灵河岸上绛珠仙草，为还泪而来。", "p0216"),
             ("花冢葬花，作葬花吟。", "p2372"),
             ("重建桃花社，作桃花行。", "p5504")],
      status=[("焚稿断痴情", "unknown", "p7161"),
              ("魂归离恨天", "dead", "p7206")]),
    C("jiahuan", "贾环", "p1608", "贾政庶子，赵姨娘所生", RONG,
      facts=[("推灯烫伤宝玉。", "p2215"), ("向贾政进谗，引出笞挞之祸。", "p2757")]),
    C("qiaojie", "大姐儿", "p0858", "贾琏与凤姐之女", RONG,
      aliases=[("巧姐", "p2352"), ("巧哥儿", "p3433")],
      facts=[("刘姥姥给她取名「巧哥儿」，以毒攻毒。", "p3433"),
             ("被舅兄算计，藏到刘姥姥庄上。", "p7795")]),
    # ---- 宁国府 ----
    C("ninggong", "宁国公", "p0375", "宁府始祖，居长，生四子", NING),
    C("daihua", "贾代化", "p0375", "宁国公长子，袭了官", NING,
      status=[("已故", "dead", "p0375")]),
    C("jiafu", "贾敷", "p0375", "贾代化长子", NING,
      status=[("八九岁上死了", "dead", "p0375")]),
    C("jiajing", "贾敬", "p0375", "贾代化次子，乙卯科进士，一味好道炼丹", NING,
      facts=[("把官让与贾珍，只在都外和道士们胡羼。", "p0375")],
      status=[("吞丹宾天", "dead", "p5097")]),
    C("jiazhen", "贾珍", "p0375", "贾敬之子，现袭三品爵，族长", NING),
    C("youshi", "尤氏", "p0662", "贾珍之妻，宁府当家奶奶", NING,
      facts=[("贾母八旬庆时独艳理宁国府丧仪家务。", "p5099")]),
    C("jiarong", "贾蓉", "p0375", "贾珍之子，捐的龙禁尉", NING),
    C("qinkeqing", "秦氏", "p0663", "贾蓉之妻，秦业养女，性情温柔和平", NING,
      aliases=[("可卿", "p0748")],
      facts=[("病中托梦凤姐，嘱备祖茔家塾之计。", "p1197")],
      status=[("病重", "unknown", "p1095"), ("忽然去世", "dead", "p1202")]),
    C("jiaqiang", "贾蔷", "p1045", "宁府正派玄孙，父母早亡，外相秀美", NING,
      facts=[("下姑苏采买十二个女孩子办省亲戏班。", "p1416")]),
    C("jiayun", "贾芸", "p2155", "后廊上五嫂子的儿子，谋事乖觉的族中子弟", RONG,
      facts=[("借倪二银子买冰麝孝敬凤姐，谋得种树差事。", "p2161")]),
    C("jiarui", "贾瑞", "p1043", "代儒之孙，在家塾中暂管学事", RONG,
      facts=[("见熙凤起淫心，反遭毒设相思局。", "p1130")],
      status=[("正照风月鉴而亡", "dead", "p1176")]),
    C("jiadairu", "贾代儒", "p1043", "家塾塾师，贾瑞的祖父", RONG),
    C("qinzhong", "秦钟", "p0924", "秦可卿之弟，眉清目秀，与宝玉同入家塾", OUTER,
      aliases=[("鲸卿", "p0999")],
      facts=[("与馒头庵小尼智能私情。", "p1362")],
      status=[("夭逝黄泉路", "dead", "p1427")]),
    # ---- 史王薛亲眷 ----
    C("xiangyun", "湘云", "p1863", "史侯家的姑娘，贾母娘家侄孙女，大笑大说", KIN,
      aliases=[("枕霞旧友", "p3074")],
      facts=[("醉眠芍药裀。", "p4979"), ("凹晶馆与黛玉联诗「寒塘渡鹤影」。", "p6054")]),
    C("xueyima", "薛姨妈", "p0596", "王夫人之妹，薛蟠宝钗之母，寄居贾府", KIN),
    C("xuepan", "薛蟠", "p0593", "紫薇舍人薛公之后，人称呆霸王", KIN,
      aliases=[("文起", "p0593"), ("呆霸王", "p3737")],
      facts=[("为争英莲打死冯渊，倚势了结官司。", "p0592"),
             ("酒肆殴伤人命，问成流刑后遇赦。", "p6708")]),
    C("baochai", "宝钗", "p0593", "薛蟠之妹，肌骨莹润，举止娴雅，随母进京", KIN,
      aliases=[("蘅芜君", "p2946")],
      facts=[("金锁上錾着「不离不弃，芳龄永继」。", "p0983"),
             ("出闺成大礼，嫁与宝玉。", "p7172")]),
    C("xueke", "薛蝌", "p3864", "薛蟠从弟，护送胞妹宝琴进京发嫁", KIN),
    C("baoqin", "宝琴", "p3864", "薛蝌胞妹，许配梅翰林之子，见多识广", KIN,
      facts=[("立雪折梅，贾母赞比画儿上还好。", "p4082"),
             ("新编怀古诗十首。", "p4172")]),
    C("xiuyan", "岫烟", "p3864", "邢夫人侄女，家道贫寒，端雅稳重", KIN,
      facts=[("与薛蝌定亲。", "p4638")]),
    C("liwen", "李纹", "p3864", "李纨寡婶长女", KIN),
    C("liqi", "李绮", "p3864", "李纨寡婶次女", KIN),
    C("xiajingui", "夏金桂", "p6451", "桂花夏家小姐，薛蟠之妻，爱自己尊若菩萨", KIN,
      check="金桂",
      facts=[("折磨香菱，把持薛蟠。", "p6482")],
      status=[("下毒反误了自己性命", "dead", "p7354")]),
    C("sunshaozu", "孙绍祖", "p6434", "大同府人氏，袭指挥之职，迎春之夫", OUTER,
      aliases=[("中山狼", "p6428")]),
    # ---- 丫鬟仆妇 ----
    C("xiren", "袭人", "p0475", "宝玉房里的大丫鬟，柔媚娇俏，心地纯良", MAID,
      facts=[("本名珍珠，是贾母之婢。", "p0476"),
             ("王夫人把她的月钱抬到姨娘分例。", "p2893")],
      status=[("含悲别嫁蒋玉菡", "alive", "p7828")]),
    C("qingwen", "晴雯", "p0668", "宝玉房里的丫鬟，眉眼爽利，针线出众", MAID,
      facts=[("撕扇子作千金一笑。", "p2673"), ("病中连夜补雀金裘。", "p4316")],
      status=[("抱屈被逐", "unknown", "p6151"), ("含冤夭亡", "dead", "p6230")]),
    C("sheyue", "麝月", "p0668", "宝玉房里的丫鬟，公然又是一个袭人", MAID),
    C("qiuwen", "秋纹", "p2181", "宝玉房里的丫鬟", MAID),
    C("qianxue", "茜雪", "p0919", "宝玉房里的丫鬟，因枫露茶风波被撵", MAID),
    C("zijuan", "紫鹃", "p0990", "黛玉的大丫鬟，情深意重", MAID,
      facts=[("一句「回苏州去」试出宝玉痴心。", "p4611"),
             ("自愿跟惜春出家修行。", "p7744")]),
    C("xueyan", "雪雁", "p0475", "黛玉从苏州带来的小丫鬟", MAID),
    C("pinger", "平儿", "p0857", "凤姐的心腹通房大丫头，周全体贴", MAID,
      facts=[("俏平儿情掩虾须镯。", "p4289"), ("判冤决狱，宽放柳家母女。", "p4919")]),
    C("yuanyang", "鸳鸯", "p1852", "贾母房里的大丫鬟，贾母离她饭都吃不下", MAID,
      facts=[("誓绝鸳鸯偶，铰发明志。", "p3716")],
      status=[("殉主而逝", "dead", "p7579")]),
    C("yinger", "莺儿", "p0909", "宝钗的丫鬟，巧手会打络子", MAID,
      aliases=[("黄金莺", "p2869")]),
    C("yinglian", "英莲", "p0213", "甄士隐独女，眉心一点胭脂记", MAID,
      aliases=[("香菱", "p0913"), ("秋菱", "p6484")],
      facts=[("元宵夜被拐子抱走。", "p0244"),
             ("被卖入薛家，随宝钗等入住大观园。", "p6501"),
             ("慕雅苦吟学诗，梦中得句。", "p3822")],
      status=[("元宵失散", "missing", "p0244"), ("产难完劫（士隐语）", "dead", "p7832")]),
    C("jinchuan", "金钏", "p0913", "王夫人房里的丫鬟", MAID,
      status=[("含耻投井", "dead", "p2733")]),
    C("yuchuan", "玉钏", "p2213", "王夫人房里的丫鬟，金钏之妹", MAID),
    C("caiyun", "彩云", "p2213", "王夫人房里的丫鬟，素与贾环相好", MAID),
    C("xiaohong", "小红", "p2183", "怡红院粗使丫鬟，眼空心大，口齿伶俐", MAID,
      aliases=[("红玉", "p2183")],
      facts=[("滴翠亭遗帕惹相思。", "p2302"), ("得凤姐赏识要了过去。", "p2365")]),
    C("siqi", "司棋", "p0914", "迎春的丫鬟", MAID,
      facts=[("抄检时查出与表弟潘又安私情，被逐。", "p5834")],
      status=[("被逐出园", "unknown", "p6145")]),
    C("daishu", "待书", "p0914", "探春的丫鬟", MAID),
    C("ruhua", "入画", "p0915", "惜春的丫鬟，抄检后被惜春执意撵去", MAID),
    C("cuilv", "翠缕", "p1884", "湘云的丫鬟，爱问阴阳之理", MAID),
    C("fangguan", "芳官", "p4455", "梨香院正旦，戏班解散后分与宝玉房里", MAID,
      status=[("斩情归水月庵", "alive", "p6185")]),
    C("lingguan", "龄官", "p1612", "梨香院小旦，唱得极好，眉眼像黛玉", MAID,
      facts=[("蔷薇架下痴痴划「蔷」。", "p2638")]),
    C("ouguan", "藕官", "p4689", "梨香院小生，分与黛玉房里", MAID,
      facts=[("清明在园中焚纸祭亡伴菂官。", "p4696")]),
    C("mingyan", "茗烟", "p1047", "宝玉第一个得用的小厮", MAID,
      aliases=[("焙茗", "p2432")]),
    C("limama", "李嬷嬷", "p0475", "宝玉的乳母，年老爱唠叨", MAID),
    C("zhourui", "周瑞家的", "p0854", "王夫人的陪房，管太太奶奶们出门的事", MAID),
    C("laimama", "赖嬷嬷", "p3620", "荣府老仆，赖大之母，体面有年纪", MAID),
    C("shadajie", "傻大姐", "p5733", "贾母房里提水扫院的粗使丫头，心性愚顽", MAID,
      facts=[("误拾绣春囊，掀起抄检大祸。", "p5734"),
             ("泄露掉包机关，惊迷黛玉本性。", "p7136")]),
    C("baoyong", "包勇", "p7031", "甄府荐来的仆人，悫实有力", MAID,
      facts=[("夜盗入园时独力打死一贼。", "p7587")]),
    C("jiaoda", "焦大", "p0929", "宁府老仆，从死人堆里背出过太爷", NING,
      facts=[("吃醉了从主子往下乱骂，被塞了马粪。", "p0930")]),
    C("xinger", "兴儿", "p5281", "贾琏的心腹小厮，一篇「荣府人物论」", MAID),
    # ---- 方外幻境 ----
    C("kongkong", "空空道人", "p0204", "访道求仙之人，从石上抄录《石头记》", BEYOND),
    C("laseng", "癞头和尚", "p0221", "骨格不凡的僧人，携顽石入红尘", BEYOND,
      check="癞头",
      aliases=[("茫茫大士", "p0204")]),
    C("podao", "跛足道人", "p0246", "疯癫落脱的道人，口念好了歌", BEYOND,
      aliases=[("渺渺真人", "p0204")]),
    C("jinghuan", "警幻仙子", "p0215", "太虚幻境司主，掌尘世女怨男痴", BEYOND,
      aliases=[("警幻仙姑", "p0674")]),
    C("zhenbaoyu", "甄宝玉", "p4579", "江南甄府公子，与宝玉同名同貌", OUTER,
      check="宝玉",
      facts=[("两个宝玉终得相见，谈吐却言言势利。", "p7672")]),
    # ---- 府外人物 ----
    C("zhenshiyin", "甄士隐", "p0213", "姑苏阊门望族，禀性恬淡，神仙一流人品", OUTER,
      facts=[("梦中听僧道说通灵、看太虚对联。", "p0214")],
      status=[("随疯道人飘然出家", "missing", "p0257"),
              ("急流津觉迷渡口度脱旧缘", "alive", "p7832")]),
    C("jiayucun", "贾雨村", "p0225", "湖州诗书仕宦之族，寄居葫芦庙的穷儒", OUTER,
      aliases=[("时飞", "p0225")],
      facts=[("乱判葫芦案，徇情枉法。", "p0590"),
             ("升京兆府尹，急流津遇甄士隐而不悟。", "p7363")],
      status=[("犯婪索之案褫籍为民", "alive", "p7830")]),
    C("jiaoxing", "娇杏", "p0360", "甄家丫鬟，因两次回顾成了雨村侧室", OUTER,
      status=[("扶为正室", "alive", "p0362")]),
    C("fengsu", "封肃", "p0245", "甄士隐的岳丈，大如州务农人家", OUTER),
    C("linruhai", "林如海", "p0365", "前科探花，兰台寺大夫，钦点巡盐御史", OUTER,
      status=[("捐馆扬州城", "dead", "p1286")]),
    C("lengzixing", "冷子兴", "p0371", "都中古董商，周瑞家的女婿，演说荣国府", OUTER),
    C("liulaolao", "刘姥姥", "p0847", "积年老寡妇，王家连宗亲戚，久经世代", OUTER,
      facts=[("二进荣国府，游遍大观园。", "p3283"),
             ("危难中救巧姐出城。", "p7795")]),
    C("baner", "板儿", "p0851", "刘姥姥的外孙", OUTER),
    C("beijingwang", "北静王", "p1295", "水溶，年未弱冠，形容秀美，情性谦和", OUTER,
      facts=[("路祭时赠宝玉鹡苓香念珠。", "p1348")]),
    C("jiangyuhan", "蒋玉菡", "p2433", "名驰天下的小旦，温柔乡里的人物", OUTER,
      aliases=[("琪官", "p2491")],
      facts=[("与宝玉互赠汗巾，茜香罗结缘。", "p2492")],
      status=[("娶袭人为妻", "alive", "p7828")]),
    C("liuxianglian", "柳湘莲", "p3749", "世家子弟，素性爽侠，串戏走马", OUTER,
      aliases=[("冷二郎", "p5305")],
      facts=[("苇塘苦打呆霸王。", "p3756"),
             ("以鸳鸯剑定亲，又疑而索剑。", "p5318")],
      status=[("截发随道士飘然而去", "missing", "p5329")]),
    C("nier", "倪二", "p2164", "醉金刚，泼皮却轻财尚义侠", OUTER,
      facts=[("不要文约借银与贾芸。", "p2166")]),
    C("zhangdaoshi", "张道士", "p2559", "清虚观当家，当日荣国公的替身", OUTER),
    C("madaopo", "马道婆", "p2219", "宝玉寄名的干娘，暗行魇魔法的人", OUTER,
      facts=[("受赵姨娘银契，魇害宝玉凤姐。", "p2226")]),
    C("jingxu", "净虚", "p1354", "水月庵（馒头庵）老尼", OUTER,
      facts=[("托凤姐弄权，害了张金哥一对儿女。", "p1359")]),
    C("zhineng", "智能", "p0916", "水月庵小尼姑，常来荣府走动", OUTER,
      facts=[("与秦钟私情，后私逃进城。", "p1402")]),
    C("wangyitie", "王一贴", "p6507", "天齐庙老道士，专卖海上方膏药", OUTER,
      facts=[("胡诌一剂「疗妒汤」。", "p6512")]),
    C("miaoyu", "妙玉", "p1527", "带发修行的姑苏女尼，文墨极通，模样又极好", BEYOND,
      aliases=[("槛外人", "p5087")],
      facts=[("栊翠庵茶品梅花雪。", "p3371"),
             ("中秋夜续凹晶馆联句十三韵。", "p6062")],
      status=[("走火入魔", "unknown", "p6797"),
              ("遭贼人劫掳，下落不明", "missing", "p7609")]),
]

REL = [
    # ---- 荣府谱系（冷子兴演说与后文补明） ----
    ("ronggong", "daishan", "parent", "父子", "p0375"),
    ("daishan", "jiamu", "spouse", "夫妻", "p0375"),
    ("daishan", "jiashe", "parent", "父子", "p0375"),
    ("daishan", "jiazheng", "parent", "父子", "p0375"),
    ("daishan", "jiamin", "parent", "父女", "p0380"),
    ("jiashe", "xingfuren", "spouse", "夫妻", "p0452"),
    ("jiashe", "jialian", "parent", "父子", "p0381"),
    ("jiashe", "yingchun", "parent", "妾出之女", "p0380"),
    ("jiazheng", "wangfuren", "spouse", "夫妻", "p0445"),
    ("jiazheng", "zhaoyiniang", "concubine", "妾", "p1860"),
    ("jiazheng", "jiazhu", "parent", "父子", "p0572"),
    ("jiazheng", "yuanchun", "parent", "父女", "p0380"),
    ("jiazheng", "baoyu", "parent", "父子", "p0375"),
    ("jiazheng", "tanchun", "parent", "庶出之女", "p0380"),
    ("jiazheng", "jiahuan", "parent", "父子", "p2757"),
    ("zhaoyiniang", "tanchun", "parent", "母女", "p4511"),
    ("zhaoyiniang", "jiahuan", "parent", "母子", "p1860"),
    ("wangfuren", "jiazhu", "parent", "母子", "p0572"),
    ("wangfuren", "yuanchun", "parent", "母女", "p1543"),
    ("wangfuren", "baoyu", "parent", "母子", "p0461"),
    ("jiamin", "linruhai", "spouse", "夫妻", "p0367"),
    ("jiamin", "daiyu", "parent", "母女", "p0367"),
    ("linruhai", "daiyu", "parent", "父女", "p0366"),
    ("jialian", "wangxifeng", "spouse", "夫妻", "p0449"),
    ("jialian", "qiaojie", "parent", "父女", "p0858"),
    ("wangxifeng", "qiaojie", "parent", "母女", "p3431"),
    ("jiazhu", "lywan", "spouse", "夫妻", "p0572"),
    ("jiazhu", "jialan", "parent", "父子", "p0572"),
    ("lywan", "jialan", "parent", "母子", "p0572"),
    ("baoyu", "baochai", "spouse", "成大礼", "p7172"),
    ("yingchun", "sunshaozu", "spouse", "误嫁", "p6448"),
    # ---- 宁府谱系 ----
    ("ninggong", "daihua", "parent", "父子", "p0375"),
    ("daihua", "jiafu", "parent", "父子", "p0375"),
    ("daihua", "jiajing", "parent", "父子", "p0375"),
    ("jiajing", "jiazhen", "parent", "父子", "p0375"),
    ("jiajing", "xichun", "parent", "父女", "p0380"),
    ("jiazhen", "youshi", "spouse", "夫妻", "p0662"),
    ("jiazhen", "jiarong", "parent", "父子", "p0375"),
    ("jiarong", "qinkeqing", "spouse", "夫妻", "p0663"),
    # ---- 亲眷与府外 ----
    ("wangfuren", "wangxifeng", "kin", "姑侄", "p0449"),
    ("wangfuren", "xueyima", "kin", "姐妹", "p0478"),
    ("xueyima", "xuepan", "parent", "母子", "p0593"),
    ("xueyima", "baochai", "parent", "母女", "p0593"),
    ("xuepan", "xiajingui", "spouse", "夫妻", "p6450"),
    ("xuepan", "yinglian", "concubine", "侍妾", "p0913"),
    ("xueke", "baoqin", "kin", "兄妹", "p3864"),
    ("xueke", "xiuyan", "spouse", "定亲", "p4638"),
    ("jiamu", "xiangyun", "kin", "娘家亲眷", "p3873"),
    ("qinkeqing", "qinzhong", "kin", "姐弟", "p0923"),
    ("zhenshiyin", "yinglian", "parent", "父女", "p0213"),
    ("jiayucun", "jiaoxing", "spouse", "侧室扶正", "p0362"),
    ("zhenshiyin", "fengsu", "kin", "翁婿", "p0245"),
    ("liulaolao", "baner", "kin", "祖孙", "p0851"),
    ("xiren", "jiangyuhan", "spouse", "夫妻", "p7828"),
    ("jiadairu", "jiarui", "kin", "祖孙", "p1166"),
    ("jinchuan", "yuchuan", "kin", "姐妹", "p2635"),
    ("lengzixing", "zhourui", "kin", "翁婿", "p0920"),
]

TREES = [
    {
        "id": "tree_rongguo",
        "title": "荣国府",
        "at": "p0375",
        "nodes": [
            ("ronggong", 0, 8),
            ("daishan", 1, 7), ("jiamu", 1, 9),
            ("xingfuren", 2, 0), ("jiashe", 2, 2),
            ("jiazheng", 2, 6), ("wangfuren", 2, 8), ("zhaoyiniang", 2, 10),
            ("jiamin", 2, 14), ("linruhai", 2, 16),
            ("jialian", 3, 0), ("wangxifeng", 3, 2), ("yingchun", 3, 4),
            ("jiazhu", 3, 6), ("lywan", 3, 8),
            ("yuanchun", 3, 10), ("baoyu", 3, 12),
            ("tanchun", 3, 14), ("jiahuan", 3, 16), ("daiyu", 3, 20),
            ("qiaojie", 4, 1), ("jialan", 4, 7),
        ],
    },
    {
        "id": "tree_ningguo",
        "title": "宁国府",
        "at": "p0375",
        "nodes": [
            ("ninggong", 0, 3),
            ("daihua", 1, 3),
            ("jiafu", 2, 1), ("jiajing", 2, 5),
            ("jiazhen", 3, 2), ("youshi", 3, 4), ("xichun", 3, 7),
            ("jiarong", 4, 1), ("qinkeqing", 4, 3),
        ],
    },
]


def P(pid, name, at, check, parent=None, facts=()):
    entry = {"id": pid, "name": name, "at": at, "_check": check}
    if parent:
        entry["parent"] = parent
    if facts:
        entry["facts"] = [{"text": t, "at": a} for t, a in facts]
    return entry


PLACES = [
    P("qinggeng", "青埂峰", "p0201", "青埂峰",
      facts=[("女娲炼石补天，独剩一块顽石弃在此峰之下。", "p0201")]),
    P("taixu", "太虚幻境", "p0218", "太虚幻境",
      facts=[("警幻仙姑司人间风情月债，掌尘世女怨男痴。", "p0674")]),
    P("gusu", "姑苏阊门", "p0213", "阊门"),
    P("yangzhou", "扬州", "p0365", "维扬"),
    P("capital", "神京街市", "p0442", "神京"),
    P("rongfu", "荣国府", "p0358", "荣国府",
      facts=[("街西是荣国府，与宁府只隔一条小巷。", "p0374")]),
    P("ningfu", "宁国府", "p0374", "宁国",
      facts=[("现今族长贾珍居此，京中长房。", "p0599")]),
    P("ronghall", "荣禧堂", "p0455", "荣禧堂", parent="rongfu"),
    P("jiamu", "贾母上房", "p0445", "贾母", parent="rongfu"),
    P("neiyuan", "凤姐院与内院", "p0857", "凤姐", parent="rongfu"),
    P("lixiang", "梨香院", "p0598", "梨香院", parent="rongfu",
      facts=[("薛家进京后寄居于此。", "p0598"),
             ("后拨与十二个女戏子演习歌唱。", "p1529")]),
    P("school", "贾氏家塾", "p1040", "义学", parent="rongfu"),
    P("qinroom", "秦氏卧房", "p0664", "秦氏", parent="ningfu",
      facts=[("宝玉在此入梦游太虚幻境。", "p0669")]),
    P("huifang", "会芳园", "p0662", "会芳园", parent="ningfu"),
    P("tiejian", "铁槛寺", "p1354", "铁槛寺",
      facts=[("宁荣二公当日修造，以备京中老了人口安灵。", "p1354")]),
    P("shuiyue", "水月庵", "p1355", "水月庵",
      facts=[("因庵里做的馒头好，就起了馒头庵的浑号。", "p1355")]),
    P("daguan", "大观园", "p1551", "大观园",
      facts=[("为元妃省亲所建，天上人间诸景备。", "p1558"),
             ("元妃命宝玉与众姊妹入园居住。", "p2073")]),
    P("xiaoxiang", "潇湘馆", "p1552", "潇湘馆", parent="daguan",
      facts=[("千百竿翠竹遮映，黛玉居此。", "p2079")]),
    P("yihong", "怡红院", "p1553", "怡红院", parent="daguan",
      facts=[("红香绿玉改题怡红快绿，宝玉居此。", "p2079")]),
    P("hengwu", "蘅芜苑", "p1554", "蘅芜苑", parent="daguan",
      facts=[("异香扑鼻的奇草仙藤愈冷愈苍翠，宝钗居此。", "p2079")]),
    P("daoxiang", "稻香村", "p1498", "稻香村", parent="daguan",
      facts=[("纸窗木榻富贵不到，李纨居此。", "p2079")]),
    P("qiushuang", "秋爽斋", "p2079", "秋爽斋", parent="daguan",
      facts=[("探春素喜阔朗，三间屋子不曾隔断。", "p3303")]),
    P("zhuijin", "缀锦楼", "p2079", "缀锦楼", parent="daguan"),
    P("liaofeng", "蓼风轩", "p2079", "蓼风轩", parent="daguan"),
    P("shuixie", "藕香榭", "p1556", "藕香榭", parent="daguan",
      facts=[("盖在池中，四面有窗，左右有回廊曲桥。", "p3061")]),
    P("zilingzhou", "紫菱洲", "p1556", "紫菱洲", parent="daguan"),
    P("daguanlou", "大观楼", "p1556", "大观楼", parent="daguan"),
    P("flowermound", "沁芳桥畔", "p1487", "沁芳", parent="daguan",
      facts=[("桥畔桃花底下，宝黛在此共读西厢。", "p2103"),
             ("畸角上有黛玉葬花的花冢。", "p2107")]),
    P("longcui", "栊翠庵", "p3371", "栊翠庵", parent="daguan",
      facts=[("妙玉在此修行，茶品梅花雪。", "p3371")]),
    P("luxue", "芦雪广", "p3883", "芦雪", parent="daguan",
      facts=[("傍山临水河滩之上，围着芦苇掩覆。", "p3885")]),
    P("nuanxiang", "暖香坞", "p3821", "暖香坞", parent="daguan"),
    P("moonpav", "凸碧山庄", "p5921", "凸碧", parent="daguan"),
    P("aojing", "凹晶溪馆", "p5985", "凹晶", parent="daguan",
      facts=[("近水赏月之所，黛玉湘云在此联诗。", "p5986")]),
]

MAPS = [
    {
        "id": "map_liangfu",
        "title": "宁荣二府（示意）",
        "at": "p0444",
        "image": "codex-assets/map-liangfu.svg",
        "width": 1000,
        "height": 620,
        "markers": [
            {"place_id": "ningfu", "x": 745, "y": 200},
            {"place_id": "rongfu", "x": 300, "y": 200},
            {"place_id": "ronghall", "x": 300, "y": 340},
            {"place_id": "jiamu", "x": 150, "y": 340},
            {"place_id": "neiyuan", "x": 150, "y": 210},
            {"place_id": "lixiang", "x": 448, "y": 152},
            {"place_id": "school", "x": 96, "y": 500},
            {"place_id": "qinroom", "x": 745, "y": 118},
            {"place_id": "huifang", "x": 872, "y": 210},
        ],
    },
    {
        "id": "map_daguan",
        "title": "大观园（示意）",
        "at": "p1551",
        "image": "codex-assets/map-daguan.svg",
        "width": 1000,
        "height": 750,
        "markers": [
            {"place_id": "daguanlou", "x": 500, "y": 105},
            {"place_id": "xiaoxiang", "x": 662, "y": 552},
            {"place_id": "yihong", "x": 355, "y": 566},
            {"place_id": "hengwu", "x": 240, "y": 245},
            {"place_id": "daoxiang", "x": 168, "y": 418},
            {"place_id": "qiushuang", "x": 700, "y": 400},
            {"place_id": "zhuijin", "x": 840, "y": 322},
            {"place_id": "liaofeng", "x": 812, "y": 448},
            {"place_id": "shuixie", "x": 596, "y": 296},
            {"place_id": "zilingzhou", "x": 730, "y": 240},
            {"place_id": "flowermound", "x": 500, "y": 470},
            {"place_id": "longcui", "x": 344, "y": 168},
            {"place_id": "luxue", "x": 434, "y": 348},
            {"place_id": "nuanxiang", "x": 585, "y": 190},
            {"place_id": "moonpav", "x": 152, "y": 128},
            {"place_id": "aojing", "x": 130, "y": 236},
        ],
    },
]


def main() -> None:
    source = json.loads((BUNDLE / "source.json").read_text(encoding="utf-8"))
    paragraphs = {p["id"]: p for p in source["paragraphs"]}
    errors: list[str] = []

    def anchor(at: str, what: str) -> None:
        if at not in paragraphs:
            errors.append(f"{what}: unknown paragraph {at}")

    char_ids = set()
    for character in CHARACTERS:
        char_ids.add(character["id"])
        anchor(character["at"], character["id"])
        text = paragraphs.get(character["at"], {}).get("text", "")
        check = character.pop("_check")
        probe = check.removeprefix("贾")
        if check not in text and probe not in text:
            errors.append(f"{character['id']}: {check!r} not in anchor {character['at']}")
        for field in ("aliases", "facts", "status"):
            for item in character.get(field, []):
                anchor(item["at"], f"{character['id']}.{field}")

    relationships = []
    for a, b, kind, label, at in REL:
        for cid in (a, b):
            if f"char_{cid}" not in char_ids:
                errors.append(f"relationship {a}-{b}: unknown character {cid}")
        anchor(at, f"relationship {a}-{b}")
        relationships.append(
            {"a": f"char_{a}", "b": f"char_{b}", "kind": kind, "label": label, "at": at}
        )

    trees = []
    for tree in TREES:
        anchor(tree["at"], tree["id"])
        nodes = []
        taken = set()
        for cid, row, col in tree["nodes"]:
            if f"char_{cid}" not in char_ids:
                errors.append(f"{tree['id']}: unknown character {cid}")
            if (row, col) in taken:
                errors.append(f"{tree['id']}: duplicate cell {(row, col)}")
            taken.add((row, col))
            nodes.append({"character_id": f"char_{cid}", "row": row, "col": col})
        trees.append(
            {"id": tree["id"], "title": tree["title"], "at": tree["at"], "nodes": nodes}
        )

    place_ids = set()
    places = []
    for place in PLACES:
        place_ids.add(place["id"])
        anchor(place["at"], place["id"])
        check = place.pop("_check")
        text = paragraphs.get(place["at"], {}).get("text", "")
        if check not in text:
            errors.append(f"place {place['id']}: {check!r} not in anchor {place['at']}")
        places.append(place)

    for book_map in MAPS:
        anchor(book_map["at"], book_map["id"])
        for marker in book_map["markers"]:
            if marker["place_id"] not in place_ids:
                errors.append(f"{book_map['id']}: unknown place {marker['place_id']}")
        if not (BUNDLE / book_map["image"]).is_file():
            errors.append(f"{book_map['id']}: missing image {book_map['image']}")

    if errors:
        for error in errors:
            print("ERROR:", error)
        raise SystemExit(1)

    document = {
        "schema_version": 1,
        "book_id": source["book_id"],
        "source_revision": source["revision"],
        "source_sha256": source["source"]["sha256"],
        "characters": CHARACTERS,
        "relationships": relationships,
        "trees": trees,
        "places": places,
        "maps": MAPS,
    }
    out = BUNDLE / "codex.json"
    out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {out}: {len(CHARACTERS)} characters, {len(relationships)} relationships, "
        f"{len(trees)} trees, {len(places)} places, {len(MAPS)} maps"
    )


if __name__ == "__main__":
    main()
