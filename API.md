# DiffSynth Qwen UI API

`DiffSynth-Studio/ui` 提供一组可独立于前端页面调用的 HTTP API。前端本身也是通过这些接口完成数据集管理、训练任务和推理任务调度。

默认地址：

```text
http://127.0.0.1:8675
```

## Auth

支持 4 种环境变量：

- `UI_VIEWER_TOKEN`
- `UI_OPERATOR_TOKEN`
- `UI_ADMIN_TOKEN`
- `UI_AUTH_TOKEN`

规则：

- 如果以上 4 个变量都没设置，`/api/*` 全部开放。
- 如果设置了任意一个 token，所有 `/api/*` 都需要 `Authorization: Bearer <token>`。
- `UI_AUTH_TOKEN` 是兼容旧配置的管理员 token。

角色能力：

- `viewer`：只读接口
- `operator`：数据集写入、创建任务、启动/停止任务
- `admin`：额外可改设置、删数据集、查审计日志

请求头示例：

```bash
curl -H 'Authorization: Bearer operator-token' http://127.0.0.1:8675/api/auth
```

`GET /api/auth` 返回当前请求鉴权结果：

```json
{
  "authEnabled": true,
  "isAuthenticated": true,
  "legacy": false,
  "role": "operator"
}
```

## Quick Start

开放模式下创建并启动一个推理任务：

```bash
BASE_URL=http://127.0.0.1:8675

JOB_ID=$(
  curl -s -X POST "$BASE_URL/api/jobs" \
    -H 'Content-Type: application/json' \
    -d '{
      "name": "api_infer_demo",
      "job_type": "infer",
      "config": {
        "prompt": "A cinematic portrait, fine details, soft light.",
        "seed": 0,
        "num_inference_steps": 40,
        "output_prefix": "image",
        "gpu_ids": "7",
        "checkpoint_path": "/abs/path/to/epoch-4.safetensors",
        "base_model": "Qwen/Qwen-Image-2512"
      }
    }' | sed -n 's/.*"id":"\\([^"]*\\)".*/\\1/p'
)

curl -X POST "$BASE_URL/api/jobs/$JOB_ID/start"
curl "$BASE_URL/api/jobs?id=$JOB_ID"
curl "$BASE_URL/api/jobs/$JOB_ID/log"
curl "$BASE_URL/api/jobs/$JOB_ID/results"
```

带鉴权的示例：

```bash
BASE_URL=http://127.0.0.1:8675
TOKEN=operator-token

curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth"
```

## Status Codes

常见返回码：

- `200`：成功
- `400`：请求参数错误
- `401`：缺少 token 或 token 错误
- `403`：角色权限不足
- `404`：资源不存在
- `405`：方法不允许
- `409`：名称冲突或 GPU 忙
- `500`：服务端错误

## API List

### Auth

#### `GET /api/auth`

用途：验证 token 是否有效，并返回当前角色。

最低权限：`viewer`

示例：

```bash
curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth"
```

### Resources

#### `GET /api/resources/cpu`
#### `GET /api/cpu`

用途：读取 CPU、内存和负载信息。

最低权限：`viewer`

返回字段：

- `name`
- `cores`
- `temperature`
- `totalMemory`
- `freeMemory`
- `availableMemory`
- `currentLoad`

#### `GET /api/resources/gpu`
#### `GET /api/gpu`

用途：读取 GPU 信息。

最低权限：`viewer`

返回字段：

- `hasNvidiaSmi`
- `isMac`
- `gpus`

`gpus[]` 字段：

- `index`
- `name`
- `driverVersion`
- `temperature`
- `utilization.gpu`
- `utilization.memory`
- `memory.total`
- `memory.free`
- `memory.used`
- `power.draw`
- `power.limit`
- `clocks.graphics`
- `clocks.memory`
- `fan.speed`

#### `GET /api/resources/disk`

用途：读取数据集、训练、推理目录和磁盘空间信息。

最低权限：`viewer`

返回字段：

- `datasetsRoot`
- `trainingRoot`
- `inferenceRoot`
- `freeBytes`
- `totalBytes`

### Datasets

#### `GET /api/datasets/list`

用途：列出所有数据集目录。

最低权限：`viewer`

返回：

```json
{
  "datasets": ["dataset_a", "dataset_b"]
}
```

#### `GET /api/datasets/items?datasetName=<name>`

