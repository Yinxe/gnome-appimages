import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {scanAllDirectories} from './lib/scanner.js';
import {AppImageManager} from './lib/manager.js';
import {AppImageEditDialog} from './lib/editDialog.js';

const AppImageIndicator = GObject.registerClass(
class AppImageIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('AppImage Manager'), false);

        this._extension = extension;
        this._settings = extension.getSettings();
        this._manager = new AppImageManager(this._settings);
        this._editDialog = null;
        this._searchText = '';

        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            this._manager._loadData();
            this._loadAppImages();

            if (key === 'last-scan-time' && settings.get_uint64(key) === 0) {
                this._refreshList();
            }
        });

        this._buildIcon();
        this._buildMenu();
        this._loadAppImages();
    }

    _buildIcon() {
        const icon = new St.Icon({
            icon_name: 'application-x-executable-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(icon);
    }

    _buildMenu() {
        this.menu.box.add_style_class_name('appimage-menu');

        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._searchEntry.grab_key_focus();
            }
        });

        this._searchEntry = new St.Entry({
            hint_text: _('搜索 AppImage...'),
            style_class: 'appimage-search-entry',
            style: 'min-width: 280px; margin: 8px; padding: 6px;',
            can_focus: true,
        });
        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._searchText = this._searchEntry.get_text().toLowerCase();
            this._refreshAppList();
        });

        const searchItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        searchItem.add_child(this._searchEntry);
        this.menu.addMenuItem(searchItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._appListContainer = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._appListContainer);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const toolsSection = new PopupMenu.PopupMenuSection();
        const refreshItem = new PopupMenu.PopupImageMenuItem(
            _('刷新列表'),
            'view-refresh-symbolic'
        );
        refreshItem.connect('activate', () => this._refreshList());
        toolsSection.addMenuItem(refreshItem);
        this.menu.addMenuItem(toolsSection);
    }

    _loadAppImages() {
        this._appImages = this._manager.getAppImages();
        this._refreshAppList();
    }

    _refreshAppList() {
        this._appListContainer.removeAll();

        const filtered = this._appImages.filter(app => {
            if (!this._searchText) return true;
            const label = (app.label || app.name || '').toLowerCase();
            return label.includes(this._searchText);
        });

        if (filtered.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(
                this._searchText ? _('未找到匹配的 AppImage') : _('暂无 AppImage'),
                {reactive: false}
            );
            emptyItem.setSensitive(false);
            this._appListContainer.addMenuItem(emptyItem);
            return;
        }

        for (const app of filtered) {
            const item = this._createAppItem(app);
            this._appListContainer.addMenuItem(item);
        }
    }

    _createAppItem(app) {
        const label = app.label || app.name || app.filename || _('未知应用');
        const color = app.color || '';

        const box = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;',
        });

        const icon = new St.Icon({
            icon_name: 'application-x-executable-symbolic',
            style_class: 'popup-menu-icon',
        });
        box.add_child(icon);

        const labelWidget = new St.Label({
            text: label,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        if (color) {
            labelWidget.set_style(`color: ${color};`);
        }
        box.add_child(labelWidget);

        const item = new PopupMenu.PopupBaseMenuItem();
        item.add_child(box);

        item.connect('activate', () => {
            this._launchApp(app);
        });

        item.connect('button-press-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                this._showEditDialog(app);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return item;
    }

    _launchApp(app) {
        const command = app.command || app.path;
        if (!command) return;

        try {
            const file = Gio.File.new_for_path(app.path);
            const info = file.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null);
            const mode = info.get_attribute_uint32('unix::mode');
            if ((mode & 0o111) === 0) {
                info.set_attribute_uint32('unix::mode', mode | 0o755);
                file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
            }
        } catch (e) {
            log(`[AppImages] 检查权限失败: ${e.message}`);
        }

        try {
            const proc = Gio.Subprocess.new(
                ['bash', '-c', command],
                Gio.SubprocessFlags.NONE
            );
            if (proc) {
                this.menu.close();
            }
        } catch (error) {
            Main.notify(_('启动失败'), error.message);
        }
    }

    _showEditDialog(app) {
        if (this._editDialog) {
            this._editDialog.destroy();
        }

        this._editDialog = new AppImageEditDialog(app, (updates) => {
            this._manager.updateAppImage(app.id, updates);
            this._loadAppImages();
        });

        this._editDialog.connect('destroy', () => {
            this._editDialog = null;
        });

        this._editDialog.open();
    }

    _refreshList() {
        const directories = this._manager.getScanDirectories();
        const results = scanAllDirectories(directories);
        this._manager.syncWithScanResults(results);
        this._loadAppImages();

        Main.notify(_('AppImage'), _('扫描完成，发现 %d 个应用').format(results.length));
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        if (this._editDialog) {
            this._editDialog.destroy();
            this._editDialog = null;
        }
        super.destroy();
    }
});

export default class AppImagesExtension extends Extension {
    enable() {
        this._indicator = new AppImageIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        const appImages = this._indicator._manager.getAppImages();
        if (appImages.length === 0) {
            this._indicator._refreshList();
        }
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
