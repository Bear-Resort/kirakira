/* ✦ Chinese for the phone app. The effects build their settings with English labels;
   the shell looks every label up here as it is rendered (missing ones fall back to English
   and are listed by the self-test). */
window.KK_ZH = {
  // ---------- effect names (short, for chips) and one-line "how to play" ----------
  tools: {
    punch: { name: '剪纸拼贴', howto: '拖动碎片，放回原来的洞里会自动吸回去', howtoEn: 'Drag the pieces — drop one near its hole and it snaps back' },
    flow: { name: '流动油画', howto: '看照片被一笔一笔画出来，手指划过的地方画得更细', howtoEn: 'Watch it paint itself — swipe where you want more detail' },
    fog: { name: '雾窗', howto: '用手指擦掉玻璃上的雾', howtoEn: 'Wipe the fog off the window with your finger' },
    reveal: { name: '手电筒', howto: '按住屏幕移动手电筒，照出另一张照片', howtoEn: 'Hold and move the flashlight to reveal the other picture' },
    subject: { name: 'AI 换风格', howto: '点一下照片里的人或东西，AI 把它抠出来换风格', howtoEn: 'Tap a person or thing — AI cuts it out and restyles it' },
    ascii: { name: '字符画', howto: '用手指涂上复古字符', howtoEn: 'Paint retro text characters with your finger' },
    window: { name: '复古窗口', howto: '在图上框一块地方，它会弹出放大窗口', howtoEn: 'Drag a box over a detail to pop it open, zoomed' },
    stage: { name: '聚光灯', howto: '按住屏幕移动聚光灯，影子会跟着动', howtoEn: 'Hold and move the spotlight — the shadow follows' },
    ccd: { name: 'CCD 相机', howto: '点一下屏幕再拍一张', howtoEn: 'Tap to take another shot' },
    lenticular: { name: '光栅卡', howto: '左右滑动，卡片会翻到另一张', howtoEn: 'Slide left and right to flip the card' },
    sticker: { name: '镭射贴纸', howto: '从贴纸边上划过去，把它撕下来', howtoEn: 'Swipe across the sticker to peel it off' },
    acrylic: { name: '亚克力挂件', howto: '拖动它，会晃会转', howtoEn: 'Drag it — it swings and spins' },
    badge: { name: '吧唧', howto: '拖动转一转，双击看背面', howtoEn: 'Drag to turn it, double-tap to see the back' },
  },
  groups: { play: '照片玩法', merch: 'OC 周边' },

  // ---------- labels (exact English text -> Chinese) ----------
  t: {
    // app / shared
    'Add a picture first ✦': '先选一张照片 ✦',
    'Could not read that picture (HEIC photos may need converting to JPG first).': '读不了这张照片，换一张试试（HEIC 格式可以先转成 JPG）',
    'Demo loaded: Picture B is the same girl with her eyes closed at night.': '已换成示例图',
    'That file is not an image — try a PNG or JPG.': '这不是图片，换一张 JPG 或 PNG 试试',
    'Could not read that picture.': '读不了这张照片',
    'Cutting around the character…': '正在沿着人物剪…',
    'The AI cutter could not load (offline?). Pick a shape instead.': 'AI 抠图没加载出来，先选一个形状吧',
    'Picture B': '第二张照片',
    'Original': '原图', 'Pastel Dream': '粉彩梦', 'Film ’98': '胶片 98', 'Cyber Night': '赛博夜',
    'Mint Soda': '薄荷汽水', 'Sunset Lomo': '落日 LOMO', 'Sepia Memory': '旧照片', 'Manga Ink': '漫画黑白',
    'Brightness': '亮度', 'Contrast': '对比度', 'Saturation': '饱和度', 'Hue shift': '色相',
    'Warmth': '色温', 'Fade / matte': '褪色', 'Film grain': '胶片颗粒', 'Vignette': '暗角',

    // merch shapes (shared)
    'Circle / oval': '圆形', 'Rounded square': '圆角方形', '★ Star': '★ 星星', '♥ Heart': '♥ 爱心',
    '✦ Sparkle': '✦ 闪光', '✿ Flower': '✿ 花朵', '✨ AI: cut around the character': '✨ AI 沿着人物剪',

    // Paper Punch
    'Paper Punch': '剪纸拼贴', 'Background paper': '背景纸', '+ Add a strip of tape': '+ 加一条胶带',
    'Arrange': '摆放', 'Automatic punches': '自动打孔', 'B&W film': '黑白胶片', 'Background': '背景',
    'Caption': '标签', 'Caption style': '标签样式', 'Caption text': '标签文字', 'Confetti mosaic': '彩纸拼贴',
    'Confetti scatter': '彩纸撒落', 'Cutting mat': '切割垫', 'Date': '日期', 'Deckled': '毛边',
    'Film grain & dust': '胶片颗粒和灰尘', 'Film look': '胶片风格', 'Fresh, uncut picture — grab the scissors ✂': '还没剪过 — 拿起剪刀 ✂',
    'Grid paper': '方格纸', 'Handwritten': '手写', 'Hole punch': '打孔机', 'How many punches': '打几个孔',
    'Kraft paper': '牛皮纸', 'Label-maker tape': '标签机胶带', 'Masking': '美纹纸', 'Matte art paper': '哑光美术纸',
    'Newsprint halftone': '报纸网点', 'No border': '无边框', 'None': '无', 'Notebook page': '笔记本',
    'Old newspaper': '旧报纸', 'Orange date imprint': '橙色日期', 'Original colours': '原色',
    'Paper & bits': '纸和碎片', 'Photo edge': '照片边缘', 'Piece size': '碎片大小', 'Pieces beside': '碎片放旁边',
    'Pieces float above': '碎片浮在上面', 'Pinking shears (zigzag edge)': '花边剪刀（锯齿边）', 'Punch shape': '打孔形状',
    'Ransom-note letters': '剪报字母', 'Sepia': '复古棕', 'Solid colour': '纯色', 'Style': '样式', 'Tape': '胶带',
    'The print': '照片', 'Typewriter strip': '打字机纸条', 'Washi': '和纸胶带', 'White border': '白边',
    'White paper edge on pieces': '碎片白纸边', 'Xerox photocopy': '复印效果', 'Yellowed paper': '泛黄纸',
    'Your hands': '你的手', '↶ Undo my last cut': '↶ 撤销上一刀', '↺ Put all back': '↺ 全部放回',
    '▭ Blank card': '▭ 空白卡', '◉ Punch': '◉ 打孔', '✂ New random cut': '✂ 随机剪一次', '✂ Scissors': '✂ 剪刀',
    '✋ Move pieces': '✋ 移动碎片', '✧ Mixed bag': '✧ 混合',
    'Drag the photo itself to move it around the page. The tape strips and the caption label are stickers too — drag them anywhere, scroll while dragging to rotate.': '拖动照片可以移动位置。胶带和标签也能拖，双指可以旋转。',

    // Flow Paint
    'Flow Paint': '流动油画', 'Black': '黑', 'Crayon': '蜡笔', 'Cream': '奶油', 'Ink lines': '墨线', 'Kraft': '牛皮纸',
    'Night blue': '夜蓝', 'Oil': '油画', 'Pastel': '粉彩', 'Vivid': '鲜艳', 'White': '白', '🎨 Repaint': '🎨 重新画',

    // Foggy Window
    'Foggy Window': '雾窗', 'Fog comes back': '雾会回来', 'Fog thickness': '雾有多厚', 'Frosty': '霜', 'Night': '夜晚',
    'Steam': '蒸汽', 'Warm café': '咖啡馆', 'Water drips': '水珠流下', 'Weather': '天气', 'Wipe edge hardness': '擦痕边缘',
    'Wipe size': '擦的大小', '✋ Wipe it all': '✋ 全部擦掉', '💨 Breathe on it': '💨 哈一口气', 'never': '不回来',
    'Small brush + hardness 80+ = finger writing. Big + soft = sleeve wipe.': '小号 + 硬边 = 手指写字；大号 + 软边 = 袖子擦。',

    // Peek-a-boo
    'Peek-a-boo': '手电筒', 'Cold LED': '冷光 LED', 'Old bulb': '旧灯泡', 'Red': '红光', 'Sickly green': '惨绿',
    '✕ Clear pinned peeks': '✕ 清除', '✦ Shapes': '✦ 形状', '🔦 Flashlight': '🔦 手电筒',

    // Subject Swap
    'Subject Swap': 'AI 换风格', 'AI click': 'AI 点选', 'Add': '加选', 'Around it': '周围', 'Black & white (colour pop)': '黑白（主体留色）',
    'Border width': '边框粗细', 'Clear': '清空', 'Dark sprite outline (pixel art)': '像素描边', 'Dim night': '暗夜',
    'Dreamy blur': '梦幻虚化', 'Game Boy green': 'Game Boy 绿', 'Invert': '反相', 'Keep as is': '保持原样',
    'Keep colours (posterised)': '保留颜色（色块化）', 'New': '新选', 'New style for the object': '主体的新风格',
    'PICO-8': 'PICO-8', 'Paint brush size': '画笔大小', 'Palette': '调色板', 'Pixel / dot size': '像素大小',
    'Select all': '全选', 'Select with': '选择方式', 'Sparkle sticker paper': '闪光贴纸', 'Subtract': '减选',
    'Sweetie 16': 'Sweetie 16', 'Tint the selection while painting': '涂的时候显示选区', 'White sticker border': '白色贴纸边',
    '⌫ Paint −': '⌫ 擦掉', '✨ AI click': '✨ AI 点选', '🖌 Paint +': '🖌 涂上',
    'The AI cutter could not load (are you offline?). Use the "Paint +" brush to select the object by hand.': 'AI 抠图没加载出来，可以用「涂上」手动选。',
    'The AI model is downloaded the first time you click (about 6 MB), so it needs internet once. Works best on clear, separate objects; touch up with Paint + / −.': '第一次点会下载 AI 模型（约 6 MB）。主体清楚的照片效果最好，可以用「涂上 / 擦掉」修。',

    // ASCII Paint
    'ASCII Paint': '字符画', 'Amber monitor': '琥珀显示器', 'Black terminal': '黑色终端', 'Brush size (cells)': '笔刷大小',
    'Brush stays inside the colour you start on': '只涂起笔的那块颜色', 'CGA 4-colour': 'CGA 四色', 'CRT scanlines': 'CRT 扫描线',
    'Character size': '字符大小', 'Characters': '字符', 'Colour tolerance': '颜色容差', 'Green phosphor': '绿色荧光屏',
    'Ink colour': '墨色', 'Look': '外观', 'Old paper': '旧纸', 'Phosphor glow': '荧光', 'Picture colours': '照片颜色',
    'Screen behind text': '字后面的画面', 'See-through': '透明', 'Single ink': '单色', 'Tool': '工具',
    '⌫ Eraser': '⌫ 橡皮', '▦ Fill everything': '▦ 全部填满', '✕ Clear': '✕ 清空', '🖌 Brush': '🖌 画笔', '🪣 Colour bucket': '🪣 油漆桶',
    '.:-=+*#%@  classic': '.:-=+*#%@  经典', '0101  binary': '0101  二进制', '·+*✧✦★  sparkle': '·+*✧✦★  闪闪',
    '░▒▓█  blocks': '░▒▓█  方块', 'ｱｲｳｴｵ  half-width kana': 'ｱｲｳｴｵ  片假名',

    // Retro Window
    'Retro Window': '复古窗口', 'Callout lines': '引线', 'Chunky pixel zoom': '像素放大', 'Desktop + taskbar around the picture': '加桌面和任务栏',
    'Lilac': '丁香紫', 'Mint': '薄荷', 'Pop-up message': '弹窗文字', 'Pop-ups': '弹窗', 'Theme': '主题', 'Win98 grey': 'Win98 灰',
    'Zoom for new windows': '新窗口放大倍数', '▤ Progress bar': '▤ 进度条', '⚠ Error pop-up': '⚠ 报错弹窗', '✕ Close all windows': '✕ 关掉所有窗口',

    // Lenticular
    'Lenticular Card': '光栅卡', '3D tilt': '3D 倾斜', 'Card edge thickness': '卡片厚度', 'Flip sweep across card': '翻转扫过范围',
    'Lens count': '光栅条数', 'Plastic glare': '塑料反光', 'Ridge texture': '条纹质感', 'Wobble by itself when the mouse is away': '没碰的时候自己晃',
    'Best with a "difference" pair: eyes open / closed, day / night, before / after a transformation.': '最好用一对「差异图」：睁眼/闭眼、白天/夜晚、变身前/后。',

    // Holo Sticker
    'Holo Sticker': '镭射贴纸', 'Click the character you want to cut out ✦': '点一下想剪下来的人物 ✦', 'Corkboard': '软木板',
    'Glitter': '闪粉', 'Glossy UV': '亮面 UV', 'Holographic': '镭射', 'Kraft journal': '牛皮手账', 'Laptop lid': '笔记本电脑',
    'Matte': '哑光', 'My own background…': '我自己的背景…', 'Pearl': '珍珠', 'Plain vinyl': '普通贴纸', 'Smooth rainbow': '彩虹',
    'Surface': '贴在哪', 'Upload a background picture just below ↓': '在下面选一张背景图 ↓', 'Water bottle': '水杯',
    '↩ Make another': '↩ 再做一张', '↶ Undo': '↶ 撤销', '↺ Stick it back': '↺ 贴回去', '◇ Broken glass': '◇ 碎玻璃',
    '♥ Hearts': '♥ 爱心', '✋ Peel it all': '✋ 全部撕下', '✕ Peel all off': '✕ 全部撕掉', '✦ Paste mode': '✦ 贴贴模式',
    '✦ Starry': '✦ 星星', '⟲ Face front': '⟲ 转回正面', 'Material': '材质', 'Foil pattern': '镭射图案',

    // Acrylic Charm
    'Acrylic Charm': '亚克力挂件', 'Click your character ✦': '点一下你的人物 ✦', 'Frosted': '磨砂', 'Gold': '金色',
    'Holo film': '镭射膜', 'Rose gold': '玫瑰金', 'See-through ink': '透明印刷', 'Silver': '银色', 'With white ink': '白墨打底',
    '↔ Flip': '↔ 翻面', '✨ Re-pick character': '✨ 重新选人物', '〰 Swing it': '〰 晃一晃', '🌀 Spin it': '🌀 转一转', 'Print': '印刷',

    // Button Badge
    'Button Badge': '吧唧', 'Badge': '吧唧', 'Denim bag': '牛仔包', 'Glossy film': '亮膜', 'Laser holo': '镭射',
    'The 3D engine could not load — it needs internet the first time.': '3D 没加载出来，第一次需要联网。',
    '■ Square': '■ 方形', '● Round': '● 圆形', 'Frame your OC': '调整构图', 'Zoom': '放大', 'Move left / right': '左右移动',
    'Finish': '表面', 'Metal back': '背面金属',

    // CCD Cam
    'CCD Cam': 'CCD 相机', 'Auto (cool)': '自动（偏冷）', 'Fluorescent': '日光灯', 'Gingham': '格子布', 'Green tartan': '绿格子',
    'Indoor': '室内', 'Neutral': '中性', 'Pink': '粉色', 'Red tartan': '红格子', '📷 On the camera': '📷 相机屏幕上',
    '📸 Take another shot': '📸 再拍一张', '🖼 Just the photo': '🖼 只要照片', 'The shot': '拍摄', 'Built-in flash': '闪光灯', 'Night (noisy)': '夜景（噪点）',

    // Spotlight Stage
    'Spotlight Stage': '聚光灯', 'Spotlight': '聚光灯', 'Brick wall': '砖墙', 'Cold': '冷光', 'Moonlight': '月光',
    'Old plaster wall': '旧灰墙', 'Red stage curtain': '红色幕布', 'Sickly': '惨绿', 'Tungsten': '钨丝灯',
    '↻ Cut again': '↻ 重新抠', '✨ Click the person (AI)': '✨ 点一下人物（AI）', 'Cut-out': '抠图', 'White-background tolerance': '白底容差',
    'Could not find a character automatically — a white-background or transparent PNG works best.': '没自动找到人物 — 白底或透明背景的图效果最好。',
    // ---- found by the runtime check (second pass) ----
    'Brush': '笔触', 'Brush size': '笔刷大小', 'Stroke length': '笔触长度', 'Colour': '颜色', 'Paper': '纸张',
    'Painting speed': '画画速度', 'Light': '灯光', 'Size': '大小', 'How dark the room is': '房间有多暗', 'Bulb': '灯泡',
    'Flicker': '闪烁', 'Light lingers (ghost trail)': '光会残留（鬼影）', 'Dust in the beam': '光里的灰尘', 'Shape': '形状',
    '● Circle': '● 圆形', '◆ Diamond': '◆ 菱形', '☾ Moon': '☾ 月亮', '▲ Triangle': '▲ 三角', 'Soft edge': '柔和边缘',
    'Slowly spin': '慢慢旋转', 'Glowing outline': '发光描边', 'Sparkle trail': '闪光拖尾',
    'Click to pin a peek-hole in place.': '点一下可以把光圈钉在那里。', 'Swap A ⇄ B': '两张照片对调',
    'No Picture B yet? A manga-ink version of Picture A is used until you add one. For a spooky reveal, use the same scene with something different in it.': '还没有第二张照片时，会自动用漫画黑白版。想要吓人一点，就用同一个场景、多了点东西的照片。',
    '👾 Pixel-art sprite': '👾 像素小人', '🎨 Anime cel shading': '🎨 动画赛璐璐', '⚫ Manga screentone': '⚫ 漫画网点',
    '✏ Pencil sketch': '✏ 铅笔素描', '🌈 Holographic foil': '🌈 镭射膜', '📼 VHS glitch': '📼 录像带故障',
    ' .:-=+*#%@  classic': ' .:-=+*#%@  经典',
    'Die-cut shape': '模切形状', 'Foil strength': '镭射强度', 'Laminate': '覆膜', 'Paste it somewhere': '贴到哪里',
    'Stick it on': '贴在', '🖼 Upload a background': '🖼 选一张背景图', 'Sticker size': '贴纸大小', 'Random tilt for each one': '每张随机歪一点',
    'Change Picture A, the shape or the foil, then "Make another" — the stickers you already pasted stay put.': '换照片、形状或镭射图案，再点「再做一张」— 已经贴上的不会动。',
    'Cut shape': '切割形状', 'Clear border': '透明边', 'Thickness': '厚度', 'Hardware': '挂扣',
    '"AI: cut around the character" makes the classic die-cut charm outline. The clear border is the acrylic margin around your art.': '「AI 沿着人物剪」会做出经典的异形挂件轮廓；透明边是图案外面的那圈亚克力。',
    '↻ Flip over': '↻ 翻过来', 'Move up / down': '上下移动', 'Text stamped on the back': '背面印的字',
    'Real 3D (Three.js). The 3D engine downloads the first time you open this tab, so it needs internet once.': '真 3D。第一次打开会下载 3D 引擎，需要联网一次。',
    'Backdrop': '背景', 'Beam size': '光圈大小', 'Wall distance (shadow size)': '离墙多远（影子大小）', 'Character height': '人物高度',
    'The shadow lags behind… (eerie)': '影子慢半拍…（诡异）',
    'Transparent PNGs use their own cut-out. White backgrounds are keyed out automatically. Anything else: the AI finds the person (needs internet the first time).': '透明 PNG 直接用；白底会自动抠掉；其他照片由 AI 找人物（第一次需要联网）。',
    'Show': '显示', 'Camera colour': '相机颜色', 'Tablecloth': '桌布', 'White balance': '白平衡', 'Resolution': '分辨率',
    'Screen icons (frame no., battery, date)': '屏幕图标（张数、电量、日期）',
    'Finding the object…': '正在找主体…',
    'Could not export the layers — try Save as PNG.': '导出图层失败，试试直接保存图片。',
    'Packing the layers…': '正在打包图层…',
    'Waking up the AI cutter (first time takes a few seconds)…': '正在唤醒 AI 抠图（第一次要几秒钟）…',
    "Cold blue '89": "冷蓝 '89", "Warm '77 + light leak": "暖黄 '77 + 漏光",
  },
  // labels that mean different things in different effects
  byTool: {
    acrylic: { 'Clear': '透明', 'Night': '夜色' },
    badge: { 'Night': '夜色' },
    sticker: { 'Night': '夜色' },
  },
};
