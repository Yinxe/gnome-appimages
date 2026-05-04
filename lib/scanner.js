/** scanner.js
 * AppImage 扫描模块
 * 负责扫描配置的目录，查找 .AppImage 文件
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * 解析路径，支持 ~ 和环境变量
 * @param {string} path - 原始路径
 * @returns {string} - 解析后的绝对路径
 */
export function resolvePath(path) {
    if (!path) return '';

    // 解析 ~/ 为当前用户主目录
    if (path.startsWith('~/')) {
        path = GLib.get_home_dir() + path.substring(1);
    }

    // 解析环境变量，如 $HOME, $USER 等
    path = path.replace(/\$\w+/g, (match) => {
        const varName = match.substring(1);
        const value = GLib.getenv(varName);
        return value !== null ? value : match;
    });

    return path;
}

/**
 * 扫描单个目录中的 .AppImage 文件
 * @param {string} dirPath - 目录路径
 * @returns {Array} - 找到的 AppImage 文件列表 [{path, name, filename}]
 */
function scanDirectory(dirPath) {
    const results = [];

    try {
        const resolvedPath = resolvePath(dirPath);
        const dir = Gio.File.new_for_path(resolvedPath);

        // 检查目录是否存在
        if (!dir.query_exists(null)) {
            log(`[AppImages] 目录不存在: ${resolvedPath}`);
            return results;
        }

        const fileType = dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
        if (fileType !== Gio.FileType.DIRECTORY) {
            log(`[AppImages] 不是目录: ${resolvedPath}`);
            return results;
        }

        // 枚举目录内容
        const enumerator = dir.enumerate_children(
            'standard::name,standard::type,standard::display-name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            const childFile = dir.get_child(name);
            const childPath = childFile.get_path();

            if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                // 递归扫描子目录
                const subResults = scanDirectory(childPath);
                results.push(...subResults);
            } else if (name.toLowerCase().endsWith('.appimage')) {
                // 发现 AppImage 文件
                results.push({
                    path: childPath,
                    name: name.replace(/\.appimage$/i, ''),
                    filename: name,
                });
            }
        }

        enumerator.close(null);
    } catch (error) {
        log(`[AppImages] 扫描目录出错 ${dirPath}: ${error.message}`);
    }

    return results;
}

/**
 * 扫描所有启用的目录
 * @param {Array} directories - 目录配置列表 [{path, enabled}]
 * @returns {Array} - 所有找到的 AppImage 文件
 */
export function scanAllDirectories(directories) {
    const allResults = [];
    const seenPaths = new Set();

    for (const dirConfig of directories) {
        if (!dirConfig.enabled) continue;

        const results = scanDirectory(dirConfig.path);
        for (const result of results) {
            if (!seenPaths.has(result.path)) {
                seenPaths.add(result.path);
                allResults.push(result);
            }
        }
    }

    log(`[AppImages] 扫描完成，发现 ${allResults.length} 个 AppImage`);
    return allResults;
}

/**
 * 尝试从 AppImage 提取图标
 * 实际实现中可能需要使用 appimage 的 --appimage-extract 功能
 * @param {string} appimagePath - AppImage 路径
 * @returns {string|null} - 图标路径或 null
 */
export function extractAppImageIcon(appimagePath) {
    // 简化实现，返回 null，后续可以扩展
    return null;
}
