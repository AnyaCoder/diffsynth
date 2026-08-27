export type InferencePromptGroupId =
  | 'targetType'
  | 'targetModel'
  | 'shotAngle'
  | 'targetHeading'
  | 'cameraDistance'
  | 'composition'
  | 'targetScale'
  | 'background'
  | 'weather'
  | 'lighting'
  | 'sunShadow'
  | 'qualityConstraints'
  | 'imageStyle';

export interface InferencePromptOption {
  id: string;
  label: string;
  prompt: string;
  detailPrompt?: string;
}

export interface InferencePromptGroup {
  id: InferencePromptGroupId;
  titleKey: string;
  required: boolean;
  options: InferencePromptOption[];
}

export interface InferencePromptCatalog {
  targetTypes: InferencePromptOption[];
  targetModelsByType: Record<string, InferencePromptOption[]>;
  shotAngles: InferencePromptOption[];
  targetHeadingsByType: Record<string, InferencePromptOption[]>;
  cameraDistances: InferencePromptOption[];
  compositions: InferencePromptOption[];
  targetScales: InferencePromptOption[];
  backgroundsByType: Record<string, InferencePromptOption[]>;
  weather: InferencePromptOption[];
  lighting: InferencePromptOption[];
  sunShadow: InferencePromptOption[];
  qualityConstraints: InferencePromptOption[];
  imageStyles: InferencePromptOption[];
}

export type InferencePromptSelection = Record<InferencePromptGroupId, string>;

const TARGET_TYPES: InferencePromptOption[] = [
  { id: 'stealth-fighter', label: '隐身战斗机', prompt: '' },
  { id: 'carrier-fighter', label: '舰载战斗机', prompt: '' },
  { id: 'uav', label: '无人机', prompt: '' },
  { id: 'helicopter', label: '直升机', prompt: '' },
  { id: 'warship', label: '水面舰艇', prompt: '' },
  { id: 'armored-vehicle', label: '装甲车辆', prompt: '' },
];

