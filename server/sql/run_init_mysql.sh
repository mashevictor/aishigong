#!/usr/bin/env bash
# 在 Linux 服务器上执行示例（按实际修改主机、用户、脚本路径）：
#   chmod +x run_init_mysql.sh
#   export MYSQL_PWD='你的密码'   # 可选，避免交互；注意安全
#   ./run_init_mysql.sh
#
# 或一行：
#   mysql -h 127.0.0.1 -u root -p < "$(dirname "$0")/init_mysql.sql"

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_USER="${MYSQL_USER:-root}"
SQL_FILE="${DIR}/init_mysql.sql"

echo "执行: mysql -h ${MYSQL_HOST} -u ${MYSQL_USER} -p < init_mysql.sql"
mysql -h "${MYSQL_HOST}" -u "${MYSQL_USER}" -p < "${SQL_FILE}"
echo "完成。"
