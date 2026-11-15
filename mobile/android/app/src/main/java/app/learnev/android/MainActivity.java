package app.learnev.android;

import android.app.Activity;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private FrameLayout root;
    private WebView web;
    private WorkspaceRuntime runtime;
    private String origin;
    private ValueCallback<Uri[]> fileResult;
    private static final int PICK_FILES = 1;

    @Override public void onCreate(Bundle state) {
        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        setTheme(dark ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(dark ? Color.rgb(27,27,27) : Color.WHITE);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(b.left, b.top, b.right, b.bottom);
                return insets;
            });
            WindowInsetsController bars = getWindow().getInsetsController();
            int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (bars != null) bars.setSystemBarsAppearance(dark ? 0 : flags, flags);
        }
        start();
    }

    private void start() {
        root.removeAllViews();
        TextView status = new TextView(this);
        status.setText("正在打开 LearnEV…");
        status.setGravity(Gravity.CENTER);
        root.addView(status);
        WorkspaceRuntime attempt = new WorkspaceRuntime(this);
        runtime = attempt;
        attempt.start(new WorkspaceRuntime.Listener() {
            public void ready(int port, String token) { runOnUiThread(() -> {
                if (runtime == attempt && !isFinishing()) open(port, token);
            }); }
            public void failed() { runOnUiThread(() -> {
                if (runtime != attempt || isFinishing()) return;
                disposeWeb();
                root.removeAllViews();
                Button retry = new Button(MainActivity.this);
                retry.setText("LearnEV 启动失败，点此重试");
                retry.setOnClickListener(v -> start());
                root.addView(retry, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));
            }); }
        });
    }

    private boolean isWorkspace(Uri uri) {
        return origin != null && "http".equals(uri.getScheme()) && ("http://" + uri.getAuthority()).equals(origin);
    }
    private void open(int port, String token) {
        origin = "http://127.0.0.1:" + port;
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (isWorkspace(uri)) return false;
                if (req.isForMainFrame() && req.hasGesture() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                    catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                // Cookies are shared across ports. Only this process may receive the loopback session cookie.
                if ("127.0.0.1".equals(uri.getHost()) && !isWorkspace(uri))
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                return null;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                if (fileResult != null) fileResult.onReceiveValue(null);
                fileResult = result;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(pick, PICK_FILES); }
                catch (ActivityNotFoundException e) { fileResult = null; result.onReceiveValue(null); }
                return true;
            }
        });
        root.removeAllViews(); root.addView(web);
        WebView target = web;
        cookies.setCookie(origin, "learnev=" + token + "; Path=/; HttpOnly; SameSite=Strict", ok -> {
            if (web == target) target.loadUrl(origin + "/");
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_FILES || fileResult == null) return;
        List<Uri> uris = new ArrayList<>();
        if (result == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
            else if (data.getData() != null) uris.add(data.getData());
        }
        uris.removeIf(uri -> uri == null || !"content".equals(uri.getScheme()));
        fileResult.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0])); fileResult = null;
    }

    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // Close the native HTML dialog through React's cancel handler before leaving a chat.
        web.evaluateJavascript("(() => {const d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel',{cancelable:true}));return true}return false})()", value -> {
            if ("true".equals(value) || web == null) return;
            if (web.canGoBack()) web.goBack(); else finish();
        });
    }
    private void disposeWeb() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
    }
    @Override protected void onDestroy() {
        if (runtime != null) { runtime.close(); runtime = null; }
        if (fileResult != null) { fileResult.onReceiveValue(null); fileResult = null; }
        disposeWeb(); super.onDestroy();
    }
}
