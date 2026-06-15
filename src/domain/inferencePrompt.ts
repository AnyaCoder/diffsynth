export type InferencePromptGroupId = 'targetType' | 'targetModel' | 'shotAngle' | 'background';

export interface InferencePromptOption {
  id: string;
  label: string;
  prompt: string;
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
  backgrounds: InferencePromptOption[];
}

export type InferencePromptSelection = Record<InferencePromptGroupId, string>;

const TARGET_TYPES: InferencePromptOption[] = [
  { id: 'stealth-fighter', label: '隐身战斗机', prompt: '隐身战斗机' },
  { id: 'carrier-fighter', label: '舰载战斗机', prompt: '舰载战斗机' },
  { id: 'uav', label: '无人机', prompt: '军用无人机' },
  { id: 'helicopter', label: '直升机', prompt: '军用直升机' },
  { id: 'warship', label: '水面舰艇', prompt: '水面舰艇' },
  { id: 'armored-vehicle', label: '装甲车辆', prompt: '装甲车辆' },
];

const TARGET_MODELS_BY_TYPE: Record<string, InferencePromptOption[]> = {
  'stealth-fighter': [
    { id: 'f35c', label: 'F-35C', prompt: 'F-35C闪电II舰载隐身战斗机' },
    { id: 'f22a', label: 'F-22A', prompt: 'F-22A猛禽隐身战斗机' },
    { id: 'j20', label: '歼-20', prompt: '歼-20隐身战斗机' },
    { id: 'su57', label: 'Su-57', prompt: 'Su-57隐身战斗机' },
  ],
  'carrier-fighter': [
    { id: 'f35c', label: 'F-35C', prompt: 'F-35C闪电II舰载隐身战斗机' },
    { id: 'f18e', label: 'F/A-18E', prompt: 'F/A-18E超级大黄蜂舰载战斗机' },
  ],
  uav: [
    { id: 'mq9', label: 'MQ-9', prompt: 'MQ-9察打一体无人机' },
    { id: 'wing-loong', label: '翼龙', prompt: '翼龙察打一体无人机' },
  ],
  helicopter: [
    { id: 'ah64', label: 'AH-64', prompt: 'AH-64阿帕奇武装直升机' },
    { id: 'uh60', label: 'UH-60', prompt: 'UH-60黑鹰直升机' },
  ],
  warship: [
    { id: 'type055', label: '055型', prompt: '055型导弹驱逐舰' },
    { id: 'carrier', label: '航母', prompt: '航空母舰' },
  ],
  'armored-vehicle': [
    { id: 'tank', label: '主战坦克', prompt: '主战坦克' },
    { id: 'apc', label: '装甲运兵车', prompt: '装甲运兵车' },
  ],
};

const SHOT_ANGLES: InferencePromptOption[] = [
  { id: 'side-level', label: '侧方平视', prompt: '侧方平视视角' },
  { id: 'front-quarter', label: '正面迎角', prompt: '正面三分之四迎角' },
  { id: 'top-down', label: '俯视', prompt: '从上方俯视视角' },
  { id: 'low-angle', label: '仰视', prompt: '低角度仰视视角' },
  { id: 'telephoto', label: '远距长焦', prompt: '远距离长焦拍摄' },
  { id: 'close-up', label: '近距特写', prompt: '近距离主体特写' },
];

const BACKGROUNDS: InferencePromptOption[] = [
  { id: 'blue-sky', label: '高空蓝天', prompt: '澄澈浅蓝色高空背景' },
  { id: 'sea', label: '海面巡航', prompt: '开阔海面巡航背景' },
  { id: 'runway', label: '机场跑道', prompt: '军用机场跑道背景' },
  { id: 'clouds', label: '云层穿越', prompt: '穿越云层的天空背景' },
  { id: 'mountains', label: '山地远景', prompt: '远处山脉与地面景观背景' },
  { id: 'carrier-deck', label: '航母甲板', prompt: '航空母舰飞行甲板背景' },
];

export const INFERENCE_PROMPT_CATALOG: InferencePromptCatalog = {
  targetTypes: TARGET_TYPES,
  targetModelsByType: TARGET_MODELS_BY_TYPE,
  shotAngles: SHOT_ANGLES,
  backgrounds: BACKGROUNDS,
};

