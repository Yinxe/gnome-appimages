import GLib from 'gi://GLib';

export class AppImageManager {
    constructor(settings) {
        this._settings = settings;
        this._appImages = [];
        this._scanDirectories = [];
        this._loadData();
    }

    _loadData() {
        try {
            const dirsJson = this._settings.get_string('scan-directories');
            this._scanDirectories = JSON.parse(dirsJson);
        } catch (e) {
            this._scanDirectories = [{path: '~/applications', enabled: true}];
        }

        try {
            const dataJson = this._settings.get_string('appimages-data');
            this._appImages = JSON.parse(dataJson);
        } catch (e) {
            this._appImages = [];
        }
    }

    _saveData() {
        this._settings.set_string('scan-directories', JSON.stringify(this._scanDirectories));
        this._settings.set_string('appimages-data', JSON.stringify(this._appImages));
    }

    getScanDirectories() {
        return this._scanDirectories;
    }

    addScanDirectory(path) {
        this._scanDirectories.push({path, enabled: true});
        this._saveData();
    }

    removeScanDirectory(index) {
        this._scanDirectories.splice(index, 1);
        this._saveData();
    }

    toggleScanDirectory(index, enabled) {
        if (this._scanDirectories[index]) {
            this._scanDirectories[index].enabled = enabled;
            this._saveData();
        }
    }

    getAppImages() {
        return this._appImages.filter(app => app.enabled !== false);
    }

    getAllAppImages() {
        return this._appImages;
    }

    addOrUpdateAppImage(appData) {
        const existingIndex = this._appImages.findIndex(
            app => app.path === appData.path
        );

        if (existingIndex >= 0) {
            this._appImages[existingIndex] = {
                ...this._appImages[existingIndex],
                ...appData,
            };
        } else {
            this._appImages.push({
                id: GLib.uuid_string_random(),
                label: appData.name || appData.filename,
                command: appData.path,
                color: '',
                enabled: true,
                ...appData,
            });
        }

        this._saveData();
    }

    updateAppImage(id, updates) {
        const index = this._appImages.findIndex(app => app.id === id);
        if (index >= 0) {
            this._appImages[index] = {...this._appImages[index], ...updates};
            this._saveData();
            return true;
        }
        return false;
    }

    removeAppImage(id) {
        const index = this._appImages.findIndex(app => app.id === id);
        if (index >= 0) {
            this._appImages.splice(index, 1);
            this._saveData();
            return true;
        }
        return false;
    }

    syncWithScanResults(scanResults) {
        const existingPaths = new Set(this._appImages.map(app => app.path));
        const scannedPaths = new Set(scanResults.map(r => r.path));

        for (const result of scanResults) {
            if (!existingPaths.has(result.path)) {
                this._appImages.push({
                    id: GLib.uuid_string_random(),
                    path: result.path,
                    name: result.name,
                    filename: result.filename,
                    label: result.name,
                    command: result.path,
                    color: '',
                    enabled: true,
                });
            }
        }

        for (const app of this._appImages) {
            if (!scannedPaths.has(app.path)) {
                app.enabled = false;
            } else {
                app.enabled = true;
            }
        }

        this._saveData();
        this._settings.set_uint64('last-scan-time', Math.floor(Date.now() / 1000));
    }
}
