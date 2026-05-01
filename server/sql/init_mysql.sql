-- =============================================================================
-- AI 施工演示站 · MySQL 初始化（建库 + 表 + 演示数据）
-- 基础库表与演示项目/任务；用户、成员、消息等由 Node 首次启动时自动补全（ensureMysqlSchema）。
-- 演示数据可安全重复执行（幂等）。
--
-- 用法（在服务器上，先改数据库名如需要）：
--   mysql -h 127.0.0.1 -u 你的用户 -p < init_mysql.sql
--
-- 若库已存在、只想补表/数据，可注释掉下面 CREATE DATABASE，仅保留 USE。
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 按需修改库名；与 .env 中 MYSQL_DATABASE 保持一致
CREATE DATABASE IF NOT EXISTS construction_demo
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE construction_demo;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT '进行中',
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  cover_image_url VARCHAR(512) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(512) NOT NULL,
  assignee_role VARCHAR(64) DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT '待派发',
  priority VARCHAR(16) DEFAULT 'P1',
  due_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('chat','image') NOT NULL,
  prompt TEXT NOT NULL,
  result_summary VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------- 演示数据（按 code 幂等插入项目） ----------------------------
INSERT IGNORE INTO projects (code, name, client_name, status, progress_pct, cover_image_url) VALUES
('PRJ-DEMO-001', '样板工程 · 滨江精装', '演示客户 A', '进行中', 62, 'https://picsum.photos/seed/aishi-site1/1200/675'),
('PRJ-DEMO-002', '办公楼改造试点', '演示总包 B', '待验收', 94, 'https://picsum.photos/seed/aishi-site2/1200/675');

UPDATE projects SET cover_image_url = 'https://picsum.photos/seed/aishi-site1/1200/675'
 WHERE code = 'PRJ-DEMO-001' AND (cover_image_url IS NULL OR TRIM(cover_image_url) = '');
UPDATE projects SET cover_image_url = 'https://picsum.photos/seed/aishi-site2/1200/675'
 WHERE code = 'PRJ-DEMO-002' AND (cover_image_url IS NULL OR TRIM(cover_image_url) = '');

-- 任务：同一项目 + 标题不存在时才插入
INSERT INTO tasks (project_id, title, assignee_role, status, priority, due_date)
SELECT p.id, '卫生间防水复检', '施工经理', '待验收', 'P0', '2026-05-08'
FROM projects p WHERE p.code = 'PRJ-DEMO-001'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.title = '卫生间防水复检');

INSERT INTO tasks (project_id, title, assignee_role, status, priority, due_date)
SELECT p.id, '木工收口节点拍照上传', '工人', '进行中', 'P1', '2026-05-06'
FROM projects p WHERE p.code = 'PRJ-DEMO-001'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.title = '木工收口节点拍照上传');

INSERT INTO tasks (project_id, title, assignee_role, status, priority, due_date)
SELECT p.id, '幕墙色差 AI 比对', '管理员', '整改中', 'P0', '2026-05-10'
FROM projects p WHERE p.code = 'PRJ-DEMO-002'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.title = '幕墙色差 AI 比对');

-- 完成
SELECT 'OK: construction_demo 已就绪' AS message;