用途：列出数据集中的图片和 caption。

最低权限：`viewer`

返回字段：

- `file_name`
- `relative_path`
- `caption`
- `has_caption`
- `thumb_url`

#### `POST /api/datasets/create`

用途：创建数据集目录。

最低权限：`operator`

请求体：

```json
{
  "name": "my_dataset"
}
```

返回：

```json
{
  "success": true,
  "path": "/abs/path/to/dataset"
}
```

#### `POST /api/datasets/delete`

用途：删除整个数据集目录。

最低权限：`admin`

请求体：

```json
{
  "name": "my_dataset"
}
```

#### `POST /api/datasets/upload`

用途：向数据集上传图片。

最低权限：`operator`

请求格式：`multipart/form-data`

字段：

- `datasetName`
- `files`：可重复

示例：

```bash
curl -X POST "$BASE_URL/api/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'datasetName=my_dataset' \
  -F 'files=@./1.jpg' \
  -F 'files=@./2.png'
```

#### `POST /api/datasets/captions/save`

用途：保存 `.txt` caption，并重建 `metadata.csv`。

最低权限：`operator`

请求体：

```json
{
  "datasetName": "my_dataset",
  "items": [
    { "file_name": "1.jpg", "caption": "a red dress portrait" },
    { "file_name": "2.png", "caption": "studio photo, soft light" }
  ]
}
```

### Files

#### `GET /api/images/<dataset>/<file>`

用途：读取数据集图片，带正确 `Content-Type`。

最低权限：`viewer`

示例：

```bash
curl "$BASE_URL/api/images/my_dataset/1.jpg" --output 1.jpg
```

#### `GET /api/files/<absolute-path>`

用途：读取允许根目录下的任意文件。

最低权限：`viewer`

允许根目录：

- `DATASETS_ROOT`
- `TRAINING_ROOT`
- `INFERENCE_ROOT`

注意：

- 这里读取的是“绝对路径编码后的路径片段”，不是普通文件名。
- 例如前端会使用 `/api/files/${encodeURIComponent(fullPath)}`。

示例：

```bash
FILE_PATH=$(python - <<'PY'
import urllib.parse
print(urllib.parse.quote('/newdisk/PythonProject/DiffSynth-Studio/models/train/job_a/log.txt', safe=''))
PY
)
curl "$BASE_URL/api/files/$FILE_PATH"
```

### Jobs

#### `GET /api/jobs`

用途：列出所有任务。

最低权限：`viewer`

可选查询参数：

- `id`
- `job_type`，可选 `train` 或 `infer`

示例：

```bash
curl "$BASE_URL/api/jobs?job_type=train"
curl "$BASE_URL/api/jobs?id=<job-id>"
```

#### `POST /api/jobs`

用途：创建训练任务或推理任务。

最低权限：`operator`

训练任务请求体示例：

```json
{
  "name": "Qwen-Image-2512_lora_fp8",
  "job_type": "train",
  "dataset_name": "Qwen-Image-2512",
  "gpu_ids": "0,1",
  "output_path": "/newdisk/PythonProject/DiffSynth-Studio/models/train/Qwen-Image-2512_lora_fp8",
  "config": {
    "dataset_base_path": "/newdisk/PythonProject/DiffSynth-Studio/data/diffsynth_example_dataset/qwen_image/Qwen-Image-2512",
    "dataset_metadata_path": "/newdisk/PythonProject/DiffSynth-Studio/data/diffsynth_example_dataset/qwen_image/Qwen-Image-2512/metadata.csv",
    "learning_rate": 0.0001,
    "num_epochs": 5,
    "dataset_repeat": 50,
    "max_pixels": 1048576,
    "lora_rank": 32,
    "dataset_num_workers": 8,
    "gradient_accumulation_steps": 1,
    "use_gradient_checkpointing": true,
    "find_unused_parameters": true,
    "multi_gpu": true,
    "model_id_with_origin_paths": "Qwen/Qwen-Image-2512:transformer/diffusion_pytorch_model*.safetensors,Qwen/Qwen-Image:text_encoder/model*.safetensors,Qwen/Qwen-Image:vae/diffusion_pytorch_model.safetensors",
    "fp8_models": "Qwen/Qwen-Image-2512:transformer/diffusion_pytorch_model*.safetensors,Qwen/Qwen-Image:text_encoder/model*.safetensors,Qwen/Qwen-Image:vae/diffusion_pytorch_model.safetensors",
    "lora_base_model": "dit",
    "lora_target_modules": "to_q,to_k,to_v,add_q_proj,add_k_proj,add_v_proj,to_out.0,to_add_out,img_mlp.net.2,img_mod.1,txt_mlp.net.2,txt_mod.1",
    "remove_prefix_in_ckpt": "pipe.dit."
  }
}
```

