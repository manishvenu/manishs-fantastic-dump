# Manish's Fantastic Dump

The fastest way to peek inside a NetCDF file without leaving VSCode.

## Description

Opens `.nc` and `.nc4` files inline using `ncdump -h` . Useful if you're anyone who spends too much time alt-tabbing to a terminal just to check a variable name or unit.

## Features

- **File Summary**: Format (NetCDF-3/4), variable count, dimension count, and file size at a glance before you read anything.
- **Automatic ncdump Execution**: Runs `ncdump -h` when you open `.nc` or `.nc4` files.
- **Clickable Variables**: Click any variable name to open a side panel with its full data (paginated for large variables).
- **Searchable Output**: Search the `ncdump` output with Ctrl/Cmd+F.
- **Auto-launch ncview**: Right-click a file in the Explorer → "Open in Ncview".
- **Live Refresh**: Refreshes automatically when the file changes on disk.
- **Lightweight**: Shells out to your system `ncdump` — no bundled binaries, no dependencies.

## Demo (Doesn't show ncview connection)
[Watch the Demo Video!](https://www.youtube.com/watch?v=qupHdyMKcIg)

## Requirements

- VS Code 1.50+
- `ncdump` on your PATH (e.g. `conda install netcdf4` or `brew install netcdf`)
- `ncview` on your PATH if you want that integration (optional)

## Extension Settings

No settings required.

## Contributing

Contributions welcome! It's not that serious but open an issue or PR.