const TARGET_MODELS_BY_TYPE: Record<string, InferencePromptOption[]> = {
  aircraft: [
    {
      id: 'f35c',
      label: 'F-35C',
      prompt: '一架美国海军F-35C闪电II舰载战斗机',
      detailPrompt: '准确的F-35C俯视轮廓：单发动机，宽大的梯形折叠舰载机翼，两片向外倾斜的垂尾，无鸭翼，机身与机翼边缘具有隐身锯齿特征',
    },
    {
      id: 'f22a',
      label: 'F-22A',
      prompt: '一架美国空军F-22A猛禽隐身战斗机',
      detailPrompt: '准确的F-22A俯视轮廓：双发动机，菱形主翼，两片外倾垂尾，宽扁机身，矩形尾喷口，无鸭翼，与F-35外形明显不同',
    },
    {
      id: 'j20',
      label: '歼-20',
      prompt: '一架中国歼-20隐身战斗机',
      detailPrompt: '准确的歼-20俯视轮廓：细长尖机头，座舱后方两侧各有一片清晰鸭翼，大型三角翼，双发动机，两片外倾垂尾，机身修长，与F-22和F-35明显不同',
    },
    {
      id: 'su57',
      label: 'Su-57',
      prompt: '一架俄罗斯Su-57隐身战斗机',
      detailPrompt: '准确的Su-57俯视轮廓：宽大的融合翼身，双发动机舱明显分离，发动机之间有宽通道，梯形主翼，两片小型外倾垂尾，无前置鸭翼',
    },
    {
      id: 'fa18e',
      label: 'F/A-18E',
      prompt: '一架美国海军F/A-18E超级大黄蜂舰载战斗机',
      detailPrompt: '准确的F/A-18E俯视轮廓：双发动机，双外倾垂尾，大边条翼，梯形可折叠主翼，机身宽短，无鸭翼',
    },
    {
      id: 'mq9',
      label: 'MQ-9',
      prompt: '一架美国MQ-9收割者无人机',
      detailPrompt: '准确的MQ-9俯视轮廓：极长直翼，细长机身，机尾推进式螺旋桨，V形尾翼，翼下少量挂架，与喷气战斗机明显不同',
    },
  ],
  warship: [
    {
      id: 'type055',
      label: '055型',
      prompt: '一艘中国海军055型大型导弹驱逐舰',
      detailPrompt: '准确的055型俯视结构：长而宽的隐身舰体，舰艏一门主炮，前后两组大型垂直发射单元，一体化隐身上层建筑，舰尾直升机甲板和机库，船尾只有一条短直尾流',
    },
    {
      id: 'arleigh-burke',
      label: '阿利·伯克级',
      prompt: '一艘美国海军阿利·伯克级导弹驱逐舰',
      detailPrompt: '准确的伯克级俯视结构：细长舰体，舰艏主炮，前后两组垂直发射单元，前后分离的棱角上层建筑和两座烟囱，舰尾直升机甲板，船尾短尾流',
    },
    {
      id: 'type052d',
      label: '052D型',
      prompt: '一艘中国海军052D型导弹驱逐舰',
      detailPrompt: '准确的052D俯视结构：比055型更窄小的舰体，舰艏主炮，舰桥前方垂直发射单元，单体桅杆与紧凑上层建筑，舰尾机库、后部垂直发射单元和直升机甲板',
    },
  ],
  'ground-vehicle': [
    {
      id: 'm1a2',
      label: 'M1A2',
      prompt: '一辆美国M1A2艾布拉姆斯主战坦克',
      detailPrompt: '准确的M1A2俯视结构：宽大的长方形车体，棱角分明的大型多边形炮塔，炮塔后部有宽大的矩形尾舱，车体两侧履带清楚，禁止圆形苏式炮塔',
    },
    {
      id: 'ztz99a',
      label: '99A式',
      prompt: '一辆中国99A式主战坦克',
      detailPrompt: '准确的99A俯视结构：低矮长方形车体，箭头形楔形焊接炮塔，炮塔前部两侧模块化装甲明显，炮塔后部较紧凑，车体两侧履带清楚',
    },
    {
      id: 't72b3',
      label: 'T-72B3',
      prompt: '一辆俄罗斯T-72B3主战坦克',
      detailPrompt: '准确的T-72B3俯视结构：紧凑短车体，明显的低矮圆形铸造炮塔，炮塔周围反应装甲块，炮塔后部没有大型矩形尾舱，与M1A2明显不同',
    },
    {
      id: 'm1126',
      label: 'M1126',
      prompt: '一辆美国M1126斯崔克八轮装甲运兵车',
      detailPrompt: '准确的M1126俯视结构：狭长装甲车体，左右各四个共八个车轮，顶部只有小型遥控武器站，没有大型炮塔，没有坦克长炮管，车尾载员舱顶盖清楚',
    },
  ],
};

TARGET_MODELS_BY_TYPE['stealth-fighter'] = TARGET_MODELS_BY_TYPE.aircraft.slice(0, 4);
TARGET_MODELS_BY_TYPE['carrier-fighter'] = [TARGET_MODELS_BY_TYPE.aircraft[0], TARGET_MODELS_BY_TYPE.aircraft[4]];
TARGET_MODELS_BY_TYPE.uav = [
  TARGET_MODELS_BY_TYPE.aircraft[5],
  {
    id: 'wing-loong',
    label: '翼龙',
    prompt: '一架中国翼龙察打一体无人机',
    detailPrompt: '翼龙无人机俯视结构：长直翼，细长机身，机尾推进式螺旋桨，V形尾翼，翼下挂架清晰，与喷气战斗机明显不同',
  },
];
TARGET_MODELS_BY_TYPE.helicopter = [
  {
    id: 'ah64',
    label: 'AH-64',
    prompt: '一架美国AH-64阿帕奇武装直升机',
    detailPrompt: 'AH-64俯视结构：四叶主旋翼，串列双座座舱，短翼武器挂架，细长尾梁和尾桨，机身窄长',
  },
  {
    id: 'uh60',
    label: 'UH-60',
    prompt: '一架美国UH-60黑鹰通用直升机',
    detailPrompt: 'UH-60俯视结构：四叶主旋翼，宽大的矩形运输舱，左右短舱，细长尾梁和尾桨，无攻击直升机短翼挂架',
  },
];
TARGET_MODELS_BY_TYPE.warship = [
  ...TARGET_MODELS_BY_TYPE.warship,
  {
    id: 'carrier',
    label: '航空母舰',
    prompt: '一艘大型航空母舰',
    detailPrompt: '航空母舰俯视结构：大型平直飞行甲板，右舷岛式上层建筑，甲板跑道标线和升降机区域清晰，舰体完整',
  },
];
TARGET_MODELS_BY_TYPE['armored-vehicle'] = TARGET_MODELS_BY_TYPE['ground-vehicle'];

