# UI 提示词组合验证矩阵

> 版本：2026-09-11
> 目的：为国庆假期后现场环境适配和 LoRA 微调准备一组可复现的 UI 提示词基线。

## 固定运行条件

- 基座模型：`Qwen/Qwen-Image-2512`
- 推理服务：`2482ca35-86c5-464d-ae1a-dd83e2182a8c`，GPU `3`
- 服务地址：`http://127.0.0.1:55473`
- 图像尺寸：沿用当前 UI/服务默认值
- `seed`：`1301`
- `num_inference_steps`：`16`
- 每次运行保存完整 `job_spec.json`、`result.json`、`state.json` 和原图

## 第一轮组合

固定目标为 `stealth-fighter / f35c`，视角为 `strict-nadir`，距离为
`satellite-orbit`，背景为 `satellite-airfield`，质量约束为
`satellite-clean`，画面风格为 `commercial-satellite`。

| 编号 | 构图 | 尺度 | 天气 | 阴影/光线 | 目的 |
|---|---|---|---|---|---|
| B01 | `single-centered` | `satellite-tiny` | `clear` | 无明显阴影 / 自然白昼 | 2%--4% 微小目标基线 |
| B02 | `single-centered` | `satellite-small` | `clear` | 无明显阴影 / 自然白昼 | 4%--8% 小目标基线 |
| B03 | `single-centered` | `satellite-medium` | `clear` | 无明显阴影 / 自然白昼 | 8%--15% 中小目标基线 |
| B04 | `single-upper-left` | `satellite-small` | `clear` | 无明显阴影 / 自然白昼 | 左上位置稳定性 |
| B05 | `single-lower-right` | `satellite-small` | `clear` | 无明显阴影 / 自然白昼 | 右下位置稳定性 |
| B06 | `single-centered` | `distant` | `clear` | 无明显阴影 / 自然白昼 | 20%--35% 远距对照尺度 |
| W01 | `single-centered` | `satellite-small` | `light-rain` | 无明显阴影 / 阴天漫射光 | 湿地、积水、雨丝可辨性 |
| W02 | `single-centered` | `satellite-small` | `snow` | 柔和阴影 / 阴天漫射光 | 积雪、清扫带、车辙可辨性 |
| W03 | `single-centered` | `satellite-small` | `light-fog` | 柔和阴影 / 阴天漫射光 | 远景降对比、近景目标保留 |
| W04 | `single-centered` | `satellite-small` | `dense-fog` | 无明显阴影 / 阴天漫射光 | 60%--80% 雾幕和背景消隐 |

现有已生成的新版样例：

- W01：`outputs/qwen_image/prompt_v2_weather_rain_1789101674470/prompt_v2_rain_1789102409072.jpg`
- W02：`outputs/qwen_image/prompt_v2_weather_snow_1789103023333/prompt_v2_snow_1789103707183.jpg`
- W04：`outputs/qwen_image/prompt_v2_weather_dense_fog_1789103755753/prompt_v2_dense_fog_1789104042598.jpg`

## 记录字段

每个组合至少记录以下内容，不以主观印象替代测量：

1. 原图路径和对应 `job_spec.json`；
2. 目标外接框 `(x, y, width, height)`，以及最长边占画面宽度比例；
3. 目标中心相对画面中心的偏差；
4. 目标完整率、型号关键结构是否可辨；
5. 正俯视合格与否，是否出现地平线、斜视或透视收敛；
6. 天气线索是否满足表中“必须可见”和“必须排除”；
7. 背景异常、重复目标、结构变形和其他失败原因。

## 判定边界

- 提示词中的百分比是生成条件，不是验收结果；最终比例必须从图像像素测量。
- 固定 seed 只能保证一次运行可复现，不能证明跨天气、跨背景的一致性。
- 雨丝和雨滴波纹在大范围卫星视场中可能低于可见尺度；此时优先记录湿地变深、积水和反光，并把细粒度线索转入近距场景验证。
- 若 B01--B05 的位置或尺度离散仍然较大，现场前冻结 DOM、bbox/mask 和 GSD，转入 Inpaint 或 Depth/Canny 控制，不继续堆叠自然语言约束。

## 节后现场衔接

现场第一天按本矩阵复跑 B01、B02、W01、W02、W04，确认模型、GPU、依赖和服务输出一致；再使用甲方固定测试集做 LoRA 微调前后对比。现场结果沿用本文件记录字段，避免只提交挑选后的效果图。
