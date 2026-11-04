package com.flyingpizza.game;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

// The game is one web page, shown full screen. It saves to localStorage, which the WebView keeps between launches.
public class MainActivity extends Activity {
  private static final String PAGE = "file:///android_asset/index.html";
  private static final int NIGHT = 0xff1a1430;
  private static final long EXIT_WINDOW_MS = 2000;
  private static final int FULL_SCREEN = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
  // pauses a mission in flight, and leaves every other screen alone
  private static final String PAUSE = "if(!document.querySelector('#levels:not([hidden]),#overlay:not([hidden]),.modal:not([hidden]),#sheet:not([hidden])'))document.getElementById('toMap').click()";

  private WebView web;
  private long backAt;

  @Override
  protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    web = new WebView(this);
    web.setBackgroundColor(NIGHT);
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.setVerticalScrollBarEnabled(false);
    web.setHorizontalScrollBarEnabled(false);
    WebSettings page = web.getSettings();
    page.setJavaScriptEnabled(true);
    page.setDomStorageEnabled(true);
    page.setMediaPlaybackRequiresUserGesture(false);
    // the layout is measured in pixels, so the phone's large-text setting must not stretch it
    page.setTextZoom(100);
    // the page asks to play on the phone's side, or to follow the phone again
    web.addJavascriptInterface(new Object() {
      @JavascriptInterface
      public void sideways(final boolean on) {
        runOnUiThread(new Runnable() {
          @Override
          public void run() {
            setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
          }
        });
      }
    }, "PizzaScreen");
    setContentView(web);
    web.loadUrl(PAGE);
  }

  @Override
  public void onWindowFocusChanged(boolean focused) {
    super.onWindowFocusChanged(focused);
    if (focused) getWindow().getDecorView().setSystemUiVisibility(FULL_SCREEN);
  }

  @Override
  protected void onPause() {
    super.onPause();
    web.onPause();
    web.pauseTimers();
  }

  @Override
  protected void onResume() {
    super.onResume();
    web.resumeTimers();
    web.onResume();
  }

  @Override
  protected void onDestroy() {
    web.destroy();
    super.onDestroy();
  }

  // A stray thumb on Back should not lose a mission: the first press pauses, a second one soon after leaves.
  @Override
  public void onBackPressed() {
    long now = SystemClock.uptimeMillis();
    if (now - backAt < EXIT_WINDOW_MS) {
      super.onBackPressed();
      return;
    }
    backAt = now;
    web.evaluateJavascript(PAUSE, null);
    Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
  }
}