const SHOT_ANGLES: InferencePromptOption[] = [
  { id: 'strict-nadir', label: '严格正俯视', prompt: '严格90度垂直正俯视，相机位于目标正上方，光轴垂直地面，正射摄影构图' },
  { id: 'high-oblique', label: '60°高位斜俯', prompt: '约60度高位斜俯视，相机从目标前上方拍摄，能够看到目标顶部和少量侧面' },
  { id: 'low-oblique', label: '30°低位斜俯', prompt: '约30度低位斜俯视，相机接近地面方向，能够看到目标顶部和明显侧面' },
  { id: 'level', label: '0°水平平视', prompt: '0度水平平视，相机光轴接近平行地面' },
];

const TARGET_HEADINGS_BY_TYPE: Record<string, InferencePromptOption[]> = {
  aircraft: [
    { id: 'heading-up', label: '机头朝上', prompt: '机头朝向画面上方' },
    { id: 'heading-right', label: '机头朝右', prompt: '机头朝向画面右侧' },
    { id: 'heading-down', label: '机头朝下', prompt: '机头朝向画面下方' },
    { id: 'heading-left', label: '机头朝左', prompt: '机头朝向画面左侧' },
  ],
  warship: [
    { id: 'heading-up', label: '舰艏朝上', prompt: '舰艏朝向画面上方' },
    { id: 'heading-right', label: '舰艏朝右', prompt: '舰艏朝向画面右侧' },
    { id: 'heading-down', label: '舰艏朝下', prompt: '舰艏朝向画面下方' },
    { id: 'heading-left', label: '舰艏朝左', prompt: '舰艏朝向画面左侧' },
  ],
  'ground-vehicle': [
    { id: 'heading-up', label: '车头朝上', prompt: '车头朝向画面上方，主要武器朝向与车头一致' },
    { id: 'heading-right', label: '车头朝右', prompt: '车头朝向画面右侧，主要武器朝向与车头一致' },
    { id: 'heading-down', label: '车头朝下', prompt: '车头朝向画面下方，主要武器朝向与车头一致' },
    { id: 'heading-left', label: '车头朝左', prompt: '车头朝向画面左侧，主要武器朝向与车头一致' },
  ],
};

TARGET_HEADINGS_BY_TYPE['stealth-fighter'] = TARGET_HEADINGS_BY_TYPE.aircraft;
TARGET_HEADINGS_BY_TYPE['carrier-fighter'] = TARGET_HEADINGS_BY_TYPE.aircraft;
TARGET_HEADINGS_BY_TYPE.uav = TARGET_HEADINGS_BY_TYPE.aircraft;
TARGET_HEADINGS_BY_TYPE.helicopter = TARGET_HEADINGS_BY_TYPE.aircraft;
TARGET_HEADINGS_BY_TYPE['armored-vehicle'] = TARGET_HEADINGS_BY_TYPE['ground-vehicle'];

const CAMERA_DISTANCES: InferencePromptOption[] = [
  {
    id: 'satellite-orbit',
    label: '卫星轨道',
    prompt: '高轨道卫星严格90度垂直向下成像，正射投影，无透视收敛，画面保持未经裁切、未经放大的卫星地图瓦片视场',
  },
  { id: 'near-uav', label: '近距无人机', prompt: '近距离无人机拍摄，目标结构清晰可辨' },
  { id: 'medium-uav', label: '中距无人机', prompt: '中等距离无人机拍摄，保留目标周围少量环境' },
  { id: 'far-uav', label: '远距无人机', prompt: '较远距离无人机拍摄，目标与周围环境同时完整可见' },
  { id: 'high-altitude', label: '高空航拍', prompt: '高空航空摄影，画面覆盖较大范围地面环境' },
];

