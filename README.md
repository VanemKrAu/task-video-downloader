# 视频链接下载器

贴一条日志里的链接，把视频取回来。

## 它解决什么问题

有些 AI 视频接口（MiniMax 类型的中转站）把生成的视频放在一条需要鉴权的地址后面，取文件必须带上 API Key。客户端软件在取结果那一步没带这个密钥，于是任务明明生成完了，下载却固定失败，报 `HTTP 401`。

把密钥和链接一起交给这个页面，它就直接去取，全程在你自己控制下。

产物是一个静态网页，托管在 GitHub Pages 上，外加一个 Cloudflare Worker 做转发。

## 为什么需要那个 Worker

浏览器有一条硬规则，跨域请求要看对方的放行头。这类中转站的取文件接口不返回跨域放行头，而且因为要带 `Authorization` 请求头，连预检都过不去。所以网页里直接发请求会被浏览器拦下，中间必须垫一层转发。

Worker 免费额度每天十万次请求，个人用绰绰有余，不花钱。

## 部署

### 第一步，部署 Worker

1. 打开 <https://dash.cloudflare.com/>，登录。
2. 左侧栏找到 **Workers & Pages**，点 **创建** / **Create application**，选 ** Workers**，起个名字，比如 `video-fetch`
3. 进入代码编辑页，把仓库里 `worker.js` 的内容**全部替换**进去
4. 右上角 **部署** / **Deploy**
5. 部署完会给你一个地址，形如 `https://video-fetch.你的子域.workers.dev`，复制下来

要支持别的中转站，改 `worker.js` 顶部的 `ALLOWED_HOSTS` 数组，把域名加进去，重新部署一次。

### 第二步，打开网页

访问 <https://vanemkrau.github.io/task-video-downloader/>

手机浏览器建议加到主屏幕，用起来跟 App 一样。

## 使用

1. **API Key** 填一次，存在这台设备的浏览器里，以后不用再填
2. **代理地址** 填第一步拿到的 Worker 地址，同样只填一次
3. 从软件日志里复制那条取文件的链接，粘到「链接」框里
4. 点「开始下载」

链接可以直接粘一整行日志，比如

```
GET https://api.huanling.icu/v2/video_generation/task_MddvWwnwm72bpnM2faBDZPg56uXRmG1f/content   Status: 401   461ms
```

页面会自己把任务号认出来。粘多条也行，一行一条，会挨个下。

中途如果某条链接粘错了、少抄一位，服务端会返回 `404 task not found`，页面会把这个提示原样显示出来。

## 安全上的几件事

- **密钥只存在浏览器的 localStorage 里**，页面不会把它发给任何第三方
- **Worker 不保存密钥**，每个请求处理完就丢弃
- Worker 带**域名白名单**，只能代理白名单里的站点。就算地址被外人知道，也没法拿去当通用代理
- 建议给这类中转站用**单独的密钥**，并且定期更换

## 已知限制

- 一次下载一个文件，多个链接会自动排队
- 文件如果特别大（几百 MB），手机浏览器可能吃不消，这种情况建议还是用电脑
- 下载地址一般有 24 小时有效期，过期就得重新生成视频

## 本地预览

```bash
cd task-video-downloader
python3 -m http.server 8080
```

然后打开 <http://127.0.0.1:8080>。注意本地预览时仍然需要那个 Worker，跨域限制跟线上一样。

## 文件

| 文件 | 用途 |
|---|---|
| `index.html` | 整个页面，单文件，无外部依赖 |
| `worker.js` | Cloudflare Worker 转发代码 |
