import { initializeApp } from '../vendor/firebase-app.js';
import {
  getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource
} from '../vendor/firebase-ai.js';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from '../vendor/firebase-app-check.js';
import { makePlanPrompt, validateChoices, validateNanoChoices } from './planner.js';

const modelName = 'gemini-3.5-flash-lite';
const deviceOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
};
const schema = {
  type: 'object', additionalProperties: false, required: ['meal', 'workout', 'focus'],
  properties: {
    meal: { type: 'string' }, workout: { type: 'string' },
    focus: { type: 'string', enum: ['time', 'energy', 'taste'] }
  }
};
let config;
let deviceModel;
let deviceInitialization;
let cloud;
let quotaUntil = 0;
let nativeStatus;
let nativeRequestId = 0;
const isAndroidApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('VieraAndroid/1');

export function nativeRequest(operation, data = {}) {
  const bridge = globalThis.VieraNative;
  if (!bridge) return Promise.reject(new Error('device-unavailable'));
  const id = String(++nativeRequestId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridge.removeEventListener('message', receive);
      reject(new Error('deadline'));
    }, operation === 'status' || operation.startsWith('completed-history-') ? 4000 : 21500);
    function receive(event) {
      const response = JSON.parse(event.data);
      if (response.id !== id) return;
      clearTimeout(timer);
      bridge.removeEventListener('message', receive);
      if (response.reason) reject(new Error(response.reason));
      else resolve(response);
    }
    bridge.addEventListener('message', receive);
    bridge.postMessage(JSON.stringify({ id, operation, ...data }));
  });
}

export async function loadConfig() {
  if (isAndroidApp) return;
  try {
    const response = await fetch('./firebase-config.json', { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return;
    const candidate = await response.json();
    if (['apiKey', 'appId', 'projectId'].every(key => typeof candidate.firebase?.[key] === 'string' && candidate.firebase[key])) {
      config = candidate;
    }
  } catch {
    // Components unrelated to Firebase remain usable if configuration is unavailable.
  }
}

export function cloudConfigured() {
  if (isAndroidApp) return nativeStatus?.cloudConfigured === true;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const debug = loopback && Boolean(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN);
  return config?.sparkBillingVerified === true && (Boolean(config.recaptchaEnterpriseSiteKey) || debug);
}

export function connectionState() {
  return isAndroidApp ? nativeStatus?.online ?? null : navigator.onLine;
}

export function liveAvailable() {
  return isAndroidApp && nativeStatus?.liveAvailable === true;
}

export function nanoDownloadStatus() {
  return isAndroidApp ? nativeStatus?.modelDownload : undefined;
}

export function startNanoDownload(confirmed) {
  if (!isAndroidApp || nativeStatus?.availability !== 'downloadable' || confirmed !== true) {
    return Promise.reject(new Error('device-unavailable'));
  }
  return nativeRequest('download-nano', { confirmed });
}

export async function checkDevice() {
  if (isAndroidApp) {
    try {
      nativeStatus = await nativeRequest('status');
      return nativeStatus.availability;
    } catch {
      nativeStatus = undefined;
      return 'unknown';
    }
  }
  if (!globalThis.isSecureContext || typeof globalThis.LanguageModel?.availability !== 'function') return 'unavailable';
  try {
    return await globalThis.LanguageModel.availability(deviceOptions);
  } catch {
    return 'unavailable';
  }
}

function withDeadline(promise, milliseconds) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('deadline')), milliseconds);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function onDevice(prompt, availability) {
  if (availability === 'setup-required') throw new Error('firebase-config-missing');
  if (availability === 'unknown') throw new Error('device-check-failed');
  if (availability !== 'available') throw new Error('device-unavailable');
  if (isAndroidApp) {
    return asSdkResult(await nativeRequest('generate', { branch: 'device', prompt }));
  }
  if (!config) throw new Error('firebase-config-missing');
  // Do not call Chrome create() or initializeDeviceModel while downloading or downloadable.
  if (!deviceModel) {
    const app = initializeApp(config.firebase, 'viera-device');
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    deviceModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: { createOptions: deviceOptions }
    });
  }
  deviceInitialization ??= deviceModel.initializeDeviceModel().catch(error => {
    deviceInitialization = undefined;
    throw error;
  });
  await withDeadline(deviceInitialization, 7000);
  return withDeadline(deviceModel.generateContent(prompt), 12000);
}

