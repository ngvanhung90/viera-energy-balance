package com.vieralabs.energybalance

import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

internal fun installAttestation(appCheck: FirebaseAppCheck) {
    appCheck.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance(), false)
}
