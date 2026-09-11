from pathlib import Path

from PIL import Image

from diffsynth.pipelines.qwen_image import ControlNetInput, ModelConfig

INPAINT_CONTROL_MODEL_ID = "DiffSynth-Studio/Qwen-Image-Blockwise-ControlNet-Inpaint"


def normalize_control_mode(value):
    return "inpaint" if value == "inpaint" else "none"


def append_controlnet_model_config(model_configs, offload_mode, control_mode):
    if normalize_control_mode(control_mode) != "inpaint":
        return model_configs
    vram_config = build_low_vram_config() if offload_mode == "disk_cpu" else {}
    return [
        *model_configs,
        ModelConfig(model_id=INPAINT_CONTROL_MODEL_ID, origin_file_pattern="model.safetensors", **vram_config),
    ]


def build_low_vram_config():
    import torch

    return {
        "offload_dtype": "disk",
        "offload_device": "disk",
        "onload_dtype": torch.float8_e4m3fn,
        "onload_device": "cpu",
        "preparing_dtype": torch.float8_e4m3fn,
        "preparing_device": "cuda",
        "computation_dtype": torch.bfloat16,
        "computation_device": "cuda",
    }


def load_inpaint_inputs(control_image_path, inpaint_mask_path, width, height):
    if not control_image_path or not inpaint_mask_path:
        raise ValueError("Inpaint requires a control image and mask")
    control_path = Path(control_image_path)
    mask_path = Path(inpaint_mask_path)
    if not control_path.is_file() or not mask_path.is_file():
        raise FileNotFoundError("Inpaint control image or mask not found")
    try:
        control_image = Image.open(control_path).convert("RGB")
        # Qwen's ControlNet preprocessing expects an HWC image; keep the mask
        # RGB here and let the pipeline reduce it to one channel.
        inpaint_mask = Image.open(mask_path).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Invalid inpaint image or mask: {exc}") from exc
    control_image = control_image.resize((width, height), Image.Resampling.LANCZOS)
    inpaint_mask = inpaint_mask.resize((width, height), Image.Resampling.NEAREST)
    return {
        "input_image": control_image,
        "inpaint_mask": inpaint_mask,
        "blockwise_controlnet_inputs": [
            ControlNetInput(image=control_image, inpaint_mask=inpaint_mask),
        ],
    }