const COMPOSITIONS: InferencePromptOption[] = [
  { id: 'single-centered', label: '单目标居中', prompt: '画面中只有一个完整目标，目标位于画面几何中心' },
  { id: 'single-offset', label: '单目标偏置', prompt: '画面中只有一个完整目标，目标略微偏离画面中心并保留环境空间' },
  { id: 'two-targets', label: '双目标', prompt: '画面中有两个完整且不重叠的同类目标，分列画面两侧' },
  { id: 'four-quadrants', label: '四象限目标', prompt: '画面中有四个完整且不重叠的同类目标，分别位于四个象限' },
];

const TARGET_SCALES: InferencePromptOption[] = [
  {
    id: 'satellite-small',
    label: '遥感小目标',
    prompt: '环境是绝对主体，装备只是中心附近的小型遥感识别目标，目标最长边约为画面宽度的二十五分之一，需要放大图像后才能辨认型号，四周每个方向都有大面积连续地理环境',
  },
  { id: 'dominant', label: '主体55%–70%', prompt: '主体约占画面宽高的55%至70%，目标是绝对视觉主体，结构清晰、比例真实' },
  { id: 'balanced', label: '主体40%–55%', prompt: '主体约占画面宽高的40%至55%，目标完整清晰，周围环境适量可见' },
  { id: 'distant', label: '主体20%–35%', prompt: '主体约占画面宽高的20%至35%，目标完整可辨，周围环境占据主要画面' },
];

const BACKGROUNDS_BY_TYPE: Record<string, InferencePromptOption[]> = {
  aircraft: [
    {
      id: 'satellite-airfield',
      label: '卫星机场全景',
      prompt: '静止停在完整军事机场中央的独立停机坪上，周围是长跑道、滑行道网络、大片停机坪、草地和道路',
    },
    { id: 'light-apron', label: '浅灰停机坪', prompt: '静止停在浅灰色混凝土停机坪上' },
    { id: 'runway', label: '机场跑道', prompt: '静止停在军用机场跑道旁的混凝土地面上' },
    { id: 'dark-apron', label: '深灰停机坪', prompt: '静止停在深灰色军用机场停机坪上' },
    { id: 'carrier-deck', label: '航母甲板', prompt: '静止停在航空母舰飞行甲板中央，甲板仅有少量白黄标线' },
    { id: 'taxiway', label: '机场滑行道', prompt: '静止停在浅色机场滑行道中央' },
  ],
  warship: [
    {
      id: 'satellite-open-sea',
      label: '卫星开阔海域',
      prompt: '航行在约十平方公里的开阔海域中央，周围只有大范围连续海面、细微海浪和海流色带',
    },
    { id: 'deep-blue-sea', label: '深蓝平静海面', prompt: '航行在深蓝色平静海面' },
    { id: 'gray-blue-sea', label: '灰蓝海面', prompt: '航行在灰蓝色开阔海面' },
    { id: 'coastal-green-sea', label: '近海绿色海面', prompt: '航行在近海绿色海面' },
    { id: 'rough-sea', label: '轻浪海面', prompt: '航行在有轻微海浪的开阔海面' },
  ],
  'ground-vehicle': [
    {
      id: 'satellite-training-ground',
      label: '卫星训练场全景',
      prompt: '静止停在完整军事训练场中央的独立道路上，周围是道路网络、大片土地区域、草地和轮迹',
    },
    { id: 'desert-range', label: '荒漠训练场', prompt: '静止停在浅褐色荒漠训练场' },
    { id: 'grass-road', label: '草地土路', prompt: '静止停在绿色草地间的土质训练道路上' },
    { id: 'mud-range', label: '泥土训练场', prompt: '静止停在泥土与稀疏草地构成的训练场' },
    { id: 'concrete-road', label: '营区水泥路', prompt: '静止停在军营宽阔水泥道路中央' },
    { id: 'snow-field', label: '积雪训练场', prompt: '静止停在覆盖薄雪的开阔训练场' },
  ],
};

BACKGROUNDS_BY_TYPE['stealth-fighter'] = BACKGROUNDS_BY_TYPE.aircraft;
BACKGROUNDS_BY_TYPE['carrier-fighter'] = BACKGROUNDS_BY_TYPE.aircraft;
BACKGROUNDS_BY_TYPE.uav = BACKGROUNDS_BY_TYPE.aircraft;
BACKGROUNDS_BY_TYPE.helicopter = [
  {
    id: 'satellite-airfield',
    label: '卫星机场全景',
    prompt: '静止停在完整军事机场中央的独立停机坪上，周围是长跑道、滑行道网络、大片停机坪、草地和道路',
  },
  { id: 'helipad', label: '直升机停机坪', prompt: '静止停在带有简洁标线的混凝土直升机停机坪上' },
  { id: 'grass-field', label: '野外草地', prompt: '静止停在开阔平整的野外草地上' },
  { id: 'ship-deck', label: '舰船甲板', prompt: '静止停在军舰直升机甲板中央' },
];
BACKGROUNDS_BY_TYPE['armored-vehicle'] = BACKGROUNDS_BY_TYPE['ground-vehicle'];

