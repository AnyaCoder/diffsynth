export type InferencePromptGroupId = 'targetType' | 'targetModel' | 'shotAngle' | 'background';

export interface InferencePromptOption {
  id: string;
  label: string;
  prompt: string;
}

export interface InferencePromptGroup {
  id: InferencePromptGroupId;
  options: InferencePromptOption[];
}

export type InferencePromptSelection = Record<InferencePromptGroupId, string>;

export const INFERENCE_PROMPT_GROUPS: InferencePromptGroup[] = [
  {
    id: 'targetType',
    options: [
      { id: 'stealth-fighter', label: '隐身战斗机', prompt: '隐身战斗机' },
      { id: 'carrier-fighter', label: '舰载战斗机', prompt: '舰载战斗机' },
      { id: 'uav', label: '无人机', prompt: '军用无人机' },
      { id: 'helicopter', label: '直升机', prompt: '军用直升机' },
      { id: 'warship', label: '水面舰艇', prompt: '水面舰艇' },
      { id: 'armored-vehicle', label: '装甲车辆', prompt: '装甲车辆' },
    ],
  },
  {
    id: 'targetModel',
    options: [
      { id: 'f35c', label: 'F-35C', prompt: 'F-35C闪电II舰载隐身战斗机' },
      { id: 'f22a', label: 'F-22A', prompt: 'F-22A猛禽隐身战斗机' },
      { id: 'j20', label: '歼-20', prompt: '歼-20隐身战斗机' },
      { id: 'su57', label: 'Su-57', prompt: 'Su-57隐身战斗机' },
      { id: 'mq9', label: 'MQ-9', prompt: 'MQ-9察打一体无人机' },
      { id: 'type055', label: '055型', prompt: '055型导弹驱逐舰' },
    ],
  },
  {
    id: 'shotAngle',
    options: [
      { id: 'side-level', label: '侧方平视', prompt: '侧方平视视角' },
      { id: 'front-quarter', label: '正面迎角', prompt: '正面三分之四迎角' },
      { id: 'top-down', label: '俯视', prompt: '从上方俯视视角' },
      { id: 'low-angle', label: '仰视', prompt: '低角度仰视视角' },
      { id: 'telephoto', label: '远距长焦', prompt: '远距离长焦拍摄' },
      { id: 'close-up', label: '近距特写', prompt: '近距离主体特写' },
    ],
  },
  {
    id: 'background',
    options: [
      { id: 'blue-sky', label: '高空蓝天', prompt: '澄澈浅蓝色高空背景' },
      { id: 'sea', label: '海面巡航', prompt: '开阔海面巡航背景' },
      { id: 'runway', label: '机场跑道', prompt: '军用机场跑道背景' },
      { id: 'clouds', label: '云层穿越', prompt: '穿越云层的天空背景' },
      { id: 'mountains', label: '山地远景', prompt: '远处山脉与地面景观背景' },
      { id: 'carrier-deck', label: '航母甲板', prompt: '航空母舰飞行甲板背景' },
    ],
  },
];

export const DEFAULT_INFERENCE_PROMPT_SELECTION = INFERENCE_PROMPT_GROUPS.reduce(
  (selection, group) => ({
    ...selection,
    [group.id]: group.options[0]?.id || '',
  }),
  {} as InferencePromptSelection,
);

export function getSelectedInferencePromptOptions(selection: InferencePromptSelection) {
  return INFERENCE_PROMPT_GROUPS.map(group => {
    const selected = group.options.find(option => option.id === selection[group.id]);
    return selected ?? group.options[0];
  }).filter((option): option is InferencePromptOption => Boolean(option));
}

export function buildInferencePrompt(selection: InferencePromptSelection) {
  return getSelectedInferencePromptOptions(selection)
    .map(option => option.prompt)
    .join('，');
}
