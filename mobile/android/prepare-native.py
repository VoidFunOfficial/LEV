"""Downloads Node.js for Android and builds the app's native launcher (macOS or Linux, Android NDK 28)."""
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent
cache = root.parent / 'build/downloads'
out = root / 'app/build/generated/learnev/jniLibs'
notices = root / 'build/notices'
cache.mkdir(parents=True, exist_ok=True)
notices.mkdir(parents=True, exist_ok=True)
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or Path.home() / 'Library/Android/sdk')
ndk = Path(os.environ.get('ANDROID_NDK_HOME') or sdk / 'ndk/28.2.13676358')
shutil.copyfile(ndk / 'NOTICE', notices / 'Android-NDK.txt')
host = {'Darwin': 'darwin-x86_64', 'Linux': 'linux-x86_64'}[platform.system()]
llvm = ndk / 'toolchains/llvm/prebuilt' / host


def download(url, digest):
    target = cache / url.rsplit('/', 1)[-1]
    def valid(file):
        if not file.is_file(): return False
        h = hashlib.sha256()
        with file.open('rb') as f:
            for buf in iter(lambda: f.read(1024 * 1024), b''): h.update(buf)
        return h.hexdigest() == digest
    if not valid(target):
        part = target.with_name(target.name + '.part')
        subprocess.run(['curl', '-fLsS', '--retry', '2', url, '-o', str(part)], check=True)
        if not valid(part): raise ValueError(f'Checksum mismatch for {target.name}')
        part.replace(target)
    return target


release = 'https://github.com/fogtape/nodejs-mobile/releases/download/v24.22.1-0/'
node = download(release + 'nodejs-mobile-android-24.22.1-0.zip',
                'd6fd9f610fe5d81fede8f0d400c5a62723247725a19831835f15abf4f0604250')
builds = {'arm64-v8a': 'aarch64', 'x86_64': 'x86_64'}
for abi, arch in builds.items():
    libs = out / abi
    libs.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(node) as archive, archive.open(f'bin/{abi}/libnode.so') as f:
        with (libs / 'libnode.so').open('wb') as dest: shutil.copyfileobj(f, dest)
    triple = f'{arch}-linux-android'
    shutil.copyfile(llvm / f'sysroot/usr/lib/{triple}/libc++_shared.so', libs / 'libc++_shared.so')
    # Android only executes files from the native library directory, so the launcher ships as a .so.
    subprocess.run([llvm / f'bin/{triple}28-clang++', root / 'native/runner.cpp', '-fPIE', '-pie', '-Os',
                    '-Wl,-z,max-page-size=16384', '-Wl,-rpath,$ORIGIN', '-L' + str(libs), '-lnode',
                    '-o', libs / 'liblearnev.so'], check=True)
print('Prepared Android runtimes for ' + ', '.join(builds))
