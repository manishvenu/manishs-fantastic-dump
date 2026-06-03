# Change Log

All notable changes to the "manishsfantasticdump" extension will be documented in this file.

### [0.0.18] - 2026-06-02
- Fix missing activation event for `.nc4` files
- Show error message inside the webview when ncdump fails (instead of staying on "Loading...")
- Lock webview local resource roots to extension `src/` directory

### [0.0.17] - 2026-06-02
- Add file summary card showing format (NetCDF-3/4), variable count, dimension count, and file size

### [0.0.16] - 2026-06-02
- Extract inline variable viewer HTML into VariableViewer.html template
- Add pagination to variable viewer (500 lines per page, keyboard arrow navigation)
- Fix variable viewer Content Security Policy: remove `unsafe-inline` by moving inline script and styles to external files
- Add loading indicator while ncdump runs on large files
- Fix search bar showing on open (now always starts hidden until Ctrl/Cmd+F)

### [0.0.15] - 2025-11-03
- Add .nc4 file format (hopefully)

### [0.0.13 - 0.0.14] - 2025-07-07
- Update keywords

### [0.0.12] - 2025-02-18
- Bug Fix

### [0.0.11] - 2025-02-17
- Added Search (Type Cntrl/Command-F)

### [0.0.10] - 2025-02-17
- Background Code Update

### [0.0.9] - 2024-12-26
- Open Ncview in a new terminal window on left click.

### [0.0.8] - 2024-12-26
- Large variable loading (Only 500 lines)

### [0.0.5 - 0.0.7] - 2024-12-11
- Add small variable loading


### [0.0.1 - 0.0.4] - 2024-11-03
- A variety of initial release things.