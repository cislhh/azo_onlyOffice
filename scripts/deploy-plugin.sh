#!/bin/bash

# OnlyOffice 插件部署脚本
# 用途：一键复制插件到Docker容器并重启

set -e  # 遇到错误立即退出

# 配置变量
PLUGIN_NAME="empower-toolbar"
PLUGIN_GUID="{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF001}"
CONTAINER_NAME="${ONLYOFFICE_CONTAINER_NAME:-$(docker ps --filter "ancestor=onlyoffice/documentserver" --format "{{.Names}}" | head -1)}"
PLUGIN_SOURCE_PATH="$(dirname "$0")/../public/onlyoffice-plugins/${PLUGIN_NAME}"
PLUGIN_TARGET_PATH="/var/www/onlyoffice/documentserver/sdkjs-plugins/${PLUGIN_GUID}"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OnlyOffice 插件部署工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 检查插件源目录是否存在
if [ ! -d "$PLUGIN_SOURCE_PATH" ]; then
    echo -e "${YELLOW}❌ 错误：插件源目录不存在${NC}"
    echo "路径: $PLUGIN_SOURCE_PATH"
    exit 1
fi

echo -e "${GREEN}✓ 步骤 1/4: 源目录检查通过${NC}"

# 2. 检查容器是否存在且运行
if [ -z "$CONTAINER_NAME" ]; then
    echo -e "${YELLOW}❌ 错误：未找到 onlyoffice/documentserver 容器${NC}"
    echo "可设置环境变量 ONLYOFFICE_CONTAINER_NAME 后重试"
    exit 1
fi

if ! docker inspect "$CONTAINER_NAME" &> /dev/null; then
    echo -e "${YELLOW}❌ 错误：容器不存在${NC}"
    echo "容器名: $CONTAINER_NAME"
    exit 1
fi

CONTAINER_STATUS=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Status}}')
if [ "$CONTAINER_STATUS" != "running" ]; then
    echo -e "${YELLOW}⚠️  警告：容器未运行（状态: $CONTAINER_STATUS）${NC}"
    read -p "是否要启动容器？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker start "$CONTAINER_NAME"
        echo -e "${GREEN}✓ 容器已启动${NC}"
    else
        echo "操作已取消"
        exit 1
    fi
fi

echo -e "${GREEN}✓ 步骤 2/4: 容器状态正常${NC}"

# 3. 清理旧插件并复制新插件（避免目录嵌套导致旧文件残留）
echo -e "${BLUE}🧹 正在清理旧插件目录...${NC}"
docker exec "$CONTAINER_NAME" rm -rf "$PLUGIN_TARGET_PATH"
docker exec "$CONTAINER_NAME" mkdir -p "$PLUGIN_TARGET_PATH"

echo -e "${BLUE}📦 正在复制插件到容器...${NC}"
docker cp "$PLUGIN_SOURCE_PATH/." "$CONTAINER_NAME:$PLUGIN_TARGET_PATH/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 步骤 3/4: 插件复制成功${NC}"
else
    echo -e "${YELLOW}❌ 错误：插件复制失败${NC}"
    exit 1
fi

# 4. 重启容器
echo -e "${BLUE}🔄 正在重启容器...${NC}"
docker restart "$CONTAINER_NAME" > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 步骤 4/4: 容器重启成功${NC}"
else
    echo -e "${YELLOW}❌ 错误：容器重启失败${NC}"
    exit 1
fi

echo -e "${BLUE}🧽 正在清理插件归档缓存（若存在）...${NC}"
docker exec "$CONTAINER_NAME" sh -c "find /var/www/onlyoffice/documentserver/sdkjs-plugins -maxdepth 3 -type f \\( -name '*.plugin' -o -name '*.zip' \\) -delete" || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "插件信息:"
echo "  - 插件名称: $PLUGIN_NAME"
echo "  - 插件 GUID: $PLUGIN_GUID"
echo "  - 容器名称: $CONTAINER_NAME"
echo "  - 目标路径: $PLUGIN_TARGET_PATH"
echo ""
echo "提示: 如需查看容器日志，运行:"
echo "  docker logs -f $CONTAINER_NAME"