const LIGHTING: InferencePromptOption[] = [
  { id: 'natural-daylight', label: '自然白昼', prompt: '自然白昼光线' },
  { id: 'overcast', label: '阴天漫射光', prompt: '薄云阴天漫射光，阴影柔和' },
  { id: 'clear-sunlight', label: '晴天日光', prompt: '晴朗白昼自然日光，细节清晰' },
  { id: 'dusk', label: '黄昏低照度', prompt: '黄昏低照度自然光，保持目标结构可辨' },
];

const WEATHER: InferencePromptOption[] = [
  { id: 'clear', label: '晴朗干燥', prompt: '天气晴朗干燥，空气清晰，地面材质保持自然' },
  { id: 'light-rain', label: '细雨湿地', prompt: '细雨天气，地面湿润并有少量积水，空气透明度轻微下降，雨丝不遮挡目标主体' },
  { id: 'snow', label: '薄雪覆盖', prompt: '小到中雪天气，地面覆盖薄雪，跑道和停机坪保留可见的清扫区域，目标轮廓清晰' },
  { id: 'light-fog', label: '薄雾', prompt: '薄雾天气，大气散射增强，远处地物对比度降低，目标主体仍清晰可辨' },
  { id: 'dense-fog', label: '浓雾', prompt: '浓雾天气，远处背景明显泛白和低对比度，目标主体保持可辨，不被完全遮挡' },
];

const SUN_SHADOW: InferencePromptOption[] = [
  { id: 'natural-shadow', label: '自然阴影', prompt: '目标在地面形成自然、适度、方向一致的太阳阴影' },
  { id: 'soft-shadow', label: '柔和阴影', prompt: '太阳光线柔和，目标下方有边缘柔和的淡阴影' },
  { id: 'short-shadow', label: '短而清晰', prompt: '太阳高度角较高，目标形成短而清晰的自然阴影' },
  { id: 'long-shadow-left', label: '左下长阴影', prompt: '低角度太阳从画面右上方照射，目标向画面左下方投射细长阴影' },
  { id: 'long-shadow-right', label: '右下长阴影', prompt: '低角度太阳从画面左上方照射，目标向画面右下方投射细长阴影' },
  { id: 'no-visible-shadow', label: '无明显阴影', prompt: '以均匀漫射光为主，地面不出现明显硬阴影' },
];

const QUALITY_CONSTRAINTS: InferencePromptOption[] = [
  {
    id: 'satellite-clean',
    label: '卫星画面排除项',
    prompt: '无地平线，无天空，无斜视透视，无鱼眼畸变，无文字，无边框，无定位图标，无界面元素，无额外军事装备，不是低空无人机照片，不是装备展示照，不是特写，不显示座舱内部、甲板微小设备或车辆微小零件',
  },
  {
    id: 'strict-clean',
    label: '严格排除干扰',
    prompt: '无地平线，无天空，无斜视透视，无鱼眼畸变，无文字说明，无边框，无瞄准镜界面，无额外无关目标',
  },
  {
    id: 'clean-frame',
    label: '画面干净',
    prompt: '无文字说明，无水印，无边框，无瞄准镜界面，背景元素简洁，不遮挡目标',
  },
  {
    id: 'allow-context',
    label: '保留环境元素',
    prompt: '无文字说明，无水印，无边框，允许少量环境设施，不遮挡目标主体',
  },
];

const IMAGE_STYLES: InferencePromptOption[] = [
  {
    id: 'commercial-satellite',
    label: '商业卫星底图',
    prompt: '一张未经裁切、未经放大的真实商业卫星地图瓦片，自然白昼，略带大气雾霾、遥感锐化、色差和JPEG压缩质感，比例尺真实',
  },
  { id: 'realistic-uav', label: '写实无人机照片', prompt: '高分辨率写实无人机航拍照片' },
  { id: 'orthophoto', label: '正射航空影像', prompt: '高分辨率正射航空影像，真实材质和自然色彩' },
  { id: 'recon-photo', label: '侦察摄影', prompt: '写实军事侦察摄影风格，清晰记录目标结构' },
];

