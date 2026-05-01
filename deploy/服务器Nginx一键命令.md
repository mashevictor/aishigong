# 服务器上执行（目录 `/var/www/aishigong`）

假设代码已从 GitHub 拉到本机，且 Nginx 已安装。

## 1. 复制站点配置

```bash
sudo cp /var/www/aishigong/deploy/nginx.aishigong.http.conf /etc/nginx/sites-available/aishigong
```

## 2. 启用站点（并避免与默认站抢 80）

```bash
sudo ln -sf /etc/nginx/sites-available/aishigong /etc/nginx/sites-enabled/aishigong
sudo rm -f /etc/nginx/sites-enabled/default
```

若你仍需要 default，可跳过 `rm`，改为自己调整 `listen` 冲突。

## 3. 检查并重载 Nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. 确认 Node 与 .env

应用根目录 `.env` 建议包含：

```env
NODE_ENV=production
PORT=3780
BIND_HOST=127.0.0.1
TRUST_PROXY=true
```

```bash
cd /var/www/aishigong/server
pm2 restart aishigong --update-env
```

## 5. 防火墙 / 安全组

- **放行**：TCP **80**
- **不必对公网开放**：**3780**（Node 只给本机 Nginx 连）

## 6. 浏览器访问

```
http://你的公网IP/
http://你的公网IP/portal.html
```

以后若有域名 + HTTPS，可另配 `deploy/nginx.aishigong.example.conf` 或 certbot。