说明：

- 顶层 `dataset_name` 和 `gpu_ids` 是必填。
- `config.dataset_base_path`、`config.dataset_metadata_path`、`output_path` 可显式指定绝对路径。
- `config.multi_gpu=true` 且 `gpu_ids=0,1` 时，worker 会注入 `CUDA_VISIBLE_DEVICES=0,1` 并生成 `accelerate launch --multi_gpu --num_processes 2`。

推理任务请求体示例：

```json
{
  "name": "infer_demo",
  "job_type": "infer",
  "config": {
    "prompt": "A cinematic portrait, fine details, soft light.",
    "seed": 0,
    "num_inference_steps": 40,
    "output_prefix": "image",
    "gpu_ids": "7",
    "checkpoint_path": "/newdisk/PythonProject/DiffSynth-Studio/models/train/job_a/epoch-4.safetensors",
    "base_model": "Qwen/Qwen-Image-2512"
  }
}
```

也可以不传 `checkpoint_path`，改传：

```json
{
  "source_train_job_id": "<train-job-id>"
}
```

系统会自动选择该训练任务产物里最新的 `.safetensors`。

#### `POST /api/jobs/<id>/start`

用途：启动任务。

最低权限：`operator`

行为：

- 训练任务：进入队列/启动训练
- 推理任务：直接启动

注意：

- 旧的 `GET /api/jobs/<id>/start` 已废弃，现在会返回 `405`

#### `POST /api/jobs/<id>/stop`

用途：请求停止任务。

最低权限：`operator`

注意：

- 旧的 `GET /api/jobs/<id>/stop` 已废弃，现在会返回 `405`

#### `GET /api/jobs/<id>/artifacts`

用途：列出任务产物。

最低权限：`viewer`

返回字段：

- `kind`：`checkpoint`、`image`、`log`、`spec`
- `name`
- `path`
- `size`
- `created_at`

#### `GET /api/jobs/<id>/log?offset=<n>`

用途：增量读取任务日志。

最低权限：`viewer`

返回：

```json
{
  "offset": 12345,
  "text": "new log chunk"
}
```

#### `GET /api/jobs/<id>/results`

用途：读取推理结果摘要。

最低权限：`viewer`

返回字段：

- `image_path`
- `image_url`
- `prompt`
- `seed`
- `num_inference_steps`
- `checkpoint_path`
- `created_at`
- `source_train_job_id`

### Queue

#### `GET /api/queue`

用途：读取 GPU 队列状态。

最低权限：`viewer`

返回字段：

- `id`
- `gpu_ids`
- `is_running`

### Settings

#### `GET /api/settings`

用途：读取运行根目录和 conda 环境名。

最低权限：`admin`

返回字段：

- `DATASETS_ROOT`
- `TRAINING_ROOT`
- `INFERENCE_ROOT`
- `CONDA_ENV_NAME`

#### `POST /api/settings`

用途：更新运行设置。

最低权限：`admin`

请求体：

```json
{
  "DATASETS_ROOT": "/abs/path/to/datasets",
  "TRAINING_ROOT": "/abs/path/to/train",
  "INFERENCE_ROOT": "/abs/path/to/infer",
  "CONDA_ENV_NAME": "trainer"
}
```

### Audit

#### `GET /api/audit?limit=<n>`

用途：读取审计日志。

最低权限：`admin`

查询参数：

- `limit`：`1..500`，默认 `100`

返回字段：

- `id`
- `action`
- `actor_role`
- `auth_legacy`
- `detail_json`
- `detail`
- `ip_address`
- `outcome`
- `request_method`
- `request_path`
- `resource_id`
- `resource_type`
- `status_code`
- `user_agent`
- `created_at`

## Notes

- API 目前没有用户体系，也没有 token 过期机制。
- 没有单独实现跨域浏览器访问支持；服务端调用和 `curl` 没问题。
- `/api/files` 仍然是高权限能力的只读暴露面，虽然受根目录约束，但不适合直接裸露到公网。