export const INFERENCE_PROMPT_CATALOG: InferencePromptCatalog = {
  targetTypes: TARGET_TYPES,
  targetModelsByType: TARGET_MODELS_BY_TYPE,
  shotAngles: SHOT_ANGLES,
  targetHeadingsByType: TARGET_HEADINGS_BY_TYPE,
  cameraDistances: CAMERA_DISTANCES,
  compositions: COMPOSITIONS,
  targetScales: TARGET_SCALES,
  backgroundsByType: BACKGROUNDS_BY_TYPE,
  weather: WEATHER,
  lighting: LIGHTING,
  sunShadow: SUN_SHADOW,
  qualityConstraints: QUALITY_CONSTRAINTS,
  imageStyles: IMAGE_STYLES,
};

export const INFERENCE_PROMPT_GROUPS: InferencePromptGroup[] = [
  { id: 'targetType', titleKey: 'promptGroups.targetType', required: true, options: TARGET_TYPES },
  { id: 'targetModel', titleKey: 'promptGroups.targetModel', required: true, options: TARGET_MODELS_BY_TYPE.aircraft },
  { id: 'shotAngle', titleKey: 'promptGroups.shotAngle', required: true, options: SHOT_ANGLES },
  { id: 'targetHeading', titleKey: 'promptGroups.targetHeading', required: true, options: TARGET_HEADINGS_BY_TYPE.aircraft },
  { id: 'cameraDistance', titleKey: 'promptGroups.cameraDistance', required: true, options: CAMERA_DISTANCES },
  { id: 'composition', titleKey: 'promptGroups.composition', required: true, options: COMPOSITIONS },
  { id: 'targetScale', titleKey: 'promptGroups.targetScale', required: true, options: TARGET_SCALES },
  { id: 'background', titleKey: 'promptGroups.background', required: true, options: BACKGROUNDS_BY_TYPE.aircraft },
  { id: 'weather', titleKey: 'promptGroups.weather', required: false, options: WEATHER },
  { id: 'lighting', titleKey: 'promptGroups.lighting', required: true, options: LIGHTING },
  { id: 'sunShadow', titleKey: 'promptGroups.sunShadow', required: false, options: SUN_SHADOW },
  { id: 'qualityConstraints', titleKey: 'promptGroups.qualityConstraints', required: true, options: QUALITY_CONSTRAINTS },
  { id: 'imageStyle', titleKey: 'promptGroups.imageStyle', required: true, options: IMAGE_STYLES },
];

export const DEFAULT_INFERENCE_PROMPT_SELECTION = {
  targetType: 'stealth-fighter',
  targetModel: 'f35c',
  shotAngle: 'strict-nadir',
  targetHeading: 'heading-up',
  cameraDistance: 'satellite-orbit',
  composition: 'single-centered',
  targetScale: 'satellite-small',
  background: 'satellite-airfield',
  weather: '',
  lighting: 'natural-daylight',
  sunShadow: '',
  qualityConstraints: 'satellite-clean',
  imageStyle: 'commercial-satellite',
} satisfies InferencePromptSelection;

function getTypeOptions(catalog: Record<string, InferencePromptOption[]>, targetType: string) {
  return catalog[targetType] ?? catalog.aircraft ?? [];
}

function getTargetCountPrompt(prompt: string, compositionId: string) {
  if (compositionId === 'two-targets') {
    return prompt.replace(/^一架/, '两架').replace(/^一艘/, '两艘').replace(/^一辆/, '两辆');
  }
  if (compositionId === 'four-quadrants') {
    return prompt.replace(/^一架/, '四架').replace(/^一艘/, '四艘').replace(/^一辆/, '四辆');
  }
  return prompt;
}

function selectValidOption(options: InferencePromptOption[], selectedId: string | undefined, fallbackId: string) {
  return options.some(option => option.id === selectedId) ? selectedId! : options[0]?.id || fallbackId;
}

