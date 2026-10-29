# Manish's Fantastic Dump

The fastest way to peek inside a NetCDF file without leaving VSCode.

## Description

Opens `.nc`, `.nc3`, `.nc4` and `.netcdf` files inline using `ncdump -h`. Useful if you're anyone who spends too much time alt-tabbing to a terminal just to check a variable name or unit.

## Features

- **File Summary**: Format (NetCDF-3/4), variable count, dimension count, and file size at a glance before you read anything.
- **Automatic ncdump Execution**: Runs `ncdump -h` when you open `.nc` or `.nc4` files.
- **Clickable Variables**: Click any variable name, including variables inside NetCDF-4 groups, to open a side panel with its full data (paginated for large variables).
- **Attribute Tooltips**: Hover a variable name to see its declaration and attributes.
- **Searchable Output**: Search the `ncdump` output with Ctrl/Cmd+F (Enter / Shift+Enter to step through matches, Esc to close).
- **Auto-launch ncview**: Right-click a file in the Explorer → "Open in Ncview".
- **Live Refresh**: Refreshes automatically when the file changes on disk, keeping your scroll position and search.
- **Lightweight**: Shells out to your system `ncdump` — no bundled binaries, no dependencies.

## Demo (Doesn't show ncview connection)
[Watch the Demo Video!](https://www.youtube.com/watch?v=qupHdyMKcIg)

## Requirements

- VS Code 1.50+
- `ncdump` (e.g. `conda install netcdf4` or `brew install netcdf`), on your PATH or set in the settings below
- `ncview` if you want that integration (optional)

## Other File Types

`.cdf`, `.h5`, `.hdf5` and `.he5` files can also be opened with this viewer, as long as your `ncdump` can read them. Right-click the file's tab → **Reopen Editor With...** → **NetCDF Viewer (ncdump)**. These are not opened with it by default because other tools use the same extensions.

## Extension Settings

- `manishsfantasticdump.ncdumpPath` (default `ncdump`): full path to `ncdump`, if VS Code can't find it. This is common with conda installs when VS Code is opened from the Dock. `~` is allowed, e.g. `~/miniconda3/bin/ncdump`.
- `manishsfantasticdump.ncviewPath` (default `ncview`): full path to `ncview` for **Open in Ncview**.

## Contributing

Contributions welcome! It's not that serious but open an issue or PR.
