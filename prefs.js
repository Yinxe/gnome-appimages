import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

class DirectoryRow extends Adw.ActionRow {
    static { GObject.registerClass(this); }

    constructor(directory, onToggle, onRemove) {
        super({ title: directory.path });
        this._directory = directory;

        const statusLabel = new Gtk.Label({
            label: directory.enabled ? _('已启用') : _('已禁用'),
            css_classes: directory.enabled ? ['accent'] : ['dim-label'],
            margin_end: 8,
        });
        this.add_suffix(statusLabel);

        const toggle = new Gtk.Switch({
            active: directory.enabled,
            valign: Gtk.Align.CENTER,
        });
        toggle.connect('state-set', (_widget, state) => {
            this._directory.enabled = state;
            statusLabel.set_label(state ? _('已启用') : _('已禁用'));
            statusLabel.set_css_classes(state ? ['accent'] : ['dim-label']);
            onToggle(this._directory);
            return false;
        });
        this.add_suffix(toggle);

        const removeButton = new Gtk.Button({
            icon_name: 'edit-delete-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: _('移除目录'),
        });
        removeButton.connect('clicked', () => onRemove(this._directory));
        this.add_suffix(removeButton);
    }
}

class AppImageRow extends Adw.ActionRow {
    static { GObject.registerClass(this); }

    constructor(app, onSave) {
        const label = app.label || app.name || app.filename || _('未命名');
        super({
            title: label,
            subtitle: app.path,
        });
        this._app = app;
        this._onSave = onSave;

        const editButton = new Gtk.Button({
            icon_name: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: _('编辑'),
        });
        editButton.connect('clicked', () => this._showEditDialog());
        this.add_suffix(editButton);
    }

    _showEditDialog() {
        const dialog = new Adw.MessageDialog({
            heading: _('编辑应用'),
            body: `${this._app.path}`,
            width_request: 500,
        });

        dialog.add_response('cancel', _('取消'));
        dialog.add_response('save', _('保存'));
        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
        dialog.set_default_response('save');

        const content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        const labelBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
        labelBox.append(new Gtk.Label({ label: _('显示名称'), halign: Gtk.Align.START }));
        const labelEntry = new Gtk.Entry({ text: this._app.label || '', placeholder_text: _('应用显示名称') });
        labelBox.append(labelEntry);
        content.append(labelBox);

        const commandBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
        commandBox.append(new Gtk.Label({ label: _('启动命令'), halign: Gtk.Align.START }));
        const commandEntry = new Gtk.Entry({ text: this._app.command || '', placeholder_text: _('启动命令或路径') });
        commandBox.append(commandEntry);
        content.append(commandBox);

        const colorBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
        colorBox.append(new Gtk.Label({ label: _('标签颜色 (可选)'), halign: Gtk.Align.START }));
        const colorEntry = new Gtk.Entry({ text: this._app.color || '', placeholder_text: _('如 #ff5733') });
        colorBox.append(colorEntry);
        content.append(colorBox);

        dialog.set_extra_child(content);

        dialog.connect('response', (_dlg, response) => {
            if (response === 'save') {
                this._onSave(this._app.id, {
                    label: labelEntry.get_text(),
                    command: commandEntry.get_text(),
                    color: colorEntry.get_text(),
                });
            }
            dialog.destroy();
        });

        dialog.present();
    }
}