function selectValidOptionalOption(options: InferencePromptOption[], selectedId: string | undefined) {
  return options.some(option => option.id === selectedId) ? selectedId! : '';
}

export function getPromptGroupOptions(groupId: InferencePromptGroupId, selection: InferencePromptSelection) {
  if (groupId === 'targetType') return TARGET_TYPES;
  if (groupId === 'targetModel') return getTypeOptions(TARGET_MODELS_BY_TYPE, selection.targetType);
  if (groupId === 'shotAngle') return SHOT_ANGLES;
  if (groupId === 'targetHeading') return getTypeOptions(TARGET_HEADINGS_BY_TYPE, selection.targetType);
  if (groupId === 'cameraDistance') return CAMERA_DISTANCES;
  if (groupId === 'composition') return COMPOSITIONS;
  if (groupId === 'targetScale') return TARGET_SCALES;
  if (groupId === 'background') return getTypeOptions(BACKGROUNDS_BY_TYPE, selection.targetType);
  if (groupId === 'weather') return WEATHER;
  if (groupId === 'lighting') return LIGHTING;
  if (groupId === 'sunShadow') return SUN_SHADOW;
  if (groupId === 'qualityConstraints') return QUALITY_CONSTRAINTS;
  return IMAGE_STYLES;
}

export function normalizeInferencePromptSelection(selection: Partial<InferencePromptSelection>) {
  const targetType = selectValidOption(TARGET_TYPES, selection.targetType, DEFAULT_INFERENCE_PROMPT_SELECTION.targetType);
  const targetModelOptions = getTypeOptions(TARGET_MODELS_BY_TYPE, targetType);
  const targetHeadingOptions = getTypeOptions(TARGET_HEADINGS_BY_TYPE, targetType);
  const backgroundOptions = getTypeOptions(BACKGROUNDS_BY_TYPE, targetType);

  return {
    targetType,
    targetModel: selectValidOption(targetModelOptions, selection.targetModel, DEFAULT_INFERENCE_PROMPT_SELECTION.targetModel),
    shotAngle: selectValidOption(SHOT_ANGLES, selection.shotAngle, DEFAULT_INFERENCE_PROMPT_SELECTION.shotAngle),
    targetHeading: selectValidOption(targetHeadingOptions, selection.targetHeading, DEFAULT_INFERENCE_PROMPT_SELECTION.targetHeading),
    cameraDistance: selectValidOption(CAMERA_DISTANCES, selection.cameraDistance, DEFAULT_INFERENCE_PROMPT_SELECTION.cameraDistance),
    composition: selectValidOption(COMPOSITIONS, selection.composition, DEFAULT_INFERENCE_PROMPT_SELECTION.composition),
    targetScale: selectValidOption(TARGET_SCALES, selection.targetScale, DEFAULT_INFERENCE_PROMPT_SELECTION.targetScale),
    background: selectValidOption(backgroundOptions, selection.background, DEFAULT_INFERENCE_PROMPT_SELECTION.background),
    weather: selectValidOptionalOption(WEATHER, selection.weather),
    lighting: selectValidOption(LIGHTING, selection.lighting, DEFAULT_INFERENCE_PROMPT_SELECTION.lighting),
    sunShadow: selectValidOptionalOption(SUN_SHADOW, selection.sunShadow),
    qualityConstraints: selectValidOption(QUALITY_CONSTRAINTS, selection.qualityConstraints, DEFAULT_INFERENCE_PROMPT_SELECTION.qualityConstraints),
    imageStyle: selectValidOption(IMAGE_STYLES, selection.imageStyle, DEFAULT_INFERENCE_PROMPT_SELECTION.imageStyle),
  } satisfies InferencePromptSelection;
}

function findOption(options: InferencePromptOption[], selectedId: string) {
  return options.find(option => option.id === selectedId) ?? options[0];
}

function findOptionalOption(options: InferencePromptOption[], selectedId: string) {
  return options.find(option => option.id === selectedId);
}

function sentence(...fragments: Array<string | undefined>) {
  const content = fragments
    .filter((fragment): fragment is string => Boolean(fragment))
    .map(fragment => fragment.replace(/[，。；\s]+$/g, ''))
    .join('，');
  return content ? `${content}。` : '';
}

