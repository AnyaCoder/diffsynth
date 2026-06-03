# DiffSynth Qwen UI

Qwen-Image-2512 的训推一体 Web 控制台。

## Commands

```bash
npm install
npm run update_db
npm run dev
```

生产启动：

```bash
npm run build
npm run start
```

默认端口是 `8675`。

## Required runtime

- Node.js / npm
- `conda`
- 已存在的 `trainer` 环境
- Linux + NVIDIA GPU

## Optional env

- `UI_VIEWER_TOKEN`
- `UI_OPERATOR_TOKEN`
- `UI_ADMIN_TOKEN`
- `UI_AUTH_TOKEN`
- `CONDA_ENV_NAME`

如果设置了任意一个 `UI_*_TOKEN`，所有 `/api/*` 请求都必须携带 `Authorization: Bearer <token>`。

- `UI_VIEWER_TOKEN`：只读
- `UI_OPERATOR_TOKEN`：可写数据集、创建和控制任务
- `UI_ADMIN_TOKEN`：可改设置、删数据集、读审计日志
- `UI_AUTH_TOKEN`：兼容旧配置，按管理员权限处理

## API docs

见 [API.md](./API.md)。
