import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const AppImageEditDialog = GObject.registerClass(
class AppImageEditDialog extends ModalDialog.ModalDialog {
    _init(appData, onSave) {
        super._init({
            styleClass: 'appimage-edit-dialog',
            destroyOnClose: false,
        });

        this._appData = appData;
        this._onSave = onSave;
        this._buildLayout();
    }

    _buildLayout() {
        const contentBox = new St.BoxLayout({
            vertical: true,
            styleClass: 'appimage-edit-content',
            style: 'spacing: 12px; padding: 24px; min-width: 400px;',
        });

        contentBox.add_child(this._createLabel('应用名称:'));
        this._labelEntry = this._createEntry(this._appData.label || '');
        contentBox.add_child(this._labelEntry);

        contentBox.add_child(this._createLabel('启动命令:'));
        this._commandEntry = this._createEntry(this._appData.command || '');
        contentBox.add_child(this._commandEntry);

        contentBox.add_child(this._createLabel('标签颜色 (如 #ff0000):'));
        this._colorEntry = this._createEntry(this._appData.color || '');
        contentBox.add_child(this._colorEntry);

        contentBox.add_child(this._createLabel(`文件路径: ${this._appData.path}`));

        this.contentLayout.add_child(contentBox);

        this.setButtons([
            {
                label: '取消',
                action: () => this.close(),
                key: Clutter.KEY_Escape,
            },
            {
                label: '保存',
                action: () => this._save(),
                isDefault: true,
            },
        ]);
    }

    _createLabel(text) {
        return new St.Label({
            text,
            styleClass: 'appimage-edit-label',
            style: 'font-weight: bold; margin-top: 8px;',
        });
    }

    _createEntry(text) {
        const entry = new St.Entry({
            text: text || '',
            styleClass: 'appimage-edit-entry',
            style: 'min-width: 350px; padding: 8px;',
            can_focus: true,
        });
        return entry;
    }

    _save() {
        const updates = {
            label: this._labelEntry.get_text(),
            command: this._commandEntry.get_text(),
            color: this._colorEntry.get_text(),
        };

        if (this._onSave) {
            this._onSave(updates);
        }

        this.close();
    }

    open() {
        super.open(global.get_current_time());
    }
});
