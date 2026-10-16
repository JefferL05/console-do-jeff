import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), mobile = join(root, 'mobile');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(join(sdk, 'platforms/android-36'))) throw new Error('Defina ANDROID_HOME com Android SDK Platform 36 e Build Tools 36.0.0 instalados.');
if (!process.env.JAVA_HOME || !existsSync(join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) throw new Error('Defina JAVA_HOME para um JDK 21.');
const java = spawnSync(join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), ['-version'], { encoding: 'utf8' });
if (!/version "(?:21|2[2-9])\./.test(java.stderr + java.stdout)) throw new Error('A compilação requer JDK 21 ou superior compatível.');
function run(command, args, cwd = root) { const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, PATH: join(process.env.JAVA_HOME, 'bin') + (process.platform === 'win32' ? ';' : ':') + process.env.PATH } }); if (result.error || result.status !== 0) throw new Error(`Falha em ${command}: ${result.error?.message || result.status}`); }
run(process.execPath, [join(root, 'scripts/package-android.mjs')]);
run(process.execPath, [join(root, 'scripts/android-branding.mjs')]);
run(process.execPath, [join(mobile, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'], mobile);
await writeFile(join(mobile, 'android/local.properties'), `sdk.dir=${sdk.replaceAll('\\', '/')}\n`);
if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon --console=plain'], join(mobile, 'android'));
else run('./gradlew', ['assembleDebug', '--no-daemon', '--console=plain'], join(mobile, 'android'));
const source = join(mobile, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(source)) throw new Error('Gradle terminou sem gerar app-debug.apk.');
const pkg = JSON.parse(await readFile(join(mobile, 'package.json'), 'utf8'));
const artifacts = join(root, 'artifacts/android'); await mkdir(artifacts, { recursive: true });
const destination = join(artifacts, `ouro-do-subsolo-${pkg.version}-debug.apk`); await copyFile(source, destination);
const bytes = await readFile(destination), hash = createHash('sha256').update(bytes).digest('hex');
await writeFile(destination + '.sha256', `${hash}  ouro-do-subsolo-${pkg.version}-debug.apk\n`);
await writeFile(join(artifacts, 'build-info.json'), JSON.stringify({ appId: 'com.jefferl05.ourodosubsolo', version: pkg.version, versionCode: 110, signing: 'debug', apk: destination, bytes: bytes.length, sha256: hash, node: process.version, java: (java.stderr + java.stdout).trim(), capacitor: '8.5.3', compileSdk: 36, targetSdk: 36, minSdk: 24 }, null, 2));
console.log(`APK GERADO: ${destination}\nTamanho: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB\nSHA-256: ${hash}`);
