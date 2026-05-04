import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

class DirectoryRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(directory, onToggle, onRemove) {
        super({
            title: directory.path,
            subtitle: directory.enabled ? _('已启用') : _('已禁用'),
        });

        this._directory = directory;

        const toggle = new Gtk.Switch({
            active: directory.enabled,
            valign: Gtk.Align.CENTER,
        });
        toggle.connect('state-set', (_widget, state) => {
            this._directory.enabled = state;
            this.set_subtitle(state ? _('已启用') : _('已禁用'));
            onToggle(this._directory);
            return false;
        });
        this.add_suffix(toggle);

        const removeButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        removeButton.connect('clicked', () => onRemove(this._directory));
        this.add_suffix(removeButton);
    }
}

export default class AppImagesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: _('AppImage 管理'),
            icon_name: 'application-x-executable-symbolic',
        });
        window.add(page);

        const scanGroup = new Adw.PreferencesGroup({
            title: _('扫描目录'),
            description: _('配置需要扫描 AppImage 的目录，支持 ~/ 和环境变量'),
        });
        page.add(scanGroup);

        const directories = this._getDirectories();
        this._directoryRows = [];

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        scanGroup.add(listBox);

        const refreshList = () => {
            while (listBox.get_first_child()) {
                listBox.remove(listBox.get_first_child());
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

        const addRow = new Adw.ActionRow({
            title: _('添加新目录'),
        });

        const entry = new Gtk.Entry({
            placeholder_text: _('如: ~/applications 或 $HOME/apps'),
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        addRow.add_suffix(entry);

        const addButton = new Gtk.Button({
            label: _('添加'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        addButton.connect('clicked', () => {
            const path = entry.get_text().trim();
            if (path) {
                directories.push({path, enabled: true});
                this._saveDirectories(directories);
                entry.set_text('');
                refreshList();
            }
        });
        addRow.add_suffix(addButton);

        scanGroup.add(addRow);

        const actionsGroup = new Adw.PreferencesGroup({
            title: _('操作'),
        });
        page.add(actionsGroup);

        const scanButton = new Gtk.Button({
            label: _('立即扫描'),
            css_classes: ['suggested-action', 'pill'],
            margin_top: 12,
            margin_bottom: 12,
        });
        scanButton.connect('clicked', () => {
            this._settings.set_uint64('last-scan-time', 0);
        });
        actionsGroup.add(scanButton);
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
            return [{path: '~/applications', enabled: true}];
        }
    }

    _saveDirectories(directories) {
        this._getSettings().set_string('scan-directories', JSON.stringify(directories));
    }
}
