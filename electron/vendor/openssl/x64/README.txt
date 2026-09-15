Place the Windows openssl.exe binary and any required DLLs in this directory.
It will be bundled into the production installer via extraResources in package.json.
This ensures ZATCA Phase 2 EC key generation works out of the box on clean Windows machines.
