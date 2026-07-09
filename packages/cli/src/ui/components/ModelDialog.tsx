/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ModelQuotaDisplay } from './ModelQuotaDisplay.js';
import { useUIState } from '../contexts/UIStateContext.js';
import {
  PREVIEW_GEMINI_MODEL,
  PREVIEW_GEMINI_3_1_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  GEMINI_MODEL_ALIAS_AUTO,
  GEMMA_4_31B_IT_MODEL,
  GEMMA_4_26B_A4B_IT_MODEL,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  getDisplayString,
  AuthType,
  PREVIEW_GEMINI_3_1_CUSTOM_TOOLS_MODEL,
  isProModel,
  getAutoModelDescription,
  getAllModelProviderProfiles,
  getModelProviderProfile,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const settings = useSettings();
  const { terminalWidth } = useUIState();
  const [hasAccessToProModel, setHasAccessToProModel] = useState<boolean>(
    () => !(config?.getProModelNoAccessSync() ?? false),
  );
  const [view, setView] = useState<
    'main' | 'manual' | 'providers' | 'providerModels'
  >(() => (config?.getProModelNoAccessSync() ? 'manual' : 'main'));
  const [selectedProviderProfileId, setSelectedProviderProfileId] = useState<
    string | undefined
  >(config?.getModelProviderConfig?.().profile);
  const [persistMode, setPersistMode] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (!config) return;
      const noAccess = await config.getProModelNoAccess();
      setHasAccessToProModel(!noAccess);
      if (noAccess) {
        setView('manual');
      }
    }
    void checkAccess();
  }, [config]);

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || GEMINI_MODEL_ALIAS_AUTO;

  const shouldShowPreviewModels = config?.getHasAccessToPreviewModel() ?? false;
  const useGemini31 = config?.getGemini31LaunchedSync?.() ?? false;
  const useGemini3_5Flash = config?.hasGemini35FlashGAAccess?.() ?? false;
  const selectedAuthType = settings.merged.security.auth.selectedType;
  const useCustomToolModel =
    useGemini31 && selectedAuthType === AuthType.USE_GEMINI;
  const currentProvider = config?.getModelProviderConfig?.();
  const providerSummary =
    currentProvider?.displayName ??
    currentProvider?.profile ??
    currentProvider?.provider ??
    'Google Gemini';

  const manualModelSelected = useMemo(() => {
    if (
      config?.getExperimentalDynamicModelConfiguration?.() === true &&
      config.getModelConfigService
    ) {
      const def = config
        .getModelConfigService()
        .getModelDefinition(preferredModel);
      // Only treat as manual selection if it's a visible, non-auto model.
      return def && def.tier !== 'auto' && def.isVisible === true
        ? preferredModel
        : '';
    }

    const manualModels = [
      DEFAULT_GEMINI_MODEL,
      DEFAULT_GEMINI_FLASH_MODEL,
      DEFAULT_GEMINI_FLASH_LITE_MODEL,
      PREVIEW_GEMINI_MODEL,
      PREVIEW_GEMINI_3_1_MODEL,
      PREVIEW_GEMINI_3_1_CUSTOM_TOOLS_MODEL,
      PREVIEW_GEMINI_FLASH_LITE_MODEL,
      PREVIEW_GEMINI_FLASH_MODEL,
    ].filter((m) => m !== 'none');
    if (manualModels.includes(preferredModel)) {
      return preferredModel;
    }
    return '';
  }, [preferredModel, config]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (view === 'providerModels') {
          setView('providers');
        } else if (view === 'providers') {
          setView('main');
        } else if (view === 'manual' && hasAccessToProModel) {
          setView('main');
        } else {
          onClose();
        }
        return true;
      }
      if (key.name === 'tab') {
        setPersistMode((prev) => !prev);
        return true;
      }
      return false;
    },
    { isActive: true },
  );
  const mainOptions = useMemo(() => {
    // --- DYNAMIC PATH ---
    if (
      config?.getExperimentalDynamicModelConfiguration?.() === true &&
      config.getModelConfigService
    ) {
      const allOptions = config
        .getModelConfigService()
        .getAvailableModelOptions({
          useGemini3_1: useGemini31,
          useGemini3_5Flash,
          useCustomTools: useCustomToolModel,
          hasAccessToPreview: shouldShowPreviewModels,
          hasAccessToProModel,
        });

      const list = allOptions
        .filter((o) => o.tier === 'auto')
        .map((o) => ({
          value: o.modelId,
          title: o.name,
          description: o.description,
          key: o.modelId,
        }));

      list.push({
        value: 'Manual',
        title: manualModelSelected
          ? `Manual (${getDisplayString(manualModelSelected, config ?? undefined)})`
          : 'Manual',
        description: 'Manually select a model',
        key: 'Manual',
      });
      list.push({
        value: 'Providers',
        title: `Provider (${providerSummary})`,
        description:
          'Switch between Google, Groq, Kimi, Qwen, GLM, and custom OpenAI-compatible profiles',
        key: 'Providers',
      });
      return list;
    }

    // --- LEGACY PATH ---
    const list = [
      {
        value: GEMINI_MODEL_ALIAS_AUTO,
        title: getDisplayString(GEMINI_MODEL_ALIAS_AUTO),
        description: getAutoModelDescription(
          shouldShowPreviewModels,
          useGemini31,
          useGemini3_5Flash,
        ),
        key: GEMINI_MODEL_ALIAS_AUTO,
      },
      {
        value: 'Manual',
        title: manualModelSelected
          ? `Manual (${getDisplayString(manualModelSelected)})`
          : 'Manual',
        description: 'Manually select a model',
        key: 'Manual',
      },
      {
        value: 'Providers',
        title: `Provider (${providerSummary})`,
        description: 'Switch provider profiles and pick a provider model',
        key: 'Providers',
      },
    ];

    return list;
  }, [
    config,
    shouldShowPreviewModels,
    manualModelSelected,
    useGemini31,
    useGemini3_5Flash,
    useCustomToolModel,
    hasAccessToProModel,
    providerSummary,
  ]);

  const manualOptions = useMemo(() => {
    // --- DYNAMIC PATH ---
    if (
      config?.getExperimentalDynamicModelConfiguration?.() === true &&
      config.getModelConfigService
    ) {
      const allOptions = config
        .getModelConfigService()
        .getAvailableModelOptions({
          useGemini3_1: useGemini31,
          useGemini3_5Flash,
          useCustomTools: useCustomToolModel,
          hasAccessToPreview: shouldShowPreviewModels,
          hasAccessToProModel,
        });

      return allOptions
        .filter((o) => o.tier !== 'auto')
        .map((o) => ({
          value: o.modelId,
          title: o.name,
          key: o.modelId,
        }));
    }

    // --- LEGACY PATH ---
    const showGemmaModels = config?.getExperimentalGemma() ?? false;

    const options = [
      {
        value: DEFAULT_GEMINI_MODEL,
        title: getDisplayString(DEFAULT_GEMINI_MODEL),
        key: DEFAULT_GEMINI_MODEL,
      },
      {
        value: DEFAULT_GEMINI_FLASH_LITE_MODEL,
        title: getDisplayString(DEFAULT_GEMINI_FLASH_LITE_MODEL),
        key: DEFAULT_GEMINI_FLASH_LITE_MODEL,
      },
      {
        value: DEFAULT_GEMINI_FLASH_MODEL,
        title: getDisplayString(DEFAULT_GEMINI_FLASH_MODEL),
        key: DEFAULT_GEMINI_FLASH_MODEL,
      },
    ];

    if (showGemmaModels) {
      options.push(
        {
          value: GEMMA_4_31B_IT_MODEL,
          title: getDisplayString(GEMMA_4_31B_IT_MODEL),
          key: GEMMA_4_31B_IT_MODEL,
        },
        {
          value: GEMMA_4_26B_A4B_IT_MODEL,
          title: getDisplayString(GEMMA_4_26B_A4B_IT_MODEL),
          key: GEMMA_4_26B_A4B_IT_MODEL,
        },
      );
    }

    if (shouldShowPreviewModels) {
      const previewProModel = useGemini31
        ? PREVIEW_GEMINI_3_1_MODEL
        : PREVIEW_GEMINI_MODEL;

      const previewProValue = useCustomToolModel
        ? PREVIEW_GEMINI_3_1_CUSTOM_TOOLS_MODEL
        : previewProModel;

      const previewOptions = [
        {
          value: previewProValue,
          title: getDisplayString(previewProModel),
          key: previewProModel,
        },
        {
          value: PREVIEW_GEMINI_FLASH_MODEL,
          title: getDisplayString(PREVIEW_GEMINI_FLASH_MODEL),
          key: PREVIEW_GEMINI_FLASH_MODEL,
        },
      ];

      if (PREVIEW_GEMINI_FLASH_LITE_MODEL !== 'none') {
        previewOptions.push({
          value: PREVIEW_GEMINI_FLASH_LITE_MODEL,
          title: getDisplayString(PREVIEW_GEMINI_FLASH_LITE_MODEL),
          key: PREVIEW_GEMINI_FLASH_LITE_MODEL,
        });
      }

      options.unshift(...previewOptions);
    }

    if (!hasAccessToProModel) {
      // Filter out all Pro models for free tier
      return options.filter((option) => !isProModel(option.value));
    }

    return options;
  }, [
    shouldShowPreviewModels,
    useGemini31,
    useGemini3_5Flash,
    useCustomToolModel,
    hasAccessToProModel,
    config,
  ]);

  const providerOptions = useMemo(
    () =>
      getAllModelProviderProfiles().map((profile) => ({
        value: `provider:${profile.id}`,
        title: profile.displayName,
        description: profile.description,
        key: `provider:${profile.id}`,
      })),
    [],
  );

  const providerModelOptions = useMemo(() => {
    const profile = getModelProviderProfile(selectedProviderProfileId);
    if (!profile) {
      return [];
    }

    if (profile.models.length === 0) {
      return [
        {
          value: `providerModel:${profile.id}:${preferredModel}`,
          title: `Use current model (${preferredModel})`,
          description:
            'Useful for custom OpenAI-compatible endpoints configured with env vars',
          key: `providerModel:${profile.id}:current`,
        },
      ];
    }

    return profile.models.map((model) => ({
      value: `providerModel:${profile.id}:${model.id}`,
      title: model.displayName ?? model.id,
      description: model.description,
      key: `providerModel:${profile.id}:${model.id}`,
    }));
  }, [preferredModel, selectedProviderProfileId]);

  const options = useMemo(() => {
    const rawOptions =
      view === 'main'
        ? mainOptions
        : view === 'manual'
          ? manualOptions
          : view === 'providers'
            ? providerOptions
            : providerModelOptions;
    const seen = new Set<string>();
    return rawOptions.filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [view, mainOptions, manualOptions, providerOptions, providerModelOptions]);

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(() => {
    const idx = options.findIndex((option) => option.value === preferredModel);
    if (idx !== -1) {
      return idx;
    }
    if (view === 'providers') {
      const providerIdx = options.findIndex(
        (option) => option.value === `provider:${currentProvider?.profile}`,
      );
      return providerIdx !== -1 ? providerIdx : 0;
    }
    if (view === 'main') {
      const manualIdx = options.findIndex((o) => o.value === 'Manual');
      return manualIdx !== -1 ? manualIdx : 0;
    }
    return 0;
  }, [preferredModel, options, view, currentProvider?.profile]);

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (model === 'Manual') {
        setView('manual');
        return;
      }
      if (model === 'Providers') {
        setView('providers');
        return;
      }
      if (model.startsWith('provider:')) {
        const profileId = model.slice('provider:'.length);
        setSelectedProviderProfileId(profileId);
        setView('providerModels');
        return;
      }
      if (model.startsWith('providerModel:')) {
        const [, profileId, modelId] = model.split(':');
        if (config && profileId && modelId) {
          void (async () => {
            await config.setModelProviderProfile(
              profileId,
              modelId,
              persistMode ? false : true,
            );
            const event = new ModelSlashCommandEvent(modelId);
            logModelSlashCommand(config, event);
            onClose();
          })();
        }
        return;
      }

      if (config) {
        config.setModel(model, persistMode ? false : true);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose, persistMode],
  );

  const title =
    view === 'providers'
      ? 'Select Provider'
      : view === 'providerModels'
        ? `Select ${getModelProviderProfile(selectedProviderProfileId)?.displayName ?? 'Provider'} Model`
        : 'Select Model';

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{title}</Text>

      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={options}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text bold color={theme.text.primary}>
            Remember model for future sessions:{' '}
          </Text>
          <Text color={theme.status.success}>
            {persistMode ? 'true' : 'false'}
          </Text>
          <Text color={theme.text.secondary}> (Press Tab to toggle)</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text color={theme.text.secondary}>
          {
            '> Use --model for startup model selection. Use AI_PROVIDER or /model provider for provider selection.'
          }
        </Text>
      </Box>
      <ModelQuotaDisplay
        buckets={config?.getLastRetrievedQuota()?.buckets}
        availableWidth={terminalWidth - 2}
      />
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