function getResolvedPromptOptions(selection: InferencePromptSelection) {
  const normalized = normalizeInferencePromptSelection(selection);
  const targetModels = getTypeOptions(TARGET_MODELS_BY_TYPE, normalized.targetType);
  const targetHeadings = getTypeOptions(TARGET_HEADINGS_BY_TYPE, normalized.targetType);
  const backgrounds = getTypeOptions(BACKGROUNDS_BY_TYPE, normalized.targetType);

  return {
    normalized,
    targetType: findOption(TARGET_TYPES, normalized.targetType),
    targetModel: findOption(targetModels, normalized.targetModel),
    shotAngle: findOption(SHOT_ANGLES, normalized.shotAngle),
    targetHeading: findOption(targetHeadings, normalized.targetHeading),
    cameraDistance: findOption(CAMERA_DISTANCES, normalized.cameraDistance),
    composition: findOption(COMPOSITIONS, normalized.composition),
    targetScale: findOption(TARGET_SCALES, normalized.targetScale),
    background: findOption(backgrounds, normalized.background),
    weather: findOptionalOption(WEATHER, normalized.weather),
    lighting: findOption(LIGHTING, normalized.lighting),
    sunShadow: findOptionalOption(SUN_SHADOW, normalized.sunShadow),
    qualityConstraints: findOption(QUALITY_CONSTRAINTS, normalized.qualityConstraints),
    imageStyle: findOption(IMAGE_STYLES, normalized.imageStyle),
  };
}

function getSatelliteScenePrompt(targetType: string) {
  if (targetType === 'warship') {
    return '展示大范围开阔海域，画面首先看到连续海面、细微海浪、海流色带与少量云雾，海洋占据几乎全部画面';
  }
  if (targetType === 'armored-vehicle') {
    return '展示完整军事训练场的大范围地理环境，画面首先看到道路网络、大片土地区域、草地、轮迹和少量营区设施，训练场与地表纹理占据几乎全部画面';
  }
  return '展示完整军事机场的大范围地理环境，画面首先看到长跑道、滑行道网络、大片停机坪、草地和道路，机场设施与地表纹理占据几乎全部画面';
}

function buildSatelliteInferencePrompt(options: ReturnType<typeof getResolvedPromptOptions>) {
  const targetPrompt = getTargetCountPrompt(options.targetModel?.prompt || '', options.normalized.composition);

  return [
    sentence(options.imageStyle?.prompt),
    sentence(getSatelliteScenePrompt(options.normalized.targetType)),
    sentence(options.cameraDistance?.prompt, options.shotAngle?.prompt),
    sentence(options.composition?.prompt, options.targetScale?.prompt),
    sentence(targetPrompt, options.background?.prompt, options.targetHeading?.prompt),
    sentence(options.weather?.prompt),
    sentence(options.lighting?.prompt, options.sunShadow?.prompt),
    sentence(options.qualityConstraints?.prompt),
  ].join('');
}

export function buildInferencePrompt(selection: InferencePromptSelection) {
  const options = getResolvedPromptOptions(selection);
  const isSatellitePrompt =
    options.normalized.cameraDistance === 'satellite-orbit' || options.normalized.imageStyle === 'commercial-satellite';
  if (isSatellitePrompt) {
    return buildSatelliteInferencePrompt(options);
  }
  const targetPrompt = getTargetCountPrompt(options.targetModel?.prompt || '', options.normalized.composition);

  return [
    sentence(options.shotAngle?.prompt, options.cameraDistance?.prompt),
    sentence(options.composition?.prompt, options.targetScale?.prompt),
    sentence(options.qualityConstraints?.prompt),
    sentence(targetPrompt, options.background?.prompt, options.targetHeading?.prompt),
    sentence(options.targetModel?.detailPrompt),
    sentence(options.weather?.prompt, options.lighting?.prompt, options.sunShadow?.prompt, options.imageStyle?.prompt),
  ].join('');
}

export function getSelectedInferencePromptOptions(selection: InferencePromptSelection) {
  const options = getResolvedPromptOptions(selection);
  return [
    options.targetType,
    options.targetModel,
    options.shotAngle,
    options.targetHeading,
    options.cameraDistance,
    options.composition,
    options.targetScale,
    options.background,
    options.weather,
    options.lighting,
    options.sunShadow,
    options.qualityConstraints,
    options.imageStyle,
  ].filter((option): option is InferencePromptOption => Boolean(option));
}
