package com.dudullsc.controlecontas;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Trampolim transparente para ACTION_SEND.
 * Lê o arquivo na task do compartilhamento e abre o MainActivity na task do app,
 * evitando "prender" / sobrescrever o app de origem (ex.: Nubank).
 */
public class ShareReceiverActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent incoming = getIntent();
        ShareIntentHelper helper = new ShareIntentHelper(this);
        helper.consumeShareIntent(incoming);

        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        launch.putExtra(ShareIntentHelper.EXTRA_SHARE_READY, true);
        startActivity(launch);
        finish();
    }
}
