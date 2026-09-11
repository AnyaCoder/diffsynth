# 可复用的开源算法筛选

> 调研日期：2026-09-11
> 目标：为 Qwen-Image-2512 的目标位置/尺度、卫星正俯视、天气和型号一致性选择可落地的开源方法。

## 结论先行

当前最值得接入的不是另起一个 Stable Diffusion 分支，而是沿用 Qwen-Image 基座，接入仓库已经提供的 **Qwen Blockwise ControlNet**：

1. `Canny`：锁定目标轮廓、跑道/道路边缘和构图边界；
2. `Depth`：约束俯视层次、地面结构和目标与背景的空间关系；
3. `Inpaint`：固定 DOM 背景，只在目标 mask 内生成或替换装备；
4. 现有 DiT LoRA：负责具体型号、材质和军事场景域适配。

这条路线已经有本仓库的 pipeline、模型加载和推理示例，改动集中在 UI 请求字段、输入文件校验和服务模型配置。它比把 GLIGEN、T2I-Adapter 或原始 ControlNet 直接移植到 Qwen 更可靠。

## 候选算法

| 方法 | 论文/来源 | 能解决的问题 | 与当前 Qwen 链路 | 建议 |
|---|---|---|---|---|
| Qwen Blockwise ControlNet Canny/Depth/Inpaint | [DiffSynth 示例](https://github.com/modelscope/DiffSynth-Studio/tree/main/examples/qwen_image/model_inference)；[Canny 模型](https://modelscope.cn/models/DiffSynth-Studio/Qwen-Image-Blockwise-ControlNet-Canny) | 边缘、深度、mask 区域控制 | 已在 `diffsynth/pipelines/qwen_image.py` 原生支持 | **第一优先级** |
| LoRA / PEFT | [LoRA, ICLR 2022](https://openreview.net/forum?id=nZeVKeeFYf9) | 装备型号、纹理和场景风格适配 | UI 和训练链路已经支持 | **保留，作为第二阶段** |
| Grounding DINO + SAM/SAM 2 | [Grounding DINO, ECCV 2024](https://arxiv.org/abs/2303.05499)；[SAM, ICCV 2023](https://arxiv.org/abs/2304.02643)；[SAM 2 代码](https://github.com/facebookresearch/sam2) | 从参考图自动得到目标 bbox/mask | 作为预处理服务接入，与 Qwen 解耦 | **用于自动标注** |
| ControlNet | [ICCV 2023](https://doi.org/10.1109/ICCV51070.2023.00355)；[官方代码](https://github.com/lllyasviel/ControlNet) | 通用结构条件控制 | 原始权重面向 SD；Qwen 版本应使用 Blockwise 适配 | 借鉴思想，不直接换基座 |
| GLIGEN | [CVPR 2023](https://doi.org/10.1109/CVPR52729.2023.02156)；[代码](https://github.com/gligen/GLIGEN) | 文本 + bbox 的目标落位 | 主要绑定 Stable Diffusion，当前 Qwen 无直接兼容权重 | 作为 bbox 控制对照 |
| GeoDiffusion | [ICLR 2024 代码/模型](https://github.com/KaiChen1998/GeoDiffusion) | 文本提示的几何布局和目标框生成 | 使用 SD 系列和旧版依赖，不能直接加载到 Qwen | 作为几何基线/论文对照 |
| DiffusionSat | [ICLR 2024 代码/模型](https://github.com/samar-khanna/DiffusionSat) | 遥感影像、时相/元数据和 ControlNet 条件 | 基于 SD2.1，偏卫星域，不保证军事装备型号 | 作为遥感域对照，不作为主链路 |
| T2I-Adapter | [AAAI 2024](https://doi.org/10.1609/aaai.v38i5.28226)；[代码](https://github.com/TencentARC/T2I-Adapter) | 轻量 Canny/Depth/Sketch 等控制 | 官方权重面向 SD/SDXL，无法直接套 Qwen | 只有切换基座时再评估 |

## 为什么优先 Qwen Blockwise ControlNet

- pipeline 已定义 `ControlNetInput`、多 ControlNet、`start/end/scale` 控制和低显存模型池；
- 模型条件在 DiT block 内注入，不需要把 SD 的 UNet/latent 通道结构硬改到 Qwen；
- Canny、Depth、Inpaint 三种条件正好对应当前三个硬问题：轮廓/俯视结构、空间层次、固定背景与目标替换；
- 现有 UI 只需要从“纯 prompt”扩展成“prompt + 条件图 + 几何元数据”，不会破坏已有纯文本回归集。

## 推荐接入顺序

### P0：先做 Inpaint（最能解决背景一致性）

输入一张固定 DOM 或正射底图、一张目标 mask、目标型号 prompt。只在 mask 区域生成目标，背景保持不变。验收重点是目标 bbox、中心误差、目标完整率和背景变化率。

对应示例：`examples/qwen_image/model_inference/Qwen-Image-Blockwise-ControlNet-Inpaint.py`。

### P1：再做 Canny + Depth（锁构图和俯视关系）

同一张 DOM/结构草图生成两张控制图，分别作为 Canny 和 Depth 条件输入。先只启用单条件做消融，再测试两者组合，避免不知道是哪一个条件造成伪影。

对应示例：

- `examples/qwen_image/model_inference/Qwen-Image-Blockwise-ControlNet-Canny.py`
- `examples/qwen_image/model_inference/Qwen-Image-Blockwise-ControlNet-Depth.py`

### P2：接 Grounding DINO + SAM 2 自动生成 mask

当甲方提供的底图没有人工标注时，用型号文本得到候选框，再由 SAM 2 细化 mask；人工复核后进入 Inpaint。这个组合只负责数据准备，不参与 Qwen 的去噪计算，便于离线部署和替换。

## UI/API 应增加的字段

建议把当前 `InferJobConfig` 扩展为可选的受控生成字段，保持纯文本任务兼容：

```json
{
  "control_mode": "none | canny | depth | inpaint | canny_depth",
  "control_image_path": "...",
  "inpaint_mask_path": "...",
  "target_bbox_xyxy": [x1, y1, x2, y2],
  "gsd_m_per_pixel": 0.25,
  "physical_size_m": [14.4, 10.7],
  "control_scale": 0.8,
  "control_start": 0.0,
  "control_end": 1.0,
  "lora_configs": [{"path": "...", "weight": 1.0, "role": "target_model"}]
}
```

服务端必须做以下校验：路径只能位于允许的输入根目录；mask 与控制图尺寸一致；bbox 不越界；GSD、实际尺寸和像素尺寸相互可计算；任务 spec 和 result 同时记录控制图、mask、参数及模型版本。

## 验收指标

不能只看主观效果图。建议固定同一 DOM、seed、型号和天气，记录：

- bbox IoU、中心偏差（像素和归一化比例）；
- 目标最长边/画面宽度比例误差；
- 目标完整率、朝向误差和关键结构可辨率；
- mask 外背景变化率（Inpaint 的核心指标）；
- 正俯视合格率、地平线/斜视/透视收敛失败率；
- 雨雪雾线索可辨性和互斥项违规率；
- 单图耗时、显存峰值、服务重启恢复和离线加载成功率。

## 不建议当前直接做的事

- 不把 GLIGEN、T2I-Adapter 的 SD/SDXL 权重直接放进 Qwen pipeline；这会引入新的基座、显存和离线物料，且无法证明几何指标改善。
- 不为了“顶会算法”同时引入多个新基座；先在 Qwen 原生 ControlNet 上完成消融和固定测试集。
- 不把 DiffusionSat 生成的遥感域图像直接当作军事装备型号微调数据；其主要贡献是遥感域和元数据条件，不是具体装备结构精度。
- 不把 Grounding DINO/SAM 的自动框当成真值；现场前仍需人工复核并冻结测试集。

## 许可和交付检查

代码仓库的许可证与模型权重许可证要分开记录。当前候选代码包含 Apache-2.0、MIT 等许可，但 ModelScope/Hugging Face 权重可能有额外条款；在现场交付包中保存每个仓库 commit、权重来源、许可证文件和 SHA-256，不以 GitHub 星数代替合规检查。