async function inCloud(prompt) {
  if (!cloudConfigured()) throw new Error('cloud-not-configured');
  if (connectionState() === false) throw new Error('offline');
  if (Date.now() < quotaUntil) throw new Error('quota');
  if (isAndroidApp) return asSdkResult(await nativeRequest('generate', { branch: 'cloud', prompt }));
  if (!cloud) {
    const app = initializeApp(config.firebase, 'viera-cloud');
    const check = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.recaptchaEnterpriseSiteKey || ''),
      isTokenAutoRefreshEnabled: false
    });
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema }
      }
    }, { timeout: 9000 });
    cloud = { check, model };
  }
  try {
    const attestation = await withDeadline(getToken(cloud.check), 7000);
    if (!attestation.token) throw new Error('missing-token');
  } catch (error) {
    if (error.message === 'deadline') throw error;
    throw new Error('app-check');
  }
  try {
    return await withDeadline(cloud.model.generateContent(prompt), 10500);
  } catch (error) {
    if (failureCode(error) === 'quota') quotaUntil = Date.now() + 60000;
    throw error;
  }
}

function asSdkResult(payload) {
  const source = { ON_DEVICE: InferenceSource.ON_DEVICE, IN_CLOUD: InferenceSource.IN_CLOUD }[payload.source];
  return {
    deviceModel: payload.model,
    response: { inferenceSource: source, text: () => payload.text }
  };
}

export function failureCode(error) {
  const text = [error?.message, error?.code, error?.customData?.status].join(' ');
  if (error?.message === 'device-quota') return 'device-quota';
  if (/\b429\b|resource.exhausted|quota/i.test(text)) return 'quota';
  if (/app.check|\b403\b|permission.denied/i.test(text)) return 'app-check';
  if (/deadline|timeout|timed.out/i.test(text)) return 'deadline';
  if (/offline|network|failed to fetch/i.test(text)) return 'offline';
  if (['firebase-config-missing', 'device-unavailable', 'device-check-failed', 'cloud-not-configured', 'invalid-selection', 'unexpected-source'].includes(error?.message)) return error.message;
  return 'service-error';
}

function readResult(result, expectedSource, options) {
  if (result.response.inferenceSource !== expectedSource) throw new Error('unexpected-source');
  return expectedSource === InferenceSource.ON_DEVICE
    ? validateNanoChoices(result.response.text(), options)
    : validateChoices(result.response.text(), options);
}

export async function generatePlan({ mode, options, profile, cloudOptions, cloudProfile, availability, allowCloud }) {
  if (mode === 'rules') return { source: 'catalog' };
  const started = performance.now();
  let localFailure;
  if (mode !== 'cloud') {
    try {
      const result = await onDevice(makePlanPrompt(options, profile), availability);
      return {
        ...readResult(result, InferenceSource.ON_DEVICE, options), source: 'device',
        modelName: result.deviceModel,
        milliseconds: Math.round(performance.now() - started)
      };
    } catch (error) {
      localFailure = failureCode(error);
    }
  }
  if (mode !== 'device' && allowCloud && cloudOptions.mealOptions.length && cloudOptions.movementOptions.length) {
    try {
      const result = await inCloud(makePlanPrompt(cloudOptions, cloudProfile));
      const choices = readResult(result, InferenceSource.IN_CLOUD, cloudOptions);
      if (!options.movementOptions.some(item => item.id === choices.workout.id)) {
        return { source: 'catalog', reason: 'cloud-over-effort', localFailure };
      }
      return {
        ...choices, source: 'cloud', reason: localFailure,
        modelName, milliseconds: Math.round(performance.now() - started)
      };
    } catch (error) {
      return { source: 'catalog', reason: failureCode(error), localFailure };
    }
  }
  return { source: 'catalog', reason: localFailure ?? 'cloud-consent' };
}