export const INFERENCE_PROMPT_GROUPS: InferencePromptGroup[] = [
  {
    id: 'targetType',
    titleKey: 'promptGroups.targetType',
    required: true,
    options: TARGET_TYPES,
  },
  {
    id: 'targetModel',
    titleKey: 'promptGroups.targetModel',
    required: true,
    options: TARGET_MODELS_BY_TYPE['stealth-fighter'],
  },
  {
    id: 'shotAngle',
    titleKey: 'promptGroups.shotAngle',
    required: true,
    options: SHOT_ANGLES,
  },
  {
    id: 'background',
    titleKey: 'promptGroups.background',
    required: true,
    options: BACKGROUNDS,
  },
];

export const DEFAULT_INFERENCE_PROMPT_SELECTION = {
  targetType: TARGET_TYPES[0]?.id || '',
  targetModel: TARGET_MODELS_BY_TYPE['stealth-fighter'][0]?.id || '',
  shotAngle: SHOT_ANGLES[0]?.id || '',
  background: BACKGROUNDS[0]?.id || '',
} satisfies InferencePromptSelection;

export function getPromptGroupOptions(groupId: InferencePromptGroupId, selection: InferencePromptSelection) {
  if (groupId === 'targetType') {
    return TARGET_TYPES;
  }
  if (groupId === 'targetModel') {
    return TARGET_MODELS_BY_TYPE[selection.targetType] ?? TARGET_MODELS_BY_TYPE['stealth-fighter'];
  }
  if (groupId === 'shotAngle') {
    return SHOT_ANGLES;
  }
  return BACKGROUNDS;
}

export function normalizeInferencePromptSelection(selection: Partial<InferencePromptSelection>) {
  const targetType = TARGET_TYPES.some(option => option.id === selection.targetType)
    ? selection.targetType!
    : DEFAULT_INFERENCE_PROMPT_SELECTION.targetType;
  const targetModelOptions = TARGET_MODELS_BY_TYPE[targetType] ?? TARGET_MODELS_BY_TYPE['stealth-fighter'];
  const targetModel = targetModelOptions.some(option => option.id === selection.targetModel)
    ? selection.targetModel!
    : targetModelOptions[0]?.id || DEFAULT_INFERENCE_PROMPT_SELECTION.targetModel;
  const shotAngle = SHOT_ANGLES.some(option => option.id === selection.shotAngle)
    ? selection.shotAngle!
    : DEFAULT_INFERENCE_PROMPT_SELECTION.shotAngle;
  const background = BACKGROUNDS.some(option => option.id === selection.background)
    ? selection.background!
    : DEFAULT_INFERENCE_PROMPT_SELECTION.background;

  return {
    targetType,
    targetModel,
    shotAngle,
    background,
  } satisfies InferencePromptSelection;
}

export function buildInferencePrompt(selection: InferencePromptSelection) {
  const normalized = normalizeInferencePromptSelection(selection);
  const targetType = TARGET_TYPES.find(option => option.id === normalized.targetType) ?? TARGET_TYPES[0];
  const targetModelOptions = TARGET_MODELS_BY_TYPE[normalized.targetType] ?? TARGET_MODELS_BY_TYPE['stealth-fighter'];
  const targetModel = targetModelOptions.find(option => option.id === normalized.targetModel) ?? targetModelOptions[0];
  const shotAngle = SHOT_ANGLES.find(option => option.id === normalized.shotAngle) ?? SHOT_ANGLES[0];
  const background = BACKGROUNDS.find(option => option.id === normalized.background) ?? BACKGROUNDS[0];

  return [targetType, targetModel, shotAngle, background]
    .filter(Boolean)
    .map(option => option!.prompt)
    .join('，');
}

export function getSelectedInferencePromptOptions(selection: InferencePromptSelection) {
  const normalized = normalizeInferencePromptSelection(selection);
  const targetModelOptions = TARGET_MODELS_BY_TYPE[normalized.targetType] ?? TARGET_MODELS_BY_TYPE['stealth-fighter'];
  return [
    TARGET_TYPES.find(option => option.id === normalized.targetType) ?? TARGET_TYPES[0],
    targetModelOptions.find(option => option.id === normalized.targetModel) ?? targetModelOptions[0],
    SHOT_ANGLES.find(option => option.id === normalized.shotAngle) ?? SHOT_ANGLES[0],
    BACKGROUNDS.find(option => option.id === normalized.background) ?? BACKGROUNDS[0],
  ].filter((option): option is InferencePromptOption => Boolean(option));
}