export default class AppImagesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._buildScansPage(window);
        this._buildAppsPage(window);
    }

    _buildScansPage(window) {
        const page = new Adw.PreferencesPage({
            title: _('扫描'),
            icon_name: 'folder-open-symbolic',
        });
        window.add(page);

        const dirsGroup = new Adw.PreferencesGroup({
            title: _('扫描目录'),
            description: _('配置需要扫描 AppImage 的目录，支持 ~/ 和环境变量'),
        });
        page.add(dirsGroup);

        const directories = this._getDirectories();
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        dirsGroup.add(listBox);

        const refreshList = () => {
            while (listBox.get_first_child()) {
                listBox.remove(listBox.get_first_child());
            }

            if (directories.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: _('暂无扫描目录'),
                    subtitle: _('点击下方按钮添加目录'),
                });
                listBox.append(emptyRow);
                return;
            }

            for (const dir of directories) {
                const row = new DirectoryRow(
                    dir,
                    () => this._saveDirectories(directories),
                    (dirToRemove) => {
                        const index = directories.indexOf(dirToRemove);
                        if (index > -1) {
                            directories.splice(index, 1);
                            this._saveDirectories(directories);
                            refreshList();
                        }
                    }
                );
                listBox.append(row);
            }
        };

        refreshList();

        const addGroup = new Adw.PreferencesGroup({ title: _('添加目录') });
        page.add(addGroup);

        const addBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
        });
        addGroup.add(addBox);

        const entry = new Gtk.Entry({
            placeholder_text: _('如: ~/applications 或 $HOME/apps'),
            hexpand: true,
        });
        addBox.append(entry);

        const addButton = new Gtk.Button({
            label: _('添加'),
            css_classes: ['suggested-action'],
        });
        addBox.append(addButton);

        addButton.connect('clicked', () => {
            const path = entry.get_text().trim();
            if (path) {
                directories.push({ path, enabled: true });
                this._saveDirectories(directories);
                entry.set_text('');
                refreshList();
            }
        });

        entry.connect('activate', () => addButton.activate());

        const actionGroup = new Adw.PreferencesGroup({});
        page.add(actionGroup);

        const scanButton = new Gtk.Button({
            label: _('立即扫描所有目录'),
            css_classes: ['suggested-action', 'pill'],
            margin_top: 8,
            halign: Gtk.Align.CENTER,
        });
        scanButton.connect('clicked', () => {
            this._getSettings().set_uint64('last-scan-time', 0);
        });
        actionGroup.add(scanButton);
    }

    _buildAppsPage(window) {
        const page = new Adw.PreferencesPage({
            title: _('应用'),
            icon_name: 'application-x-executable-symbolic',
        });
        window.add(page);

        const appsGroup = new Adw.PreferencesGroup({
            title: _('已扫描的应用'),
            description: _('管理已发现的 AppImage 应用，可修改显示名称、启动命令和颜色'),
        });
        page.add(appsGroup);

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        appsGroup.add(listBox);

        const refreshApps = () => {
            while (listBox.get_first_child()) {
                listBox.remove(listBox.get_first_child());
            }

            const apps = this._getAppImages();

            if (apps.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: _('暂无应用'),
                    subtitle: _('请先扫描目录或添加应用'),
                });
                listBox.append(emptyRow);
                return;
            }

            for (const app of apps) {
                const row = new AppImageRow(app, (id, updates) => {
                    this._updateAppImage(id, updates);
                    refreshApps();
                });
                listBox.append(row);
            }
        };

        refreshApps();

        const infoGroup = new Adw.PreferencesGroup({});
        page.add(infoGroup);

        const infoLabel = new Gtk.Label({
            label: _('提示：修改保存后会自动同步到扩展菜单'),
            css_classes: ['dim-label', 'caption'],
            margin_top: 8,
        });
        infoGroup.add(infoLabel);
    }

    _getSettings() {
        if (!this._settings) {
            this._settings = this.getSettings();
        }
        return this._settings;
    }

    _getDirectories() {
        try {
            const json = this._getSettings().get_string('scan-directories');
            return JSON.parse(json);
        } catch (e) {
            return [{ path: '~/applications', enabled: true }];
        }
    }

    _saveDirectories(directories) {
        this._getSettings().set_string('scan-directories', JSON.stringify(directories));
    }

    _getAppImages() {
        try {
            const json = this._getSettings().get_string('appimages-data');
            return JSON.parse(json);
        } catch (e) {
            return [];
        }
    }

    _updateAppImage(id, updates) {
        try {
            const apps = this._getAppImages();
            const index = apps.findIndex(app => app.id === id);
            if (index >= 0) {
                apps[index] = { ...apps[index], ...updates };
                this._getSettings().set_string('appimages-data', JSON.stringify(apps));
            }
        } catch (e) {
            log(`[AppImages] 更新应用失败: ${e.message}`);
        }
    }
}
