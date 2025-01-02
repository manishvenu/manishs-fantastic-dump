# Manish's Fantastic Dump README
Welcome to Manish's Fantastic Dump for NetCDF files!

## Description

This extension is super awesome because it calls ncdump -h when you click on NetCDF files and refreshes as they change (or are replaced). Dont ask me about how intensive it is cuz I don't know, but it's super light I think.

Thanks to ChatGPT for the code ofc!


## Features

- **Automatic ncdump Execution**: Automatically runs `ncdump -h` when you open NetCDF files (`.nc`).
- **Auto-launch ncview**: On left click, the option to open ncview pops up, which runs `ncview <file>` on the `.nc` file
- **Live Refresh**: Refreshes the output as the NetCDF files change or are replaced (Ncview does not).
- **Lightweight**: Designed to be not big.


## Demo (Doesn't show ncview connection)
[Watch the Demo Video!](https://www.youtube.com/watch?v=qupHdyMKcIg) <!-- Replace with the actual URL of our demo video -->

## Requirements/Limitations

- VS Code 1.50 and above (so like every version works)
- `ncdump` installed on your system
- `ncview` installed on your system

## Extension Settings

This extension does not require any specific settings.

## Known Issues

- Requires VS Code version 1.50 or above.

## Contributing

Contributions are welcome! Let me know! It's not serious!

## Acknowledgments

- Thanks to ChatGPT for writing the code.