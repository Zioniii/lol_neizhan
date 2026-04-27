# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['scripts\\sync_tray.py'],
    pathex=[],
    binaries=[],
    datas=[('backend/lcu', 'backend/lcu'), ('backend/__init__.py', 'backend')],
    hiddenimports=['httpx', 'psutil', 'pystray', 'PIL', 'tkinter'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='LOL-Sync-Agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
