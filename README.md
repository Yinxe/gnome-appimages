# AppImage Manager for GNOME Shell

A GNOME Shell extension to manage and quickly launch your AppImage applications from the top panel.

## Features

- **Scan Directories**: Configure one or more directories to scan for `.AppImage` files. Supports `~/` and environment variables like `$HOME`.
- **Top Panel Menu**: Click the panel icon to open a menu with search, app list, and refresh tools.
- **Search**: Filter your AppImage applications in real-time.
- **Launch**: Left-click an app to run it (automatically checks and fixes execute permissions).
- **Edit**: Right-click an app to edit its display name, launch command, and label color.
- **Settings UI**: GTK4/Adwaita preferences window with two tabs:
  - **Scan**: Manage scan directories (add, remove, enable/disable).
  - **Apps**: View and edit all discovered AppImages.

## Installation

### From Source

```bash
git clone git@github.com:Yinxe/gnome-appimages.git
cd gnome-appimages
cp -r appimages@yinxin ~/.local/share/gnome-shell/extensions/
cd ~/.local/share/gnome-shell/extensions/appimages@yinxin
glib-compile-schemas schemas/
gnome-extensions enable appimages@yinxin
```

Then restart GNOME Shell (log out and log back in on Wayland, or press `Alt+F2` and run `r` on X11).

### Requirements

- GNOME Shell 45+
- `glib-compile-schemas` (usually part of `libglib2.0-dev` or `glib2`)

## Usage

1. Click the **executable icon** in the top panel.
2. The menu opens with:
   - **Search bar**: Type to filter apps.
   - **App list**: All discovered AppImages.
   - **Refresh button**: Manually rescan directories.
3. **Left-click** an app to launch it.
4. **Right-click** an app to open the edit dialog.

## Configuration

Open the extension settings via GNOME Extensions app or:

```bash
gnome-extensions prefs appimages@yinxin
```

### Scan Tab
- Add directories (e.g., `~/applications`, `$HOME/apps`).
- Toggle directories on/off.
- Remove directories.
- Click **Scan Now** to trigger a manual scan.

### Apps Tab
- View all discovered AppImages.
- Click the **edit icon** to modify:
  - Display Name
  - Launch Command
  - Label Color (e.g., `#ff5733`)

## Default Settings

| Setting | Default Value |
|---------|--------------|
| Scan Directories | `[{"path":"~/applications","enabled":true}]` |

## File Structure

```
appimages@yinxin/
├── extension.js          # Main extension logic
├── prefs.js              # GTK4 preferences window
├── stylesheet.css        # Custom styling
├── metadata.json         # Extension metadata
├── lib/
│   ├── scanner.js        # Directory scanning module
│   ├── manager.js        # AppImage data manager
│   └── editDialog.js     # Edit dialog for apps
└── schemas/
    └── org.gnome.shell.extensions.appimages.gschema.xml
```

## Development

### Test Extension

```bash
# View logs
journalctl -f -o cat /usr/bin/gnome-shell

# Restart GNOME Shell (X11 only)
# Alt+F2 -> r -> Enter
```

### Contributing

Pull requests are welcome. Please ensure your code follows the existing style and includes Chinese comments as per project conventions.

## License

GPL-2.0-or-later
