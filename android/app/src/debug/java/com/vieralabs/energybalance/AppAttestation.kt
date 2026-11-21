package com.vieralabs.energybalance

import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

internal fun installAttestation(appCheck: FirebaseAppCheck) {
    appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance(), false)
}
