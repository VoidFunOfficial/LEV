package app.learnev.android;

import android.content.Context;
import android.util.Log;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class WorkspaceRuntime implements AutoCloseable {
    interface Listener {
        void ready(int port, String token);
        void failed();
    }
    private final Context context;
    private volatile boolean closed;
    private Process process;

    WorkspaceRuntime(Context context) { this.context = context.getApplicationContext(); }

    void start(Listener listener) {
        new Thread(() -> {
            try { run(listener); }
            catch (Exception e) {
                Log.e("LearnEV", "Workspace stopped", e);
                if (!closed) listener.failed();
            } finally { close(); }
        }, "learnev-workspace").start();
    }

    private File unpack() throws IOException {
        String version;
        try (BufferedReader in = new BufferedReader(new InputStreamReader(context.getAssets().open("runtime.id")))) {
            version = in.readLine();
        }
        if (version == null || !version.matches("[0-9a-f]{64}")) throw new IOException("Invalid runtime version");
        Path installs = context.getNoBackupFilesDir().toPath().resolve("runtimes");
        Files.createDirectories(installs);
        Path runtime = installs.resolve("runtime-" + version);
        if (hasRuntimeFiles(runtime)) return runtime.toFile();
        Path stage = Files.createTempDirectory(installs, "unpack-");
        try {
            try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(context.getAssets().open("runtime.zip")))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (closed) throw new InterruptedIOException();
                    Path target = stage.resolve(entry.getName()).normalize();
                    if (!target.startsWith(stage)) throw new IOException("Invalid resource path");
                    if (entry.isDirectory()) Files.createDirectories(target);
                    else {
                        Files.createDirectories(target.getParent());
                        Files.copy(zip, target);
                    }
                }
            }
            if (!hasRuntimeFiles(stage)) throw new IOException("Incomplete runtime archive");
            if (Files.exists(runtime)) removeTree(runtime.toFile());
            Files.move(stage, runtime, StandardCopyOption.ATOMIC_MOVE);
        } finally { removeTree(stage.toFile()); }
        File[] old = installs.toFile().listFiles((dir, name) -> name.startsWith("runtime-") && !name.equals(runtime.getFileName().toString()));
        if (old != null) for (File file : old) removeTree(file);
        File[] legacy = context.getCodeCacheDir().listFiles((dir, name) -> name.matches("runtime-[0-9a-f]{64}"));
        if (legacy != null) for (File file : legacy) removeTree(file);
        return runtime.toFile();
    }

    private static boolean hasRuntimeFiles(Path dir) {
        return Files.isRegularFile(dir.resolve("server.mjs")) && Files.isRegularFile(dir.resolve("www/index.html"))
                && Files.isRegularFile(dir.resolve("node_modules/@earendil-works/pi-coding-agent/dist/index.js"));
    }

    private static void removeTree(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) removeTree(child);
        file.delete();
    }

    private void run(Listener listener) throws Exception {
        File runtime;
        synchronized (WorkspaceRuntime.class) { runtime = unpack(); }
        File work = new File(context.getFilesDir(), "learnev");
        Files.createDirectories(work.toPath());
        String libs = context.getApplicationInfo().nativeLibraryDir;
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        StringBuilder token = new StringBuilder(64);
        for (byte b : random) token.append(String.format(Locale.ROOT, "%02x", b & 255));
        ProcessBuilder builder = new ProcessBuilder(libs + "/liblearnev.so", new File(runtime, "server.mjs").getPath())
                .directory(work).redirectErrorStream(true);
        Map<String, String> env = builder.environment();
        env.put("LD_LIBRARY_PATH", libs);
        env.put("TMPDIR", context.getCacheDir().getAbsolutePath());
        env.put("NODE_ENV", "production");
        env.put("PI_CODING_AGENT_DIR", new File(context.getFilesDir(), "pi").getPath());
        env.put("LEARNEV_DATA_DIR", new File(context.getFilesDir(), "state").getPath());
        env.put("LEARNEV_PORT", Integer.toString(context.getSharedPreferences("runtime", 0).getInt("port", 0)));
        env.put("LEARNEV_SESSION", token.toString());
        Process child;
        synchronized (this) {
            if (closed) return;
            process = child = builder.start();
        }
        boolean ready = false;
        try (BufferedReader lines = new BufferedReader(new InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = lines.readLine()) != null) {
                if (!ready && line.matches("LEARNEV_READY [0-9]{1,5}")) {
                    int port = Integer.parseInt(line.substring("LEARNEV_READY ".length()));
                    context.getSharedPreferences("runtime", 0).edit().putInt("port", port).apply();
                    ready = true;
                    if (!closed) listener.ready(port, token.toString());
                } else if (!ready) Log.w("LearnEV", line);
            }
        }
        if (!closed) throw new IOException("Runtime exited with status " + child.waitFor());
    }

    public synchronized void close() {
        closed = true;
        if (process != null) { process.destroy(); process = null; }
    }
}
