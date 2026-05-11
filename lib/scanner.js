import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function resolvePath(path) {
    if (!path) return '';

    if (path.startsWith('~/')) {
        path = GLib.get_home_dir() + path.substring(1);
    }

    path = path.replace(/\$\w+/g, (match) => {
        const varName = match.substring(1);
        const value = GLib.getenv(varName);
        return value !== null ? value : match;
    });

    return path;
}

let _seenExecutablePaths = null;

function scanDirectory(dirPath) {
    const results = [];

    try {
        const resolvedPath = resolvePath(dirPath);
        const dir = Gio.File.new_for_path(resolvedPath);

        if (!dir.query_exists(null)) {
            log(`[AppImages] 目录不存在: ${resolvedPath}`);
            return results;
        }

        const fileType = dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
        if (fileType !== Gio.FileType.DIRECTORY) {
            log(`[AppImages] 不是目录: ${resolvedPath}`);
            return results;
        }

        const enumerator = dir.enumerate_children(
            'standard::name,standard::type,standard::display-name,unix::mode',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            const childFile = dir.get_child(name);
            const childPath = childFile.get_path();

            if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                const subResults = scanDirectory(childPath);
                results.push(...subResults);
            } else if (name.toLowerCase().endsWith('.appimage')) {
                results.push({
                    path: childPath,
                    name: name.replace(/\.appimage$/i, ''),
                    filename: name,
                    type: 'appimage',
                });
            } else if (fileInfo.get_file_type() === Gio.FileType.REGULAR) {
                const mode = fileInfo.get_attribute_uint32('unix::mode');
                const isExecutable = (mode & 0o111) !== 0;
                if (isExecutable) {
                    if (_seenExecutablePaths) {
                        _seenExecutablePaths.add(childPath);
                    }
                    results.push({
                        path: childPath,
                        name: name,
                        filename: name,
                        type: 'executable',
                    });
                }
            }
        }

        enumerator.close(null);
    } catch (error) {
        log(`[AppImages] 扫描目录出错 ${dirPath}: ${error.message}`);
    }

    return results;
}

export function scanAllDirectories(directories) {
    const allResults = [];
    const seenPaths = new Set();
    _seenExecutablePaths = new Set();

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

    _seenExecutablePaths = null;

    const appimageCount = allResults.filter(r => r.type === 'appimage').length;
    const execCount = allResults.filter(r => r.type === 'executable').length;
    log(`[AppImages] 扫描完成，发现 ${appimageCount} 个 AppImage, ${execCount} 个可执行文件`);
    return allResults;
}
